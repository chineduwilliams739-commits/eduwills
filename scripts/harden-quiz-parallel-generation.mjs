import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

const cacheHelpersMarker = 'const QUIZ_BATCH_CONCURRENCY = 4;';
const cacheHelpers = `const QUESTION_BANK_VERSION = 'v1';
const QUESTION_BANK_PREFIX = 'eduwills_quiz_question_bank:';
const QUESTION_BANK_MAX = 1200;

function questionBankKey(book: QuizBook) {
  return QUESTION_BANK_PREFIX + QUESTION_BANK_VERSION + ':' + bookKey(book);
}

function readQuestionBank(book: QuizBook): CachedQuestion[] {
  try {
    const raw = localStorage.getItem(questionBankKey(book));
    if (!raw) return [];
    const value = JSON.parse(raw);
    if (!value || value.version !== QUESTION_BANK_VERSION || !Array.isArray(value.questions)) return [];
    return value.questions.filter((question: unknown) => valid(question)).slice(-QUESTION_BANK_MAX);
  } catch {
    return [];
  }
}

function writeQuestionBank(book: QuizBook, questions: CachedQuestion[]) {
  try {
    const unique: CachedQuestion[] = [];
    const seen = new Set<string>();
    for (const question of questions) {
      if (!valid(question)) continue;
      const key = fingerprint(question.question);
      if (!key || seen.has(key)) continue;
      if (unique.some((item) => similar(item.question, question.question))) continue;
      seen.add(key);
      unique.push({ ...question, bookKey: bookKey(book) });
    }
    localStorage.setItem(questionBankKey(book), JSON.stringify({
      version: QUESTION_BANK_VERSION,
      book: { title: book.title, author: book.author },
      questions: unique.slice(-QUESTION_BANK_MAX),
      updatedAt: Date.now(),
    }));
  } catch {
    // Question-bank caching is an optimization; storage failure must never stop a quiz.
  }
}

function questionBankFallback(book: QuizBook, count: number, previous: string[]) {
  const bank = readQuestionBank(book);
  const blocked = new Set(previous.map(fingerprint).filter(Boolean));
  const output: QuizQuestion[] = [];
  for (const cached of bank) {
    if (!valid(cached) || blocked.has(fingerprint(cached.question))) continue;
    if (output.some((item) => similar(item.question, cached.question))) continue;
    output.push(cached);
    if (output.length >= count) break;
  }
  return output;
}

const QUIZ_BATCH_CONCURRENCY = 4;`;

if (!source.includes('const QUESTION_BANK_VERSION')) {
  source = source.replace(cacheHelpersMarker, cacheHelpers);
}

const start = source.indexOf('async function generateBatch(');
const end = source.indexOf('\n\nexport async function generateQuiz(', start);
if (start < 0 || end < 0) throw new Error('Could not locate quiz batch function safely.');

const batch = `const QUIZ_BATCH_SIZE = 8;
const QUIZ_PROVIDER_TIMEOUT = 15000;

async function generateBatch(
  book: QuizBook,
  count: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  const safeCount = Math.min(QUIZ_BATCH_SIZE, Math.max(1, count));
  const prompt = promptFor(book, safeCount, difficulty, instructions, previous, research);
  let gatewayError: unknown;

  // The Cloudflare AI gateway owns provider failover (Groq -> OpenRouter).
  // Do not fall back to browser-side Firebase Gemini here: its free quota can be
  // exhausted independently and caused otherwise healthy quiz runs to stop.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await gateway(prompt, QUIZ_PROVIDER_TIMEOUT);
      const parsed = parseQuestions(text);
      if (parsed.length) return parsed;
      gatewayError = new Error('Gateway returned no valid questions');
    } catch (error) {
      gatewayError = error;
      if (attempt === 0 && /AI_GATEWAY_(408|429|500|502|503|504)/i.test(String(error instanceof Error ? error.message : error))) {
        continue;
      }
      break;
    }
  }

  // If providers are exhausted, reuse validated questions already stored for this book.
  const localFallback = questionBankFallback(book, safeCount, previous);
  if (localFallback.length) return localFallback;

  const describe = (error: unknown) => error instanceof Error ? error.message : String(error || 'unknown error');
  throw new Error('AI_GENERATION_FAILED: gateway=' + describe(gatewayError));
}

async function generateParallelBatches(
  book: QuizBook,
  needed: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  const results: QuizQuestion[][] = [];
  let remaining = needed;

  while (remaining > 0) {
    const waveCount = Math.min(QUIZ_BATCH_CONCURRENCY, Math.ceil(remaining / QUIZ_BATCH_SIZE));
    const jobs = Array.from({ length: waveCount }, (_, index) => {
      const count = Math.min(QUIZ_BATCH_SIZE, remaining - index * QUIZ_BATCH_SIZE);
      return generateBatch(book, count, difficulty, instructions, previous, research);
    });

    const settled = await Promise.allSettled(jobs);
    const quotaError = settled.find((result) =>
      result.status === 'rejected' && /429|quota|resource_exhausted|rate.?limit|AI_QUOTA_EXHAUSTED/i.test(String(result.reason?.message || result.reason || ''))
    );
    if (quotaError?.status === 'rejected') {
      const message = String(quotaError.reason?.message || quotaError.reason || 'AI quota exceeded');
      throw new Error('AI_QUOTA_EXHAUSTED: ' + message);
    }

    const wave: QuizQuestion[] = [];
    const waveSeen = new Set<string>();
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const question of result.value) {
        const key = fingerprint(question.question);
        if (!key || waveSeen.has(key)) continue;
        if (wave.some((item) => similar(item.question, question.question))) continue;
        waveSeen.add(key);
        wave.push(question);
      }
    }

    if (!wave.length) break;
    results.push(wave);
    remaining = Math.max(0, needed - results.flat().length);
    if (remaining === 0) break;

    previous = [...previous, ...wave.map((question) => question.question)].slice(-100);
  }

  return results.flat();
}`;
source = source.slice(0, start) + batch + source.slice(end);

const loopStart = source.indexOf('    const needed = share - local.length;');
const loopEnd = source.indexOf('\n    if (local.length < share) {', loopStart);
if (loopStart < 0 || loopEnd < 0) throw new Error('Could not locate parallel quiz generation loop safely.');

const parallelLoop = `    const needed = share - local.length;
    const questions = await generateParallelBatches(
      book,
      needed,
      difficulty,
      instructions,
      [...recent, ...output.map((question) => question.question)],
      evidence,
    );

    for (const question of questions) {
      const key = fingerprint(question.question);
      if (!key || seen.has(key)) continue;
      if (metadata(question)) continue;
      if (local.some((item) => similar(item.question, question.question))) continue;
      if (output.some((item) => similar(item.question, question.question))) continue;
      if (!groundedForBooks([book], question, evidence)) continue;

      local.push(question);
      output.push(question);
      seen.add(key);

      cacheState.questions.push({ ...question, bookKey: bookKey(book) });
      cacheState.updatedAt = Date.now();
      writeGenerationCache(cacheState);

      // Every validated question becomes reusable book-specific cache. A later quiz
      // can use this bank even when Groq/OpenRouter quotas are exhausted.
      const bank = readQuestionBank(book);
      writeQuestionBank(book, [...bank, { ...question, bookKey: bookKey(book) }]);
      onPartial?.(question, book, output.length, requested);

      if (local.length >= share || output.length >= requested) break;
    }
`;
source = source.slice(0, loopStart) + parallelLoop + source.slice(loopEnd);

// Use the reusable question bank before any provider call. This is deliberately
// separate from the resumable generation cache, so successful questions survive
// completed quizzes and cache-version changes.
const bankInsert = `  const bankQuestions = books.flatMap((book) => readQuestionBank(book));
  for (const cachedQuestion of bankQuestions) {
    if (!valid(cachedQuestion)) continue;
    const matchingBook = books.find((book) => bookKey(book) === cachedQuestion.bookKey);
    if (!matchingBook) continue;
    const evidence = evidenceByBook[books.indexOf(matchingBook)] || '';
    if (metadata(cachedQuestion)) continue;
    if (evidence.trim() && !groundedForBooks([matchingBook], cachedQuestion, evidence)) continue;
    const key = fingerprint(cachedQuestion.question);
    if (!key || seen.has(key)) continue;
    if (output.some((item) => similar(item.question, cachedQuestion.question))) continue;
    output.push({
      question: cachedQuestion.question,
      options: cachedQuestion.options,
      answer: cachedQuestion.answer,
      explanation: cachedQuestion.explanation,
      evidence: cachedQuestion.evidence,
    });
    seen.add(key);
    if (output.length >= requested) break;
  }

`;
const bankMarker = '  const output: QuizQuestion[] = [];\n  const seen = new Set(recent.map(fingerprint).filter(Boolean));\n';
if (!source.includes('const bankQuestions = books.flatMap')) {
  if (!source.includes(bankMarker)) throw new Error('Could not locate quiz output state safely.');
  source = source.replace(bankMarker, bankMarker + '\n' + bankInsert);
}

source = source.replace(/gateway\\(prompt, 30000\\)/g, 'gateway(prompt, 15000 /* gateway(prompt, 30000) */)');
source = source.replace(/geminiText\\(prompt, 30000\\)/g, 'geminiText(prompt, 15000)');

fs.writeFileSync(path, source);
console.log('Quiz parallel generation hardened: 4 concurrent 8-question batches plus reusable question-bank cache.');
