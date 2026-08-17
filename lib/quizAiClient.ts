import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from '@/lib/firebase';

export type QuizBook = { title: string; author: string };
export type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string };
export type BookSearchResult = { title: string; authors: string[]; source: string };

const ai = getAI(app, { backend: new GoogleAIBackend() });

// Firebase AI Logic currently supports these Gemini Flash-Lite models. Gemini 3.5
// Flash-Lite is the current high-volume stable model and supports Google Search grounding.
const model = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash-lite',
  generationConfig: { responseMimeType: 'application/json', temperature: 0.75 },
  tools: [{ googleSearch: {} }],
});
const fallbackModel = getGenerativeModel(ai, {
  model: 'gemini-3.1-flash-lite',
  generationConfig: { responseMimeType: 'application/json', temperature: 0.75 },
  tools: [{ googleSearch: {} }],
});

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const fingerprint = (s: string) => normalize(s).replace(/\b(the|a|an|what|which|who|how|why|did|does|is|was|were|of|in|on|to|and|for|from|about|according|statement|following)\b/g, '').replace(/\s+/g, ' ').trim();
const similar = (a: string, b: string) => {
  const x = new Set(fingerprint(a).split(' ').filter(Boolean));
  const y = new Set(fingerprint(b).split(' ').filter(Boolean));
  if (!x.size || !y.size) return false;
  const hit = [...x].filter(v => y.has(v)).length;
  return hit / Math.max(1, Math.min(x.size, y.size)) >= 0.84;
};

const curated: Record<string, string[]> = {
  'the lekki headmaster': [
    'The Lekki Headmaster was written by Kabir Alabi Garba.',
    'The story follows Bepo Adewale, a dedicated headmaster at Stardom Schools in Lekki, Lagos.',
    'The novel explores education, integrity, service, migration pressure and the japa phenomenon.',
    'Bepo faces pressure to relocate to the United Kingdom but remains committed to his students and school.',
    'The novel was published by Winepress Publishing in 2023.',
    'JAMB selected The Lekki Headmaster as the general reading text for the 2025 and 2026 UTME Use of English.',
  ],
  'sanya': ['Sànyà is a Nigerian literary work by Oyin Olugbile.'],
  'scars': [
    'SCARS: Nigeria’s Journey and the Boko Haram Conundrum examines Nigeria’s journey and the Boko Haram conundrum.',
    'SCARS is associated with Gen. Lucky Irabor.',
  ],
};

async function withTimeout<T>(promise: Promise<T>, ms = 22000): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI request timed out after 22 seconds.')), ms)),
  ]);
}

async function json(url: string, ms = 5000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function searchBookAuthors(kind: 'title' | 'author', value: string): Promise<BookSearchResult[]> {
  const query = value.trim();
  if (!query) return [];
  const key = normalize(query);
  const results: BookSearchResult[] = [];
  const seen = new Set<string>();
  const add = (title: string, authors: string[], source: string) => {
    const t = String(title || '').trim();
    const a = [...new Set((authors || []).map(String).map(x => x.trim()).filter(Boolean))];
    if (!t || !a.length) return;
    if (kind === 'author' && !a.some(x => normalize(x).includes(key) || key.includes(normalize(x)))) return;
    const id = normalize(t) + '|' + a.map(normalize).sort().join(',');
    if (seen.has(id)) return;
    seen.add(id);
    results.push({ title: t, authors: a, source });
  };

  for (const [title, facts] of Object.entries(curated)) {
    if (title.includes(key) || key.includes(title)) {
      const authors = facts.flatMap(x => {
        const m = x.match(/(?:written by|by)\s+(.+?)\.?$/i);
        return m ? [m[1].trim()] : [];
      });
      if (authors.length) add(title, authors, 'EDUWILLS catalogue');
    }
  }

  const t = encodeURIComponent(query);
  const endpoints = kind === 'title'
    ? [
        ['Open Library', `https://openlibrary.org/search.json?title=${t}&limit=50`],
        ['Google Books', `https://www.googleapis.com/books/v1/volumes?q=intitle:${t}&maxResults=40`],
        ['Internet Archive', `https://archive.org/advancedsearch.php?q=title:%28${t}%29&fl[]=title&fl[]=creator&rows=40&page=1&output=json`],
      ]
    : [
        ['Open Library', `https://openlibrary.org/search.json?author=${t}&limit=50`],
        ['Google Books', `https://www.googleapis.com/books/v1/volumes?q=inauthor:${t}&maxResults=40`],
      ];

  const responses = await Promise.allSettled(endpoints.map(([source, url]) => json(url).then(data => ({ source, data }))));
  for (const r of responses) {
    if (r.status !== 'fulfilled') continue;
    const { source, data } = r.value;
    for (const x of data.docs || []) add(x.title, x.author_name || [], source);
    for (const x of data.items || []) add(x.volumeInfo?.title, x.volumeInfo?.authors || [], source);
    for (const x of data.response?.docs || []) add(x.title, Array.isArray(x.creator) ? x.creator : x.creator ? [x.creator] : [], source);
  }

  // Gemini is used as a catalogue-matching layer, never as permission to invent an author.
  const evidence = results.slice(0, 60).map(r => `${r.title} — ${r.authors.join(', ')} (${r.source})`).join('\n');
  try {
    const r = await withTimeout(model.generateContent(`You are EDUWILLS Book Search. Merge reliable matches for the ${kind} "${query}" using ONLY the public catalogue evidence below. Never invent a book or author. Return JSON only: {"results":[{"title":"...","authors":["..."],"source":"..."}]}. Evidence:\n${evidence || 'No catalogue evidence was returned.'}`), 12000);
    const parsed = JSON.parse(r.response.text());
    for (const item of parsed.results || []) add(item.title, item.authors || [], item.source || 'EDUWILLS AI + catalogues');
  } catch {
    // Public catalogue results remain usable if Gemini is unavailable.
  }
  return results.slice(0, 80);
}

export async function researchBooks(books: QuizBook[]): Promise<string> {
  const chunks: string[] = [];
  for (const book of books) chunks.push(...(curated[normalize(book.title)] || []));

  const requests = books.flatMap(book => {
    const t = encodeURIComponent(book.title);
    const a = encodeURIComponent(book.author);
    return [
      json(`https://www.googleapis.com/books/v1/volumes?q=intitle:${t}+inauthor:${a}&maxResults=20`),
      json(`https://openlibrary.org/search.json?title=${t}&author=${a}&limit=30`),
      json(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(book.title.replace(/ /g, '_'))}`),
      json(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(book.title + ' ' + book.author)}&language=en&format=json&limit=5&origin=*`),
    ];
  });

  const results = await Promise.allSettled(requests);
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const data = result.value;
    for (const item of data.items || []) {
      const v = item.volumeInfo || {};
      if (v.description) chunks.push(`Google Books: ${v.description}`);
      if (v.categories) chunks.push(`Google Books categories: ${v.categories.join(', ')}`);
      if (v.publishedDate) chunks.push(`Publication: ${v.publishedDate}; publisher: ${v.publisher || 'unknown'}.`);
    }
    for (const item of data.docs || []) {
      if (item.first_sentence) chunks.push(`Open Library: ${(item.first_sentence || []).join(' ')}`);
      if (item.subject) chunks.push(`Open Library subjects: ${(item.subject || []).slice(0, 60).join(', ')}`);
    }
    if (data.extract) chunks.push(`Wikipedia: ${data.extract}`);
    for (const item of Object.values(data.query?.pages || {}) as any[]) if (item.extract) chunks.push(`Wikipedia: ${item.extract}`);
    for (const item of data.search || []) if (item.description || item.aliases) chunks.push(`Wikidata: ${item.description || ''} ${item.aliases?.join(', ') || ''}`);
  }

  return [...new Set(chunks.map(x => String(x).trim()).filter(Boolean))].join('\n').slice(0, 70000);
}

function validate(raw: any, previous: string[], target: number): QuizQuestion[] {
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  const recent = new Set(previous.map(fingerprint).filter(Boolean));
  const out: QuizQuestion[] = [];
  for (const item of list) {
    const q = String(item?.question || '').trim();
    const o = Array.isArray(item?.options) ? item.options.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4) : [];
    const a = Number(item?.answer);
    if (!q || o.length !== 4 || new Set(o.map(normalize)).size !== 4 || !Number.isInteger(a) || a < 0 || a > 3) continue;
    if (recent.has(fingerprint(q)) || out.some(x => similar(x.question, q))) continue;
    out.push({ question: q, options: o, answer: a, explanation: String(item?.explanation || '').trim() });
    if (out.length >= target) break;
  }
  return out;
}

function deterministicFallback(books: QuizBook[], research: string, count: number, previous: string[]): QuizQuestion[] {
  const facts = [...books.flatMap(b => curated[normalize(b.title)] || []), ...research.split(/\n+/).filter(x => x.length > 35)]
    .map(x => x.replace(/^(Google Books|Open Library|Wikipedia|Wikidata|Categories|Subjects|Publication):\s*/i, '').trim())
    .filter(Boolean);
  const uniqueFacts = [...new Set(facts)];
  const recent = new Set(previous.map(fingerprint));
  const out: QuizQuestion[] = [];
  const templates = [
    (book: string, fact: string) => `According to the available research, what detail is associated with ${book}?`,
    (book: string, fact: string) => `Which researched fact best describes ${book}?`,
    (book: string, fact: string) => `What does the available evidence report about ${book}?`,
    (book: string, fact: string) => `Which statement is supported by the research on ${book}?`,
    (book: string, fact: string) => `What information about ${book} is confirmed by the research?`,
  ];

  for (let i = 0; i < uniqueFacts.length && out.length < count; i++) {
    const book = books[i % Math.max(1, books.length)]?.title || 'the selected book';
    const fact = uniqueFacts[i];
    const distractors = uniqueFacts.filter((x, j) => j !== i).slice(0, 3);
    while (distractors.length < 3) distractors.push('This detail is not supported by the available research.');
    const correctIndex = i % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, fact);
    const question = templates[i % templates.length](book, fact) + ` (Research detail ${i + 1})`;
    if (recent.has(fingerprint(question)) || out.some(x => similar(x.question, question))) continue;
    out.push({ question, options: options.slice(0, 4), answer: correctIndex, explanation: 'This question was produced from the verified book research available to EDUWILLS while the AI generation service was unavailable.' });
  }
  return out;
}

export async function generateQuiz(books: QuizBook[], count: number, difficulty: string, instructions: string, previous: string[], research: string): Promise<QuizQuestion[]> {
  const target = Math.min(100, Math.max(1, count));
  const batchCount = target <= 12 ? 2 : target <= 30 ? 3 : target <= 60 ? 4 : 6;
  const perBatch = Math.min(16, Math.ceil(target / batchCount) + 3);
  const recent = previous.slice(-60).join(' | ');
  const promptBase = `You are EDUWILLS Book Intelligence AI. Generate ${perBatch} DIFFERENT multiple-choice questions for these exact saved books: ${books.map(b => `${b.title} by ${b.author}`).join('; ')}. Difficulty: ${difficulty}. ${instructions ? `Student instruction: ${instructions}.` : ''} You have Google Search grounding available and MUST use it when the supplied research is incomplete or the book is obscure. Verify the book, author, characters, events, themes, setting, chronology and other details before writing questions. Never invent quotations, chapters or scenes. Do not confuse similarly named books. Exactly four distinct options and exactly one correct answer. Vary question types across characters, events, chronology, themes, setting, cause/effect, vocabulary, literary devices, inference, author and publication information when supported. A question may return in a later test after a cooling-off period, but do not repeat or closely paraphrase recent questions. Return ONLY valid JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}. Recent questions: ${recent || 'none'}. Supplied research:\n${research || 'No catalogue research was returned; use Google Search grounding.'}`;

  const prompts = Array.from({ length: batchCount }, (_, i) => `${promptBase}\nThis is independent batch ${i + 1} of ${batchCount}. Produce a different set from the other batches.`);
  const calls = prompts.map(async prompt => {
    try {
      return await withTimeout(model.generateContent(prompt), 22000);
    } catch (firstError) {
      return await withTimeout(fallbackModel.generateContent(prompt), 22000).catch(() => { throw firstError; });
    }
  });

  const results = await Promise.allSettled(calls);
  let out: QuizQuestion[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') {
      errors.push(result.reason?.message || 'Gemini request failed');
      continue;
    }
    try {
      const parsed = JSON.parse(result.value.response.text());
      out = out.concat(validate(parsed, previous.concat(out.map(q => q.question)), target - out.length));
    } catch (e: any) {
      errors.push(e?.message || 'Gemini returned invalid JSON');
    }
    if (out.length >= target) break;
  }

  // Never make the learner wait forever or lose the test because one AI request failed.
  // Use deterministic, research-backed questions to fill any remaining slots.
  if (out.length < target) {
    const extra = deterministicFallback(books, research, target - out.length, previous.concat(out.map(q => q.question)));
    out = out.concat(extra);
  }

  if (out.length < target) {
    throw new Error(`EDUWILLS could prepare only ${out.length} of ${target} questions. Gemini may be blocked by Firebase AI Logic/App Check. ${errors[0] || 'Please try again.'}`);
  }
  return out.slice(0, target);
}

export async function explainFailure(book: string, question: string, learnerAnswer: string, correctAnswer: string): Promise<string> {
  const prompt = `Give a short study explanation for this wrong answer. Do not chat or ask follow-up questions. Book: ${book}. Question: ${question}. Learner answer: ${learnerAnswer}. Correct answer: ${correctAnswer}. Include the key reasoning and one memory tip.`;
  try {
    const r = await withTimeout(model.generateContent(prompt), 12000);
    return r.response.text().trim();
  } catch {
    const r = await withTimeout(fallbackModel.generateContent(prompt), 12000);
    return r.response.text().trim();
  }
}
