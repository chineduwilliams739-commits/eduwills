'use client';

import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app, { auth } from '@/lib/firebase';
import { groundedForBooks, verifiedResearch } from '@/lib/verifiedBookGrounding';

export type QuizBook = { title: string; author: string };
export type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string; evidence?: string };
export type BookSearchResult = { title: string; authors: string[]; source: string };

const BASE = '/eduwills';
const CACHE_VERSION = 'v21-grounded-generator';
const ai = getAI(app, { backend: new GoogleAIBackend() });
const gemini = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash-lite',
  generationConfig: { responseMimeType: 'application/json', temperature: 0.15, maxOutputTokens: 12000 }
});

const norm = (s: string) => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim();
const clean = (s: any) => String(s ?? '').replace(/```(?:json)?/gi, '').replace(/```/g, '').replace(/\\s+/g, ' ').trim();
const fingerprint = (s: string) => norm(s).replace(/\\b(the|a|an|what|which|who|how|why|did|does|is|was|were|of|in|on|to|and|for|from|about|according)\\b/g, '').replace(/\\s+/g, ' ').trim();
const similar = (a: string, b: string) => {
  const x = new Set(fingerprint(a).split(' ').filter(Boolean));
  const y = new Set(fingerprint(b).split(' ').filter(Boolean));
  if (!x.size || !y.size) return false;
  const hit = [...x].filter((v) => y.has(v)).length;
  return hit / Math.max(1, Math.min(x.size, y.size)) >= 0.84;
};
const valid = (q: any): q is QuizQuestion => !!q && typeof q.question === 'string' && q.question.length >= 20 && Array.isArray(q.options) && q.options.length === 4 && q.options.every((x: any) => typeof x === 'string' && x.trim()) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4;
const metadata = (q: QuizQuestion) => /\\b(author|written by|writer|publisher|publication|isbn|edition|published|year of publication)\\b/i.test(q.question);

async function gatewayUrl() {
  try {
    const r = await fetch(`${BASE}/ai-gateway.json?v=21`, { cache: 'no-store' });
    if (!r.ok) return '';
    const d = await r.json();
    return String(d?.url || '').replace(/\\/$/, '');
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
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'quiz', prompt }),
      signal: controller.signal
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(String(d?.error || `AI_GATEWAY_${r.status}`));
    return String(d?.text || '');
  } finally { window.clearTimeout(timer); }
}

async function geminiText(prompt: string, timeout = 60000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      gemini.generateContent(prompt),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeout); })
    ]).then((r: any) => r.response.text());
  } finally { if (timer) clearTimeout(timer); }
}

function parseQuestions(text: string): QuizQuestion[] {
  const raw = String(text || '').trim();
  let data: any;
  try { data = JSON.parse(raw); }
  catch {
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    if (a >= 0 && b > a) data = JSON.parse(raw.slice(a, b + 1));
    else {
      const x = raw.indexOf('[');
      const y = raw.lastIndexOf(']');
      if (x < 0 || y <= x) throw new Error('AI returned unreadable JSON');
      data = JSON.parse(raw.slice(x, y + 1));
    }
  }
  const list = Array.isArray(data) ? data : data?.questions;
  return (Array.isArray(list) ? list : []).map((q: any) => ({
    question: clean(q?.question),
    options: Array.isArray(q?.options) ? q.options.slice(0, 4).map(clean) : [],
    answer: Number(q?.answer),
    explanation: clean(q?.explanation),
    evidence: clean(q?.evidence)
  })).filter(valid);
}

function curatedFor(books: QuizBook[]) {
  return verifiedResearch(books).slice(0, 70000);
}

export async function searchBookAuthors(kind: 'title' | 'author', value: string): Promise<BookSearchResult[]> {
  const q = value.trim();
  if (!q) return [];
  const e = encodeURIComponent(q);
  const urls = kind === 'title'
    ? [`https://openlibrary.org/search.json?title=${e}&limit=50&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=intitle:${e}&maxResults=40`]
    : [`https://openlibrary.org/search.json?author=${e}&limit=50&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=inauthor:${e}&maxResults=40`];
  const out: BookSearchResult[] = [];
  const seen = new Set<string>();
  await Promise.allSettled(urls.map(async (url) => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return;
      const d: any = await r.json();
      for (const x of [...(d.docs || []), ...(d.items || []).map((i: any) => ({ title: i.volumeInfo?.title, author_name: i.volumeInfo?.authors }))]) {
        const title = clean(x.title);
        const authors = Array.isArray(x.author_name) ? x.author_name.map(String) : [];
        if (!title || !authors.length) continue;
        const key = `${norm(title)}|${authors.map(norm).join('|')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ title, authors, source: url.includes('openlibrary') ? 'Open Library' : 'Google Books' });
      }
    } catch {}
  }));
  return out.slice(0, 160);
}

export async function researchBooks(books: QuizBook[]): Promise<string> {
  const verified = curatedFor(books);
  const chunks: string[] = verified ? [verified] : [];
  await Promise.all(books.map(async (book) => {
    const t = encodeURIComponent(book.title);
    const a = encodeURIComponent(book.author);
    const urls = [
      `https://www.googleapis.com/books/v1/volumes?q=intitle:${t}+inauthor:${a}&maxResults=20`,
      `https://openlibrary.org/search.json?title=${t}&author=${a}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`
    ];
    const results = await Promise.allSettled(urls.map((u) => fetch(u, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null)));
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const d: any = result.value;
      for (const x of d.items || []) {
        const v = x.volumeInfo || {};
        if (v.description) chunks.push(`Exact-book catalogue description for ${book.title} by ${book.author}: ${v.description}`);
      }
      for (const x of d.docs || []) {
        if (x.first_sentence) chunks.push(`Exact-book first sentence: ${(x.first_sentence || []).join(' ')}`);
        if (x.subject) chunks.push(`Exact-book subjects: ${(x.subject || []).slice(0, 80).join(', ')}`);
        if (x.description) chunks.push(`Exact-book description: ${typeof x.description === 'string' ? x.description : JSON.stringify(x.description)}`);
      }
    }
  }));
  return chunks.join('\n').slice(0, 90000);
}

function promptFor(book: QuizBook, count: number, difficulty: string, instructions: string, previous: string[], research: string) {
  return `You are EDUWILLS Book Intelligence AI. Generate EXACTLY ${count} factual multiple-choice questions about ONLY this exact book: ${book.title} by ${book.author}.

IDENTITY LOCK: The title and author together define the book. Never substitute another work, adaptation, mythology source, similarly named book, city, person, or general knowledge.

EVIDENCE LOCK: Every question, every option, the correct answer, and the explanation must be supported by the exact-book evidence below. If the evidence does not establish a fact, do not use it. Never infer gender, age, occupation, family role, setting, chronology, relationship, appearance, nationality, or plot events from a name or stereotype.

QUESTION QUALITY: At least 80% must test concrete book content: characters, relationships, events, actions, decisions, settings, prophecy, chronology, causes, consequences, chapter details, or distinctive book-specific facts. Avoid generic questions. Do not ask unsupported city/modern-life questions. Do not ask metadata questions unless explicitly requested.

FORMAT: Return ONLY JSON in this exact shape: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","evidence":"..."}]}. Use exactly four plausible options and one correct answer. answer is zero-based. Do not prefix options with A/B/C/D. Do not duplicate previous questions.

DIFFICULTY: ${difficulty}.
USER INSTRUCTIONS: ${instructions || 'Create a diverse quiz from the actual book content.'}
PREVIOUS QUESTIONS TO AVOID: ${previous.slice(-40).join(' | ')}

VERIFIED EXACT-BOOK EVIDENCE:
${research.slice(0, 65000)}`;
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
    } catch (e) {
      lastError = e;
      try {
        const parsed = parseQuestions(await geminiText(prompt, 60000));
        if (parsed.length) return parsed;
      } catch (fallbackError) { lastError = fallbackError; }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI generation failed');
}

export async function generateQuiz(books: QuizBook[], count: number, difficulty: string, instructions: string, recent: string[] = [], research = ''): Promise<QuizQuestion[]> {
  const requested = Math.min(100, Math.max(1, Number(count) || 10));
  if (!books.length) throw new Error('No book selected.');
  const verified = research || await researchBooks(books);
  const output: QuizQuestion[] = [];
  const seen = new Set(recent.map(fingerprint).filter(Boolean));

  for (const book of books) {
    if (output.length >= requested) break;
    const remaining = requested - output.length;
    const share = Math.min(remaining, Math.max(1, Math.ceil(requested / books.length)));
    const local: QuizQuestion[] = [];
    let guard = 0;
    while (local.length < share && guard < 8) {
      guard++;
      const batch = Math.min(10, share - local.length);
      const questions = await generateBatch(book, batch, difficulty, instructions, [...recent, ...output.map((q) => q.question)], verified);
      let added = 0;
      for (const q of questions) {
        const key = fingerprint(q.question);
        if (!key || seen.has(key) || metadata(q) || local.some((x) => similar(x.question, q.question)) || output.some((x) => similar(x.question, q.question))) continue;
        if (!groundedForBooks([book], q, verified)) continue;
        local.push(q); output.push(q); seen.add(key); added++;
        if (local.length >= share || output.length >= requested) break;
      }
      if (!added) {
        if (guard >= 3) break;
      }
    }
  }

  if (output.length < requested) throw new Error(`AI generated ${output.length} of ${requested} grounded questions. Please try again.`);
  return output.slice(0, requested);
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

export async function explainFailure(book: string, question: string, chosen: string, correct: string) {
  const prompt = `Briefly explain why "${correct}" is correct for this question from ${book}: ${question}. The learner chose: ${chosen}. Use only the stated book context. Plain text only.`;
  try { return clean(await gateway(prompt, 30000)); }
  catch { return `The correct answer is ${correct}. Review the relevant evidence in ${book}.`; }
}

export async function generateRemarks(books: QuizBook[], score: number, total: number, percentage: number, difficulty: string, elapsed: number) {
  const prompt = `Give one short encouraging performance remark for a learner who scored ${score}/${total} (${percentage}%) on a ${difficulty} quiz about ${books.map((b) => `${b.title} by ${b.author}`).join('; ')}. Mention one strength and one next step. Plain text only.`;
  try { return clean(await gateway(prompt, 30000)); }
  catch { return percentage >= 70 ? 'Good work. Your understanding is developing well; review the missed questions and strengthen the details you missed.' : 'Keep going. Review the missed questions and return to the relevant book sections before trying again.'; }
}
