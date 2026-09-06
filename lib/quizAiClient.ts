import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import * as stable from './quizAiClientStable';

export * from './quizAiClientStable';

type QuizBook = { title: string; author: string };
type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string; evidence?: string };
type CachedQuestion = QuizQuestion & { bookKey: string };
type GenerationCache = {
  version: string;
  key: string;
  books: QuizBook[];
  requested: number;
  difficulty: string;
  instructions: string;
  questions: CachedQuestion[];
  updatedAt: number;
};

const CACHE_VERSION = 'v30-explanation-timer-gateway-first';
const CACHE_PREFIX = 'eduwills_quiz_generation_cache:';

const norm = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const bookKey = (book: QuizBook) => `${norm(book.title)}|${norm(book.author)}`;

function generationCacheKey(books: QuizBook[], requested: number, difficulty: string, instructions: string) {
  return `${CACHE_PREFIX}${CACHE_VERSION}:${JSON.stringify({
    books: books.map(bookKey), requested, difficulty, instructions,
  })}`;
}

function validQuestion(value: unknown): value is QuizQuestion {
  const q = value as Partial<QuizQuestion> | null;
  return Boolean(q)
    && typeof q.question === 'string'
    && q.question.trim().length >= 20
    && Array.isArray(q.options)
    && q.options.length === 4
    && q.options.every((option) => typeof option === 'string' && option.trim())
    && Number.isInteger(q.answer)
    && Number(q.answer) >= 0
    && Number(q.answer) < 4;
}

/**
 * Fast path: the generation cache lives in localStorage and is backed by the
 * existing Firestore persistent cache for the app's normal data flows.
 *
 * Most importantly, this check happens BEFORE research, gateway, Gemini, or
 * any other network request. A complete cached quiz is therefore effectively
 * instantaneous and consumes zero AI calls.
 */
function readCompleteGenerationCache(
  books: QuizBook[],
  requested: number,
  difficulty: string,
  instructions: string,
): QuizQuestion[] | null {
  if (typeof window === 'undefined') return null;

  const key = generationCacheKey(books, requested, difficulty, instructions);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const cache = JSON.parse(raw) as GenerationCache;
    if (!cache
      || cache.version !== CACHE_VERSION
      || cache.key !== key
      || !Array.isArray(cache.questions)
      || cache.questions.length < requested) {
      return null;
    }

    const allowedBooks = new Set(books.map(bookKey));
    const questions: QuizQuestion[] = [];
    const seen = new Set<string>();

    for (const cached of cache.questions) {
      if (!validQuestion(cached) || !allowedBooks.has(cached.bookKey)) continue;
      const fingerprint = norm(cached.question);
      if (!fingerprint || seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      questions.push({
        question: cached.question,
        options: cached.options,
        answer: cached.answer,
        explanation: cached.explanation,
        evidence: cached.evidence,
      });
      if (questions.length >= requested) return questions;
    }
  } catch {
    // A corrupt cache must never prevent normal generation.
  }

  return null;
}

function waitForAuthenticatedUser(timeoutMs = 10000) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise<NonNullable<typeof auth.currentUser>>((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      callback();
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error('AUTHENTICATION_REQUIRED')));
    }, timeoutMs);

    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        finish(() => resolve(user));
      }
    }, () => {
      finish(() => reject(new Error('AUTHENTICATION_REQUIRED')));
    });
  });
}

export async function generateQuiz(
  ...args: Parameters<typeof stable.generateQuiz>
) {
  // args: books, count, difficulty, instructions, recent, research, onPartial
  // The cache lookup intentionally happens before authentication/network work
  // so a previously completed quiz can be reopened even during a brief outage.
  const [books, count, difficulty, instructions] = args as [QuizBook[], number, string, string];
  const requested = Math.min(100, Math.max(1, Number(count) || 10));
  const cached = readCompleteGenerationCache(books || [], requested, difficulty || 'Mixed', instructions || '');
  if (cached) return cached;

  await waitForAuthenticatedUser();
  return stable.generateQuiz(...args);
}
