import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import * as stable from './quizAiClientStable';

export * from './quizAiClientStable';

type QuizBook = { title: string; author: string };
type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string; evidence?: string };
type CachedQuestion = QuizQuestion & { bookKey: string };
type GenerationCache = { version: string; key: string; books: QuizBook[]; requested: number; difficulty: string; instructions: string; questions: CachedQuestion[]; updatedAt: number };

const CACHE_VERSION = 'v31-book-intelligence-instructions-cache-first';
const CACHE_PREFIX = 'eduwills_quiz_generation_cache:';
const norm = (v: string) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const bookKey = (b: QuizBook) => `${norm(b.title)}|${norm(b.author)}`;
const cacheKey = (books: QuizBook[], requested: number, difficulty: string, instructions: string) => `${CACHE_PREFIX}${CACHE_VERSION}:${JSON.stringify({ books: books.map(bookKey), requested, difficulty, instructions })}`;
const valid = (q: any): q is QuizQuestion => Boolean(q) && typeof q.question === 'string' && q.question.trim().length >= 20 && Array.isArray(q.options) && q.options.length === 4 && q.options.every((x: any) => typeof x === 'string' && x.trim()) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4;

function readCompleteCache(books: QuizBook[], requested: number, difficulty: string, instructions: string): QuizQuestion[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = cacheKey(books, requested, difficulty, instructions);
    const raw = localStorage.getItem(key); if (!raw) return null;
    const cache = JSON.parse(raw) as GenerationCache;
    if (cache?.version !== CACHE_VERSION || cache.key !== key || !Array.isArray(cache.questions)) return null;
    const allowed = new Set(books.map(bookKey)); const seen = new Set<string>(); const out: QuizQuestion[] = [];
    for (const q of cache.questions) {
      const fp = norm(q.question);
      if (!valid(q) || !allowed.has(q.bookKey) || seen.has(fp)) continue;
      seen.add(fp); out.push({ question: q.question, options: q.options, answer: q.answer, explanation: q.explanation, evidence: q.evidence });
      if (out.length >= requested) return out;
    }
  } catch {}
  return null;
}

function waitForAuthenticatedUser(timeoutMs = 10000) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise<NonNullable<typeof auth.currentUser>>((resolve, reject) => {
    let settled = false; let unsubscribe = () => {};
    const finish = (cb: () => void) => { if (settled) return; settled = true; window.clearTimeout(timer); unsubscribe(); cb(); };
    const timer = window.setTimeout(() => finish(() => reject(new Error('AUTHENTICATION_REQUIRED'))), timeoutMs);
    unsubscribe = onAuthStateChanged(auth, user => { if (user) finish(() => resolve(user)); }, () => finish(() => reject(new Error('AUTHENTICATION_REQUIRED'))));
  });
}

/** Robust book lookup used by the quiz setup UI. Uses multiple independent catalogues. */
export async function searchBookAuthors(kind: 'title' | 'author', value: string): Promise<stable.BookSearchResult[]> {
  const query = value.trim(); if (!query) return [];
  const e = encodeURIComponent(query);
  const urls = kind === 'title'
    ? [`https://openlibrary.org/search.json?title=${e}&limit=50&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=intitle:${e}&maxResults=40`, `https://archive.org/advancedsearch.php?q=title:(${e})&fl[]=title&fl[]=creator&rows=40&page=1&output=json`]
    : [`https://openlibrary.org/search.json?author=${e}&limit=50&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=inauthor:${e}&maxResults=40`, `https://archive.org/advancedsearch.php?q=creator:(${e})&fl[]=title&fl[]=creator&rows=40&page=1&output=json`];
  const out: stable.BookSearchResult[] = []; const seen = new Set<string>();
  await Promise.allSettled(urls.map(async url => {
    try {
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return;
      const d: any = await r.json();
      const rows = [...(d.docs || []), ...(d.items || []).map((x: any) => ({ title: x.volumeInfo?.title, authors: x.volumeInfo?.authors })), ...(d.response?.docs || [])];
      for (const row of rows) {
        const title = String(row?.title || '').trim();
        const raw = row?.author_name ?? row?.authors ?? row?.creator ?? row?.author;
        const authors = Array.isArray(raw) ? raw.map(String).map(x => x.trim()).filter(Boolean) : typeof raw === 'string' ? raw.split(/;|,|\|/).map(x => x.trim()).filter(Boolean) : [];
        if (!title || !authors.length) continue;
        const key = `${norm(title)}|${authors.map(norm).join('|')}`; if (seen.has(key)) continue;
        seen.add(key); out.push({ title, authors, source: url.includes('openlibrary') ? 'Open Library' : url.includes('googleapis') ? 'Google Books' : 'Internet Archive' });
      }
    } catch {}
  }));
  return out.slice(0, 160);
}

/** Broader research layer; the stable generator's verified research remains authoritative. */
export async function researchBooks(books: QuizBook[]): Promise<string> {
  const parts: string[] = [];
  await Promise.all(books.map(async b => {
    const t = encodeURIComponent(b.title), a = encodeURIComponent(b.author);
    const urls = [`https://www.googleapis.com/books/v1/volumes?q=intitle:${t}+inauthor:${a}&maxResults=20`, `https://openlibrary.org/search.json?title=${t}&author=${a}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`, `https://archive.org/advancedsearch.php?q=title:(${t})%20AND%20creator:(${a})&fl[]=title&fl[]=creator&fl[]=description&fl[]=subject&rows=20&page=1&output=json`];
    const rs = await Promise.allSettled(urls.map(u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null)));
    for (const x of rs) {
      if (x.status !== 'fulfilled' || !x.value) continue; const d: any = x.value;
      for (const i of d.items || []) { const v = i.volumeInfo || {}; if (v.description) parts.push(`CATALOGUE DESCRIPTION for ${b.title} by ${b.author}: ${v.description}`); if (v.categories) parts.push(`CATALOGUE SUBJECTS: ${v.categories.join(', ')}`); }
      for (const i of d.docs || []) { if (i.first_sentence) parts.push(`BOOK FIRST SENTENCE: ${(i.first_sentence || []).join(' ')}`); if (i.subject) parts.push(`BOOK SUBJECTS: ${(i.subject || []).slice(0, 80).join(', ')}`); if (i.description) parts.push(`BOOK DESCRIPTION: ${typeof i.description === 'string' ? i.description : JSON.stringify(i.description)}`); }
    }
  }));
  return parts.join('\n').slice(0, 60000);
}

export async function generateQuiz(...args: Parameters<typeof stable.generateQuiz>) {
  const [books, count, difficulty, instructions, recent, research, onPartial] = args as [QuizBook[], number, string, string, string[], string, Parameters<typeof stable.generateQuiz>[6]];
  const requested = Math.min(100, Math.max(1, Number(count) || 10));
  const custom = String(instructions || '').trim();
  const effectiveInstructions = custom
    ? `MANDATORY USER INSTRUCTIONS — FOLLOW THESE EXACTLY: ${custom}. Do not replace, dilute, ignore, or reinterpret these instructions. Make the generated questions visibly reflect them while remaining factual to the selected book(s).`
    : `NO USER INSTRUCTIONS WERE PROVIDED. Create a balanced, varied quiz across the selected book(s), covering characters, relationships, events, chronology, settings, causes and consequences, themes, conflicts, language/style, symbols, decisions, and distinctive details.`;
  const cached = readCompleteCache(books || [], requested, difficulty || 'Mixed', effectiveInstructions);
  if (cached) return cached;
  await waitForAuthenticatedUser();
  return stable.generateQuiz(books, requested, difficulty, effectiveInstructions, recent || [], research || '', onPartial);
}
