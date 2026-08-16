import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai';
import app from '@/lib/firebase';

export type QuizBook = { title: string; author: string };
export type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string };

const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash-lite',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: Schema.object({
      properties: {
        questions: Schema.array({
          items: Schema.object({
            properties: {
              question: Schema.string(),
              options: Schema.array({ items: Schema.string() }),
              answer: Schema.number(),
              explanation: Schema.string(),
            },
          }),
        }),
      },
    }),
  },
});

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const fingerprint = (s: string) => normalize(s).replace(/\b(the|a|an|what|which|who|how|why|did|does|is|was|were|of|in|on|to|and|for|from|about|according)\b/g, '').replace(/\s+/g, ' ').trim();
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

async function json(url: string, ms = 4500): Promise<any> {
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
  const accepted: QuizQuestion[] = [];
  for (const item of list) {
    const question = String(item?.question || '').trim();
    const options = Array.isArray(item?.options) ? item.options.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4) : [];
    const answer = Number(item?.answer);
    if (!question || options.length !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) continue;
    const key = fingerprint(question);
    if (!key || recent.has(key) || accepted.some(q => similar(q.question, question))) continue;
    accepted.push({ question, options, answer, explanation: String(item?.explanation || '').trim() });
    recent.add(key);
    if (accepted.length >= target) break;
  }
  return accepted;
}

export async function generateQuiz(books: QuizBook[], count: number, difficulty: string, instructions: string, previous: string[], research: string): Promise<QuizQuestion[]> {
  const target = Math.min(100, Math.max(1, count));
  const batchCount = target <= 12 ? 1 : target <= 30 ? 2 : target <= 60 ? 3 : 5;
  const perBatch = Math.min(22, Math.ceil(target / batchCount) + 4);
  const recent = previous.slice(-60).join(' | ');
  const prompts = Array.from({ length: batchCount }, (_, i) => `You are EDUWILLS Book Intelligence AI, batch ${i + 1} of ${batchCount}. Generate ${perBatch} high-quality multiple-choice study questions about these exact books: ${books.map(b => `${b.title} by ${b.author}`).join('; ')}. Difficulty: ${difficulty}. ${instructions ? `Student instruction: ${instructions}.` : ''} Use only information supported by the research below. Vary the questions across characters, relationships, events, chronology, themes, setting, cause/effect, vocabulary, literary devices, inference, factual details, author and publication information when supported. Do not invent quotations, chapters or scenes. Four plausible options per question, exactly one correct answer. A question may return in a later test after a cooling-off period, but do not copy or closely paraphrase any recent question. Return JSON matching the required schema. Recent questions: ${recent}\nResearch:\n${research}`);
  const results = await Promise.allSettled(prompts.map(prompt => model.generateContent(prompt)));
  const all: QuizQuestion[] = [];
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    let parsed: any = null;
    try { parsed = JSON.parse(result.value.response.text()); } catch { continue; }
    const valid = validate(parsed, previous.concat(all.map(q => q.question)), target - all.length);
    all.push(...valid);
    if (all.length >= target) break;
  }
  if (all.length < target) throw new Error(`EDUWILLS could generate ${all.length} of ${target} reliable questions. Please try again or select another saved book.`);
  return all.slice(0, target);
}

export async function explainFailure(book: string, question: string, learnerAnswer: string, correctAnswer: string): Promise<string> {
  const result = await model.generateContent(`You are EDUWILLS study feedback. Give a short, clear explanation of why a learner's answer was wrong for this multiple-choice question. Do not chat or ask follow-up questions. Mention the key evidence or reasoning and finish with one short memory tip. Book: ${book}. Question: ${question}. Learner answer: ${learnerAnswer}. Correct answer: ${correctAnswer}.`);
  return result.response.text().trim();
}
