import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import * as stable from './quizAiClientStable';

export * from './quizAiClientStable';

type QuizBook = { title: string; author: string };
type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string; evidence?: string };
type CachedQuestion = QuizQuestion & { bookKey: string };
type GenerationCache = { version: string; key: string; books: QuizBook[]; requested: number; difficulty: string; instructions: string; questions: CachedQuestion[]; updatedAt: number };

const CACHE_VERSION = 'v33-strict-instruction-adaptive-refill';
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
    ? `MANDATORY USER INSTRUCTIONS — FOLLOW THESE EXACTLY: ${custom}. Do not replace, dilute, ignore, or reinterpret these instructions. Make the generated questions visibly reflect them while remaining factual to the selected book(s). If reliable evidence supports only part of the requested focus, generate only that supported instruction-focused portion first; then fill the remaining slots with varied, random, well-grounded questions from the selected book(s). Never invent missing facts just to satisfy an instruction.`
    : `NO USER INSTRUCTIONS WERE PROVIDED. Create a balanced, varied quiz across the selected book(s), covering characters, relationships, events, chronology, settings, causes and consequences, themes, conflicts, language/style, symbols, decisions, and distinctive details.`;
  const cached = readCompleteCache(books || [], requested, difficulty || 'Mixed', effectiveInstructions);
  if (cached) return cached;
  await waitForAuthenticatedUser();

  const partial: QuizQuestion[] = [];
  const partialBooks = new Map<string, QuizBook>();
  const capture = (question: QuizQuestion, book: QuizBook, completed: number, total: number) => {
    if (!valid(question)) return;
    if (!partial.some(existing => norm(existing.question) === norm(question.question))) partial.push(question);
    partialBooks.set(norm(question.question), book);
    onPartial?.(question, book, completed, total);
  };

  try {
    return await stable.generateQuiz(books, requested, difficulty, effectiveInstructions, recent || [], research || '', capture);
  } catch (error) {
    const message = String((error as Error)?.message || error || '');
    const partialMatch = message.match(/AI generated (\d+) of (\d+)/i);
    if (!custom || !partialMatch) throw error;
    const completed = Math.min(requested, partial.length);
    if (completed >= requested) return partial.slice(0, requested);

    const remaining = requested - completed;
    const fallbackInstructions = `FALLBACK MODE. The user's requested focus was: ${custom}. Generate exactly ${remaining} additional questions that are NOT already represented in the supplied partial set. Reliable evidence was insufficient to produce all remaining instruction-focused questions, so these remaining questions must be randomly selected from different well-grounded aspects of the selected book(s): characters, relationships, events, chronology, setting, causes, consequences, themes, conflicts, decisions, language/style, symbols, chapters, and distinctive details. Do not invent facts. Do not repeat the partial questions. The fallback is only for the remaining ${remaining} questions; do not try to force the original instruction when the evidence is insufficient.`;
    const fallbackRecent = [...(recent || []), ...partial.map(q => q.question)];
    const fallback = await stable.generateQuiz(books, remaining, difficulty, fallbackInstructions, fallbackRecent, research || '', (q, b, c, t) => {
      capture(q, b, completed + c, requested);
    });
    return [...partial, ...fallback].slice(0, requested);
  }
}

function stripMarkup(value: string) { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }

async function fetchJson(url: string, timeoutMs = 6500): Promise<any | null> {
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try { const response = await fetch(url, { cache: 'no-store', signal: controller.signal }); return response.ok ? await response.json() : null; }
  catch { return null; } finally { window.clearTimeout(timer); }
}

async function fetchText(url: string, timeoutMs = 6500): Promise<string> {
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try { const response = await fetch(url, { cache: 'no-store', signal: controller.signal }); return response.ok ? await response.text() : ''; }
  catch { return ''; } finally { window.clearTimeout(timer); }
}

async function researchInternet(query: string): Promise<string> {
  const q = query.trim(); if (!q) return '';
  const e = encodeURIComponent(q);
  const [wiki, books, library, archive, news] = await Promise.all([
    fetchJson(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${e}&limit=5`),
    fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${e}&maxResults=8`),
    fetchJson(`https://openlibrary.org/search.json?q=${e}&limit=8&fields=title,author_name,first_publish_year,subject,description`),
    fetchJson(`https://archive.org/advancedsearch.php?q=${e}&fl[]=title&fl[]=creator&fl[]=description&fl[]=date&rows=8&page=1&output=json`),
    fetchText(`https://news.google.com/rss/search?q=${e}&hl=en-US&gl=US&ceid=US:en`),
  ]);
  const chunks: string[] = [];
  for (const row of wiki?.pages || []) chunks.push(`WIKIPEDIA: ${stripMarkup(row?.title || '')} — ${stripMarkup(row?.excerpt || row?.description || '')}`);
  for (const item of books?.items || []) { const v = item.volumeInfo || {}; chunks.push(`GOOGLE BOOKS: ${v.title || ''} by ${(v.authors || []).join(', ')} — ${stripMarkup(v.description || '')}`); }
  for (const item of library?.docs || []) chunks.push(`OPEN LIBRARY: ${item.title || ''} by ${(item.author_name || []).join(', ')} — ${stripMarkup(item.description || '')}; subjects: ${(item.subject || []).slice(0, 12).join(', ')}`);
  for (const item of archive?.response?.docs || []) chunks.push(`INTERNET ARCHIVE: ${item.title || ''} — ${(item.creator || []).toString()} — ${stripMarkup(item.description || '')}`);
  if (news) {
    const matches = [...news.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8);
    for (const match of matches) { const title = match[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''; const description = match[1].match(/<description>([\s\S]*?)<\/description>/i)?.[1] || ''; chunks.push(`GOOGLE NEWS: ${stripMarkup(title)} — ${stripMarkup(description)}`); }
  }
  const lower = q.toLowerCase();
  if (/\b(tiktok|facebook|instagram|meta)\b/.test(lower)) {
    chunks.push('SOCIAL-SOURCE NOTE: Public social-network data may require the platform approved API and credentials. Do not claim a social post, follower count, video, comment, or profile fact unless retrieved from an authorized public source.');
    if (lower.includes('tiktok')) chunks.push('TIKTOK: EDUWILLS can integrate TikTok Research API data when an approved research client is available; current TikTok documentation requires an approved project for Research API access.');
  }
  return chunks.filter(Boolean).join('\n').slice(0, 14000);
}

export async function askEduwills(prompt: string, history: string[] = []) {
  const conversation = [...history.slice(-8), `Learner: ${prompt}`].join('\n');
  const research = await researchInternet(prompt);
  const instruction = `You are EDUWILLS AI, a general educational and knowledge assistant. Answer the learner's actual question, not a generic version of it. You can answer schoolwork, books, explanations, reasoning, writing, calculations, and current/general-knowledge questions.\n\nWEB RESEARCH RULES:\n- Use the supplied research evidence when relevant.\n- Treat retrieved web material as evidence, not unquestionable truth; cross-check conflicting claims and state uncertainty.\n- Never invent a source, quote, social-media post, statistic, person, or event.\n- Do not claim to have accessed private, login-gated, deleted, or restricted content.\n- For current or time-sensitive facts, prefer dated/recent evidence and explicitly say when the evidence is incomplete.\n- If the learner asks about TikTok, Facebook/Meta, Instagram, or another social platform, only state platform-specific facts actually supported by retrieved public/authorized data.\n- If the available research is insufficient, say what is unknown and answer only the supported part.\n\nRETRIEVED PUBLIC RESEARCH:\n${research || 'No external research result was available for this query. Do not pretend that web research was performed successfully.'}\n\nCONVERSATION:\n${conversation}`;
  try { return stripMarkup(await stable.askEduwills(instruction, [])); }
  catch { return 'EDUWILLS AI is temporarily busy. Please try again in a moment.'; }
}
