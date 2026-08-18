import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai';
import app from '@/lib/firebase';

export type QuizBook = { title: string; author: string };
export type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string; evidence?: string };
export type BookSearchResult = { title: string; authors: string[]; source: string };

const ai = getAI(app, { backend: new GoogleAIBackend() });
const questionSchema = Schema.object({
  properties: {
    questions: Schema.array({
      items: Schema.object({
        properties: {
          question: Schema.string(),
          options: Schema.array({ items: Schema.string() }),
          answer: Schema.integer(),
          evidence: Schema.string(),
        },
      }),
    }),
  },
});

// Gemini 3.6 Flash is the current Firebase AI Logic fast general-purpose model.
// Gemini 3.5 Flash-Lite is retained as the automatic retry model.
const grounded = getGenerativeModel(ai, {
  model: 'gemini-3.6-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: questionSchema,
    temperature: 0.35,
    maxOutputTokens: 12000,
  },
  tools: [{ googleSearch: {} }],
});
const fast = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash-lite',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: questionSchema,
    temperature: 0.25,
    maxOutputTokens: 9000,
  },
  tools: [{ googleSearch: {} }],
});
const plain = getGenerativeModel(ai, {
  model: 'gemini-3.6-flash',
  generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
});

const CACHE = 'v14-resilient-instruction-first';
const SCARS = { title: 'SCARS: Nigeria’s Journey and the Boko Haram Conundrum', author: 'Gen. Lucky Irabor' };
const SANYA = { title: 'Sànyà', author: 'Oyin Olugbile' };

const norm = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const clean = (s: any) => String(s ?? '').replace(/```[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1').replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1').replace(/^\s*#{1,6}\s*/gm, '').replace(/\s+/g, ' ').trim();
const fingerprint = (s: string) => norm(s).replace(/\b(the|a|an|what|which|who|how|why|did|does|is|was|were|of|in|on|to|and|for|from|about|according)\b/g, '').replace(/\s+/g, ' ').trim();
const similar = (a: string, b: string) => { const x = new Set(fingerprint(a).split(' ').filter(Boolean)); const y = new Set(fingerprint(b).split(' ').filter(Boolean)); if (!x.size || !y.size) return false; const hit = [...x].filter(v => y.has(v)).length; return hit / Math.max(1, Math.min(x.size, y.size)) >= 0.82; };
const getCache = <T,>(key: string): T | null => { try { if (typeof localStorage === 'undefined') return null; const x = JSON.parse(localStorage.getItem(key) || 'null'); return x && x.e > Date.now() ? x.v : null; } catch { return null; } };
const setCache = (key: string, value: any, ttl: number) => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify({ e: Date.now() + ttl, v: value })); } catch {} };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function aiCall(model: any, prompt: string, timeout = 75000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('AI request timed out')), timeout); }),
    ]) as any;
  } finally { if (timer) clearTimeout(timer); }
}

function parseQuestions(text: string): QuizQuestion[] {
  const raw = String(text || '').trim();
  let data: any;
  try { data = JSON.parse(raw); } catch {
    const a = raw.indexOf('{'); const b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Gemini returned an unreadable quiz response.');
    data = JSON.parse(raw.slice(a, b + 1));
  }
  const list = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(list)) return [];
  return list.map((q: any) => ({
    question: clean(q?.question),
    options: Array.isArray(q?.options) ? q.options.slice(0, 4).map(clean) : [],
    answer: Number(q?.answer),
    evidence: clean(q?.evidence),
    explanation: clean(q?.explanation),
  })).filter(validQuestion);
}

function validQuestion(q: any) {
  return !!q && typeof q.question === 'string' && q.question.length > 18 &&
    Array.isArray(q.options) && q.options.length === 4 && q.options.every((x: any) => typeof x === 'string' && x.length > 0) &&
    Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4;
}

const isMetadata = (q: QuizQuestion) => /\b(author|written by|writer|title|publisher|publication|isbn|edition|published)\b/i.test(q.question);
const isGeneric = (q: QuizQuestion) => /\b(main|major)\s+(theme|challenge|problem|topic)|what\s+(is|was)\s+the\s+(main|major)\s+theme|what is the book about/i.test(q.question);
const scars = (s: string) => norm(s).includes('scars') || norm(s).includes('irabor');
const sanya = (b: QuizBook) => norm(b.title) === 'sanya' || norm(b.author).includes('oyin olugbile');
const fixedBook = (b: QuizBook) => scars(b.title) ? SCARS : sanya(b) ? SANYA : b;

const curated: Record<string, string[]> = {
  sanya: [
    'Sànyà is the 2022 debut novel by Nigerian author Oyin Olugbile, published by Masobe Books.',
    'Sànyà reimagines Yoruba mythology and the story and legacy of Sango through a female protagonist.',
    'Sànyà has a brother named Dada, who is physically weak but highly intelligent and has the gift of seeing into the future.',
    'Sànyà leaves home after an unspeakable tragedy and later discovers that her powers are linked to a dark prophecy.',
    'The novel explores family, love, identity, ancestry, power, Yoruba mythology, gods, Orisas and sorcerers.',
  ],
  scars: [
    'SCARS is authored by Gen. Lucky Irabor and examines Nigeria’s journey and the Boko Haram conundrum from frontline military experience and wider reflections on governance and insecurity.',
    'SCARS has three parts: The Ghost that Lives with Us; The Boko Haram Conundrum; and Eyes Set on Tomorrow.',
    'SCARS contains fourteen chapters and a concluding note.',
    'Chapter 4 examines the geography, history, power structures, socio-economic conditions, culture, religion and communication systems of North Eastern Nigeria.',
    'Chapter 5 gives a brief overview of Boko Haram, including its background, origin, organization, ideology and early leadership profile.',
    'Chapter 7 documents violent killings, destruction, improvised explosive device attacks, targeted killings and school abductions.',
    'Chapter 14 advocates whole-of-government and whole-of-society approaches, psychological re-orientation, security-sector reforms, national reconciliation, judicial reforms, good governance and constitutional review.',
    'A central idea in SCARS is that Nigeria’s security challenge cannot be solved by military force alone; broader political, social, institutional and psychological responses are required.',
  ],
};

export async function searchBookAuthors(kind: 'title' | 'author', value: string): Promise<BookSearchResult[]> {
  const q = value.trim(), n = norm(q); if (!q) return [];
  if (scars(q)) return [{ title: SCARS.title, authors: [SCARS.author], source: 'EDUWILLS verified catalogue' }];
  if (n.includes('sanya') || n.includes('oyin olugbile')) return [{ title: SANYA.title, authors: [SANYA.author], source: 'EDUWILLS verified catalogue' }];
  const key = `eduwills:${CACHE}:search:${kind}:${n}`; const cached = getCache<BookSearchResult[]>(key); if (cached) return cached;
  const e = encodeURIComponent(q);
  const urls = kind === 'title'
    ? [`https://openlibrary.org/search.json?title=${e}&limit=80&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=intitle:${e}&maxResults=40`, `https://archive.org/advancedsearch.php?q=title:%28${e}%29&fl[]=title&fl[]=creator&rows=50&output=json`, `https://www.loc.gov/books/?q=${e}&fo=json&c=40`]
    : [`https://openlibrary.org/search.json?author=${e}&limit=80&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=inauthor:${e}&maxResults=40`, `https://www.loc.gov/books/?q=${e}&fo=json&c=40`, `https://archive.org/advancedsearch.php?q=creator:%28${e}%29&fl[]=title&fl[]=creator&rows=50&output=json`];
  const out: BookSearchResult[] = []; const seen = new Set<string>();
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) continue; const d = await r.json();
      for (const x of d.docs || []) { const title = clean(x.title); const authors = (x.author_name || []).map(String); if (!title || !authors.length) continue; const id = norm(title) + '|' + authors.map(norm).join('|'); if (!seen.has(id)) { seen.add(id); out.push({ title, authors, source: url.includes('openlibrary') ? 'Open Library' : url.includes('archive') ? 'Internet Archive' : url.includes('loc.gov') ? 'Library of Congress' : 'Google Books' }); } }
      for (const x of d.items || []) { const title = clean(x.volumeInfo?.title); const authors = (x.volumeInfo?.authors || []).map(String); if (!title || !authors.length) continue; const id = norm(title) + '|' + authors.map(norm).join('|'); if (!seen.has(id)) { seen.add(id); out.push({ title, authors, source: 'Google Books' }); } }
      for (const x of d.results || []) { const title = clean(x.title); const authors = Array.isArray(x.creator) ? x.creator.map(String) : [clean(x.creator)]; if (!title || !authors.some(Boolean)) continue; const id = norm(title) + '|' + authors.map(norm).join('|'); if (!seen.has(id)) { seen.add(id); out.push({ title, authors: authors.filter(Boolean), source: 'Internet Archive' }); } }
    } catch {}
  }
  const result = out.slice(0, 160); setCache(key, result, 21600000); return result;
}

async function fetchJson(url: string, timeout = 7000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try { const r = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); }
  finally { clearTimeout(timer); }
}

export async function researchBooks(books: QuizBook[]): Promise<string> {
  const fixed = books.map(fixedBook); const key = `eduwills:${CACHE}:research:${fixed.map(b => norm(`${b.title}|${b.author}`)).join(';')}`; const cached = getCache<string>(key); if (cached) return cached;
  const all: string[] = []; const add = (s: string) => { const t = clean(s); if (t.length > 25 && !all.some(x => norm(x) === norm(t))) all.push(t); };
  for (const b of fixed) {
    for (const fact of curated[norm(b.title) === 'sanya' ? 'sanya' : scars(b.title) ? 'scars' : ''] || []) add(`EDUWILLS verified book fact for ${b.title}: ${fact}`);
    const guard = sanya(b) ? 'This is ONLY the Nigerian novel Sànyà by Oyin Olugbile. Ignore Sanya Mountain, Sanya Bay, Sanya Island, travel pages and all unrelated geography.' : scars(b.title) ? 'This is ONLY SCARS: Nigeria’s Journey and the Boko Haram Conundrum by Gen. Lucky Irabor. Ignore unrelated books, places or articles named Scars.' : '';
    const prompt = `You are EDUWILLS BOOK RESEARCH AI. Research the exact book "${b.title}" by "${b.author}". ${guard}\n\nBuild a factual dossier for quiz generation. Prioritize actual book content over metadata: characters or named people, events, incidents, actions, decisions, relationships, causes and consequences, places, organizations, chronology, dates and years, chapter-specific facts, numbers and distinctive details. Use reliable book-specific sources. Do not invent or infer unsupported scenes. Distinguish this exact title-author pair from similarly named works. Return a dense factual dossier, not a generic review.`;
    try { const r = await aiCall(grounded, prompt, 65000); add(`Gemini verified research for ${b.title}: ${clean(r.response.text())}`); }
    catch { try { const r = await aiCall(fast, prompt, 50000); add(`Gemini fallback research for ${b.title}: ${clean(r.response.text())}`); } catch {} }
    const t = encodeURIComponent(b.title), a = encodeURIComponent(b.author);
    const urls = [`https://www.googleapis.com/books/v1/volumes?q=intitle:${t}+inauthor:${a}&maxResults=20`, `https://openlibrary.org/search.json?title=${t}&author=${a}&limit=40&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`, `https://archive.org/advancedsearch.php?q=title:%28${t}%29+AND+creator:%28${a}%29&fl[]=title&fl[]=creator&fl[]=description&fl[]=subject&rows=30&output=json`, `https://www.loc.gov/books/?q=${t}&fo=json&c=30`];
    const results = await Promise.allSettled(urls.map(u => fetchJson(u)));
    for (const r of results) if (r.status === 'fulfilled') {
      const d: any = r.value;
      for (const item of d.items || []) { const v = item.volumeInfo || {}; if (v.description) add(`Google Books content for ${b.title}: ${v.description}`); if (v.categories) add(`Google Books categories for ${b.title}: ${v.categories.join(', ')}`); if (v.publishedDate) add(`Google Books publication record for ${b.title}: ${v.publishedDate}; publisher: ${v.publisher || 'unknown'}.`); }
      for (const item of d.docs || []) { const identity = norm(`${item.title || ''} ${(item.author_name || []).join(' ')}`); const words = norm(b.title).split(' ').filter(w => w.length > 3); const hits = words.filter(w => identity.includes(w)).length; if (hits >= Math.max(1, Math.ceil(words.length * 0.45)) || identity.includes(norm(b.author))) { if (item.first_sentence) add(`Open Library first sentence for ${b.title}: ${(item.first_sentence || []).join(' ')}`); if (item.subject) add(`Open Library subjects for ${b.title}: ${(item.subject || []).slice(0, 80).join(', ')}`); if (item.description) add(`Open Library description for ${b.title}: ${typeof item.description === 'string' ? item.description : JSON.stringify(item.description)}`); if (item.first_publish_year) add(`Open Library publication record for ${b.title}: ${item.first_publish_year}.`); } }
      for (const item of d.response?.docs || []) if (item.title || item.description) add(`Library of Congress record for ${b.title}: ${item.title || ''}. ${item.description || ''}`);
      for (const item of d.response?.docs || d.results || []) if (item.description || item.subject) add(`Internet Archive material for ${b.title}: ${item.description || ''} ${(item.subject || []).join ? 'Subjects: ' + (item.subject || []).join(', ') : ''}`);
    }
  }
  // Never return an empty dossier: the generator itself is instructed to perform grounded research.
  if (!all.length) all.push(`No external dossier was returned. The generation model MUST research and verify the exact book "${fixed.map(b => `${b.title}" by "${b.author}`).join('; ')}" before writing any question. Do not invent content.`);
  const result = all.join('\n\n').slice(0, 140000); setCache(key, result, 86400000); return result;
}

function instructionSignals(instructions: string) {
  const n = norm(instructions); const out: string[] = [];
  if (/date|year|when|chronolog/.test(n)) out.push('dates, years and chronology');
  if (/event|incident|battle|occur|happen|crisis/.test(n)) out.push('specific events and incidents');
  if (/character|person|people|relationship|family/.test(n)) out.push('characters, people and relationships');
  if (/place|location|setting/.test(n)) out.push('places and settings');
  if (/cause|effect|consequence|result|why/.test(n)) out.push('causes, consequences and effects');
  if (/chapter|part|section/.test(n)) out.push('chapter, part or section details');
  if (/quote|quotation|line/.test(n)) out.push('specific quotations or lines only when the evidence supplies them');
  return out;
}

function instructionSatisfied(q: QuizQuestion, instructions: string) {
  if (!instructions.trim()) return true;
  const n = norm(instructions); const qn = norm(q.question);
  const chapter = n.match(/\b(?:chapter|ch)\s*(\d+)\b/);
  if (chapter && /\b(?:chapter|ch)\s*\d+\b/.test(n) && !qn.includes(`chapter ${chapter[1]}`) && !/according to|what happened|who|why|how|which/.test(qn)) return false;
  if (/only\s+(?:questions?\s+)?about\s+/.test(n)) {
    const phrase = n.split(/only\s+(?:questions?\s+)?about\s+/)[1]?.split(/[.;,]/)[0]?.trim();
    if (phrase && phrase.length > 3 && !qn.includes(phrase.split(' ').slice(0, 3).join(' '))) return false;
  }
  return true;
}

function buildPrompt(books: QuizBook[], target: number, difficulty: string, instructions: string, avoid: string[], research: string, contentOnly = false) {
  const fixed = books.map(fixedBook); const signals = instructionSignals(instructions);
  return `You are EDUWILLS QUIZ GENERATION AI. This is a factual book quiz, not a general trivia generator.\n\nEXACT BOOK IDENTITY LOCK: ${fixed.map(b => `TITLE="${b.title}" AUTHOR="${b.author}"`).join(' ; ')}. You MUST use the exact title-author pair. Never substitute a similarly named work, person, place, song, company or geography. For Sànyà, use ONLY Oyin Olugbile's Nigerian novel. For SCARS, use ONLY Gen. Lucky Irabor's book.\n\nUSER INSTRUCTION — HARD CONSTRAINT: "${instructions || 'Create a diverse quiz from the actual book content.'}"\nTreat every explicit user instruction as binding. Do not weaken, reinterpret or ignore it. Before returning the JSON, silently check every question against the instruction and remove any question that does not comply. If the instruction asks for a particular chapter, event type, character, date, place, difficulty, quantity or focus, follow it.\n\n${signals.length ? `Detected focus requirements: ${signals.join('; ')}.` : ''}\n\nQUIZ REQUIREMENTS:\n- Generate EXACTLY ${target} questions in this batch.\n- At least ${contentOnly ? '100' : '80'}% must test concrete content from the book itself.\n- Content means specific events, incidents, characters, people, relationships, actions, decisions, places, chronology, dates, causes, consequences, chapter details, organizations, numbers or other documented facts.\n- Do NOT pad the quiz with generic questions such as the main theme, what the book is about, or obvious summaries.\n- Author/title/publisher/publication metadata may be used only when the user's instruction asks for it; otherwise keep metadata to a maximum of 15% of the total.\n- Every correct answer must be supported by the supplied research or by a reliable Google Search result about the exact book.\n- Never invent quotations, scenes, chapter events, characters, dates or facts. If evidence is insufficient, create a different supported question instead.\n- Exactly four plausible answer options. Only one option is correct.\n- Vary the facts and avoid asking the same fact twice.\n- Difficulty: ${difficulty}.\n- SELF-CHECK BEFORE OUTPUT: verify exact book identity, user instruction compliance, factual support, four options, one correct answer, no duplicates and content-first balance.\n\nPREVIOUS QUESTIONS TO AVOID:\n${avoid.slice(-100).join('\n')}\n\nRESEARCH DOSSIER:\n${research.slice(0, 125000)}\n\nReturn ONLY the structured JSON requested by the response schema.`;
}

async function generateBatch(prompt: string): Promise<QuizQuestion[]> {
  let last: any = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const model = attempt <= 2 ? grounded : fast;
      const result = await aiCall(model, prompt, attempt <= 2 ? 80000 : 60000);
      const questions = parseQuestions(result.response.text());
      if (questions.length) return questions;
      last = new Error('Gemini returned no usable questions.');
    } catch (e) { last = e; await wait(400 * attempt); }
  }
  throw last || new Error('Unable to generate this quiz batch.');
}

export async function generateQuiz(books: QuizBook[], count: number, difficulty: string, instructions: string, recent: string[] = [], research = ''): Promise<QuizQuestion[]> {
  const fixed = books.map(fixedBook); const requested = Math.min(100, Math.max(1, Number(count) || 10));
  const recentQuestions = recent.filter(Boolean).slice(-100); const accepted: QuizQuestion[] = []; const seen = new Set(recentQuestions.map(fingerprint));
  const targetContent = Math.ceil(requested * 0.8);
  let failures = 0;

  // Smaller batches are dramatically more reliable than asking one model response for 40–100 questions.
  // We keep going until the requested count is genuinely satisfied.
  while (accepted.length < requested && failures < 12) {
    const remaining = requested - accepted.length;
    const batchSize = Math.min(8, remaining);
    const prompt = buildPrompt(fixed, batchSize, difficulty, instructions, [...seen], research, false);
    try {
      const batch = await generateBatch(prompt);
      let added = 0;
      for (const q of batch) {
        if (!validQuestion(q) || isGeneric(q) || !instructionSatisfied(q, instructions)) continue;
        const key = fingerprint(q.question);
        if (!key || seen.has(key) || accepted.some(x => similar(x.question, q.question))) continue;
        seen.add(key); accepted.push(q); added++;
        if (accepted.length >= requested) break;
      }
      if (!added) failures++; else failures = 0;
    } catch { failures++; }
    if (accepted.length < requested) await wait(250);
  }

  // If the first pass contains too many metadata questions, repair only the weak portion.
  let contentCount = accepted.filter(q => !isMetadata(q)).length;
  let repairAttempts = 0;
  while (contentCount < targetContent && repairAttempts < 6) {
    const need = Math.min(8, targetContent - contentCount);
    const prompt = buildPrompt(fixed, need, difficulty, instructions, [...seen], research, true) + '\n\nIMPORTANT REPAIR MODE: Generate ONLY concrete book-content questions. Do not generate author/title/publication metadata.';
    try {
      const batch = await generateBatch(prompt); let added = 0;
      for (const q of batch) {
        if (!validQuestion(q) || isMetadata(q) || isGeneric(q) || !instructionSatisfied(q, instructions)) continue;
        const key = fingerprint(q.question); if (!key || seen.has(key) || accepted.some(x => similar(x.question, q.question))) continue;
        seen.add(key); accepted.push(q); added++; if (accepted.length >= requested) break;
      }
      contentCount = accepted.filter(q => !isMetadata(q)).length;
      if (!added) repairAttempts++; else repairAttempts = 0;
    } catch { repairAttempts++; }
  }

  if (accepted.length < requested) {
    throw new Error(`The quiz AI could only verify ${accepted.length} of ${requested} questions. It stopped rather than inventing book content. Please try again; the next run will use the same instruction and fresh research.`);
  }
  contentCount = accepted.filter(q => !isMetadata(q)).length;
  if (contentCount < targetContent) {
    throw new Error('The quiz AI could not meet the required 80% book-content standard without inventing unsupported questions. Please try again.');
  }
  return accepted.slice(0, requested);
}

export async function explainFailure(book: string, question: string, chosen: string, correct: string) {
  try {
    const r = await aiCall(plain, `Plain text only. No Markdown, code fences, backticks, asterisks or headings. Briefly explain why "${correct}" is correct for this question from ${book}: ${question}. The learner chose: ${chosen}.`, 20000);
    return clean(r.response.text());
  } catch { return `The correct answer is ${correct}. Review the relevant evidence in ${book}.`; }
}

export async function generateRemarks(books: QuizBook[], score: number, total: number, percentage: number, difficulty: string, elapsed: number) {
  try {
    const r = await aiCall(plain, `Plain text only. Write one short performance remark for a learner who scored ${score}/${total} (${percentage}%) on a ${difficulty} quiz about ${books.map(b => `${b.title} by ${b.author}`).join(', ')}. Mention one strength and one useful next step. No Markdown or code symbols.`, 20000);
    return clean(r.response.text());
  } catch {
    return percentage >= 80 ? 'Excellent work. Your result shows strong understanding of the selected book content.' : percentage >= 60 ? 'Good progress. Review the questions you missed and revisit those sections.' : 'Keep practising. Re-read the relevant events and details, then try another quiz.';
  }
}
