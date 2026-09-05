'use client';

import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app, { auth } from '@/lib/firebase';
import { groundedForBooks, verifiedResearch } from '@/lib/verifiedBookGrounding';

export type QuizBook = { title: string; author: string };
export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  evidence?: string;
};
export type BookSearchResult = { title: string; authors: string[]; source: string };

type CachedQuestion = QuizQuestion & { bookKey: string };
type QuizGenerationCache = {
  version: string;
  key: string;
  books: QuizBook[];
  requested: number;
  difficulty: string;
  instructions: string;
  questions: CachedQuestion[];
  updatedAt: number;
};

const BASE = '/eduwills';
const CACHE_VERSION = 'v30-explanation-timer-gateway-first';
const CACHE_PREFIX = 'eduwills_quiz_generation_cache:';

const ai = getAI(app, { backend: new GoogleAIBackend() });
const gemini = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash-lite',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.1,
    maxOutputTokens: 12000,
  },
});

const norm = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clean = (value: unknown) =>
  String(value ?? '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const fingerprint = (value: string) =>
  norm(value)
    .replace(/\b(the|a|an|what|which|who|how|why|did|does|is|was|were|of|in|on|to|and|for|from|about|according)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const similar = (a: string, b: string) => {
  const x = new Set(fingerprint(a).split(' ').filter(Boolean));
  const y = new Set(fingerprint(b).split(' ').filter(Boolean));
  if (!x.size || !y.size) return false;
  const hit = [...x].filter((word) => y.has(word)).length;
  return hit / Math.max(1, Math.min(x.size, y.size)) >= 0.84;
};

const valid = (q: unknown): q is QuizQuestion => {
  const value = q as Partial<QuizQuestion> | null;
  return Boolean(value)
    && typeof value.question === 'string'
    && value.question.trim().length >= 20
    && Array.isArray(value.options)
    && value.options.length === 4
    && value.options.every((option) => typeof option === 'string' && option.trim())
    && Number.isInteger(value.answer)
    && Number(value.answer) >= 0
    && Number(value.answer) < 4;
};

const metadata = (q: QuizQuestion) =>
  /\b(author|written by|writer|publisher|publication|isbn|edition|published|year of publication)\b/i.test(q.question);

const bookKey = (book: QuizBook) => `${norm(book.title)}|${norm(book.author)}`;

function generationCacheKey(books: QuizBook[], requested: number, difficulty: string, instructions: string) {
  return `${CACHE_PREFIX}${CACHE_VERSION}:${JSON.stringify({
    books: books.map((book) => bookKey(book)), requested, difficulty, instructions,
  })}`;
}

function readGenerationCache(key: string): QuizGenerationCache | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as QuizGenerationCache;
    if (!value || value.version !== CACHE_VERSION || value.key !== key || !Array.isArray(value.questions)) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch { return null; }
}

function writeGenerationCache(cache: QuizGenerationCache) {
  try { localStorage.setItem(cache.key, JSON.stringify(cache)); } catch {}
}

function clearGenerationCache(key: string) {
  try { localStorage.removeItem(key); } catch {}
}

async function gatewayUrl() {
  try {
    const response = await fetch(`${BASE}/ai-gateway.json?v=30`, { cache: 'no-store' });
    if (!response.ok) return '';
    const data = await response.json();
    return String(data?.url || '').replace(/\/$/, '');
  } catch { return ''; }
}

async function gateway(prompt: string, timeout = 60000) {
  const url = await gatewayUrl();
  const user = auth.currentUser;
  if (!url) throw new Error('AI_GATEWAY_NOT_CONFIGURED');
  if (!user) throw new Error('AUTHENTICATION_REQUIRED');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'quiz', prompt }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data?.error || data?.message || '').trim();
      throw new Error(`AI_GATEWAY_${response.status}${detail ? `: ${detail}` : ''}`);
    }
    return String(data?.text || '');
  } finally { window.clearTimeout(timer); }
}

async function geminiText(prompt: string, timeout = 60000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      gemini.generateContent(prompt),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeout);
      }),
    ]).then((result: any) => result.response.text());
  } finally { if (timer) clearTimeout(timer); }
}

function parseQuestions(text: string): QuizQuestion[] {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('AI returned an empty response');
  let data: any;
  try { data = JSON.parse(raw); } catch {
    const objectStart = raw.indexOf('{');
    const objectEnd = raw.lastIndexOf('}');
    const arrayStart = raw.indexOf('[');
    const arrayEnd = raw.lastIndexOf(']');
    try {
      if (objectStart >= 0 && objectEnd > objectStart) data = JSON.parse(raw.slice(objectStart, objectEnd + 1));
      else if (arrayStart >= 0 && arrayEnd > arrayStart) data = JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
      else throw new Error('AI returned unreadable JSON');
    } catch { throw new Error('AI returned unreadable JSON'); }
  }
  const list = Array.isArray(data) ? data : data?.questions;
  return (Array.isArray(list) ? list : [])
    .map((item: any) => ({
      question: clean(item?.question),
      options: Array.isArray(item?.options) ? item.options.slice(0, 4).map(clean) : [],
      answer: Number(item?.answer),
      explanation: clean(item?.explanation),
      evidence: clean(item?.evidence),
    }))
    .filter(valid);
}

function curatedFor(books: QuizBook[]) { return verifiedResearch(books).slice(0, 70000); }

export async function searchBookAuthors(kind: 'title' | 'author', value: string): Promise<BookSearchResult[]> {
  const query = value.trim();
  if (!query) return [];
  const encoded = encodeURIComponent(query);
  const urls = kind === 'title'
    ? [`https://openlibrary.org/search.json?title=${encoded}&limit=50&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=intitle:${encoded}&maxResults=40`]
    : [`https://openlibrary.org/search.json?author=${encoded}&limit=50&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=inauthor:${encoded}&maxResults=40`];
  const output: BookSearchResult[] = [];
  const seen = new Set<string>();
  await Promise.allSettled(urls.map(async (url) => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return;
      const data: any = await response.json();
      const rows = [...(data.docs || []), ...(data.items || []).map((item: any) => ({ title: item.volumeInfo?.title, author_name: item.volumeInfo?.authors }))];
      for (const row of rows) {
        const title = clean(row?.title);
        const authors = Array.isArray(row?.author_name) ? row.author_name.map(String) : [];
        if (!title || !authors.length) continue;
        const key = `${norm(title)}|${authors.map(norm).join('|')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        output.push({ title, authors, source: url.includes('openlibrary') ? 'Open Library' : 'Google Books' });
      }
    } catch {}
  }));
  return output.slice(0, 160);
}

export async function researchBooks(books: QuizBook[]): Promise<string> {
  if (!books.length) return '';
  const curated = curatedFor(books);
  const chunks: string[] = curated ? [curated] : [];
  await Promise.all(books.map(async (book) => {
    const title = encodeURIComponent(book.title);
    const author = encodeURIComponent(book.author);
    const urls = [
      `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}+inauthor:${author}&maxResults=20`,
      `https://openlibrary.org/search.json?title=${title}&author=${author}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`,
    ];
    const results = await Promise.allSettled(urls.map((url) => fetch(url, { cache: 'no-store' }).then((response) => response.ok ? response.json() : null)));
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const data: any = result.value;
      for (const item of data.items || []) {
        const info = item.volumeInfo || {};
        if (info.description) chunks.push(`Exact-book catalogue description for ${book.title} by ${book.author}: ${info.description}`);
      }
      for (const item of data.docs || []) {
        if (item.first_sentence) chunks.push(`Exact-book first sentence: ${(item.first_sentence || []).join(' ')}`);
        if (item.subject) chunks.push(`Exact-book subjects: ${(item.subject || []).slice(0, 80).join(', ')}`);
        if (item.description) chunks.push(`Exact-book description: ${typeof item.description === 'string' ? item.description : JSON.stringify(item.description)}`);
      }
    }
  }));
  return chunks.join('\n').slice(0, 90000);
}

function promptFor(book: QuizBook, count: number, difficulty: string, instructions: string, previous: string[], research: string) {
  return `You are EDUWILLS Book Intelligence AI.\n\nGenerate EXACTLY ${count} factual multiple-choice questions about ONLY this exact book: ${book.title} by ${book.author}.\n\nIDENTITY LOCK: The title and author together identify the book. Never substitute another work, adaptation, mythology source, similarly named book, city, person, or general knowledge.\n\nEVIDENCE LOCK: Every question, every option, the correct answer, and the explanation must be supported by the exact-book evidence below. If the evidence does not establish a fact, do not use it. Never infer gender, age, occupation, family role, setting, chronology, relationship, appearance, nationality, or plot events from a name or stereotype.\n\nQUESTION QUALITY: At least 80% must test concrete book content: characters, relationships, events, actions, decisions, settings, chronology, causes, consequences, chapter details, or distinctive book-specific facts. Avoid generic questions. Do not ask unsupported modern-life or city questions. Do not ask metadata questions unless explicitly requested.\n\nFORMAT: Return ONLY valid JSON in this exact shape: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","evidence":"..."}]}. Use exactly four plausible options and one correct answer. answer is zero-based. Do not prefix options with A/B/C/D. Do not include markdown. Do not duplicate previous questions.\n\nDIFFICULTY: ${difficulty}.\nUSER INSTRUCTIONS: ${instructions || 'Create a diverse quiz from the actual book content.'}\nPREVIOUS QUESTIONS TO AVOID: ${previous.slice(-40).join(' | ')}\n\nVERIFIED EXACT-BOOK EVIDENCE:\n${research.slice(0, 65000)}`;
}

async function generateBatch(book: QuizBook, count: number, difficulty: string, instructions: string, previous: string[], research: string) {
  const prompt = promptFor(book, count, difficulty, instructions, previous, research);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await gateway(prompt, 60000);
      const parsed = parseQuestions(text);
      if (parsed.length) return parsed;
      lastError = new Error('Gateway returned no valid questions');
    } catch (error) {
      lastError = error;
      try {
        const fallbackText = await geminiText(prompt, 60000);
        const parsed = parseQuestions(fallbackText);
        if (parsed.length) return parsed;
      } catch (fallbackError) { lastError = fallbackError; }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI generation failed');
}

export async function generateQuiz(books: QuizBook[], count: number, difficulty: string, instructions: string, recent: string[] = [], _research = '', onPartial?: (question: QuizQuestion, book: QuizBook, completed: number, requested: number) => void): Promise<QuizQuestion[]> {
  const requested = Math.min(100, Math.max(1, Number(count) || 10));
  if (!books.length) throw new Error('No book selected.');
  const cacheKey = generationCacheKey(books, requested, difficulty, instructions);
  const cached = readGenerationCache(cacheKey);
  const cachedQuestions = cached?.questions || [];
  const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book])));
  const output: QuizQuestion[] = [];
  const seen = new Set(recent.map(fingerprint).filter(Boolean));

  for (const cachedQuestion of cachedQuestions) {
    if (!valid(cachedQuestion)) continue;
    const matchingBook = books.find((book) => bookKey(book) === cachedQuestion.bookKey);
    if (!matchingBook) continue;
    const evidence = evidenceByBook[books.indexOf(matchingBook)] || '';
    if (!evidence.trim() || metadata(cachedQuestion)) continue;
    if (!groundedForBooks([matchingBook], cachedQuestion, evidence)) continue;
    const key = fingerprint(cachedQuestion.question);
    if (!key || seen.has(key) || output.some((item) => similar(item.question, cachedQuestion.question))) continue;
    output.push({ question: cachedQuestion.question, options: cachedQuestion.options, answer: cachedQuestion.answer, explanation: cachedQuestion.explanation, evidence: cachedQuestion.evidence });
    seen.add(key);
    if (output.length >= requested) break;
  }

  const cacheState: QuizGenerationCache = { version: CACHE_VERSION, key: cacheKey, books, requested, difficulty, instructions, questions: cachedQuestions.filter((q) => valid(q)), updatedAt: Date.now() };
  cacheState.questions = output.map((question) => {
    const source = cachedQuestions.find((q) => fingerprint(q.question) === fingerprint(question.question));
    return { ...question, bookKey: source?.bookKey || bookKey(books.find((book) => groundedForBooks([book], question, evidenceByBook[books.indexOf(book)] || '')) || books[0]) };
  });
  writeGenerationCache(cacheState);

  const baseQuota = Math.floor(requested / books.length);
  let remainder = requested % books.length;
  for (let bookIndex = 0; bookIndex < books.length; bookIndex++) {
    const book = books[bookIndex];
    const share = baseQuota + (remainder-- > 0 ? 1 : 0);
    if (share <= 0) continue;
    const evidence = evidenceByBook[bookIndex] || '';
    if (!evidence.trim()) throw new Error(`No verified evidence was found for ${book.title} by ${book.author}.`);
    const local = output.filter((question) => {
      const cachedQuestion = cachedQuestions.find((item) => fingerprint(item.question) === fingerprint(question.question));
      return cachedQuestion?.bookKey === bookKey(book);
    });
    let guard = 0;
    while (local.length < share && guard < 8) {
      guard += 1;
      const batchSize = Math.min(10, share - local.length);
      const questions = await generateBatch(book, batchSize, difficulty, instructions, [...recent, ...output.map((question) => question.question)], evidence);
      let added = 0;
      for (const question of questions) {
        const key = fingerprint(question.question);
        if (!key || seen.has(key) || metadata(question) || local.some((item) => similar(item.question, question.question)) || output.some((item) => similar(item.question, question.question))) continue;
        if (!groundedForBooks([book], question, evidence)) continue;
        local.push(question); output.push(question); seen.add(key); added += 1;
        cacheState.questions.push({ ...question, bookKey: bookKey(book) });
        cacheState.updatedAt = Date.now(); writeGenerationCache(cacheState);
        onPartial?.(question, book, output.length, requested);
        if (local.length >= share || output.length >= requested) break;
      }
      if (!added && guard >= 3) break;
    }
    if (local.length < share) throw new Error(`AI generated ${output.length} of ${requested} grounded questions so far; ${book.title} by ${book.author} still needs ${share - local.length}. Please retry to resume.`);
  }
  const finalOutput = output.slice(0, requested);
  clearGenerationCache(cacheKey);
  return finalOutput;
}

export async function askEduwills(prompt: string, history: string[] = []) {
  const conversation = [...history.slice(-8), `Learner: ${prompt}`].join('\n');
  const instruction = `You are EDUWILLS AI, a study assistant. Answer directly and accurately. If the learner asks about a specific book and the evidence is insufficient, say so instead of inventing details. Plain readable text only. Conversation:\n${conversation}`;
  try { return clean(await gateway(instruction, 30000)); }
  catch {
    try { return clean(await geminiText(instruction, 30000)); }
    catch { return 'EDUWILLS AI is temporarily busy. Please try again in a moment.'; }
  }
}

function readableExplanation(raw: unknown, correct: string, book: string) {
  const fallback = `The correct answer is "${correct}". Review the relevant section of ${book} and the evidence provided for this question.`;
  let value = clean(raw);
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string') value = clean(parsed);
    else if (parsed && typeof parsed === 'object') {
      const candidate = parsed.explanation ?? parsed.text ?? parsed.message ?? parsed.content;
      value = typeof candidate === 'string' ? clean(candidate) : '';
    } else value = '';
  } catch {}
  if (!value || value === '{}' || value === '[]' || value === '""') return fallback;
  return value;
}

export async function explainFailure(book: string, question: string, chosen: string, correct: string) {
  const prompt = `Briefly explain why "${correct}" is correct for this question from ${book}: ${question}. The learner chose: ${chosen}. Use only the stated book context. Return ONLY a short plain-text explanation. Do not return JSON, objects, arrays, code fences, or an empty string.`;
  try {
    return readableExplanation(await gateway(prompt, 30000), correct, book);
  } catch {
    return readableExplanation('', correct, book);
  }
}

export async function generateRemarks(books: QuizBook[], score: number, total: number, percentage: number, difficulty: string, elapsed: number) {
  const prompt = `Give one short encouraging performance remark for a learner who scored ${score}/${total} (${percentage}%) on a ${difficulty} quiz about ${books.map((book) => `${book.title} by ${book.author}`).join('; ')}. Mention one strength and one next step. Plain text only.`;
  try { return clean(await gateway(prompt, 30000)); }
  catch {
    return percentage >= 70
      ? 'Good work. Your understanding is developing well; review the missed questions and strengthen the details you missed.'
      : 'Keep going. Review the missed questions and return to the relevant book sections before trying again.';
  }
}