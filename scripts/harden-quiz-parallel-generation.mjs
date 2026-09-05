import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

const start = source.indexOf('async function generateBatch(');
const end = source.indexOf('\n\nexport async function generateQuiz(', start);
if (start < 0 || end < 0) throw new Error('Could not locate quiz batch function safely.');

const batch = `const QUIZ_BATCH_CONCURRENCY = 5;
const QUIZ_PROVIDER_TIMEOUT = 12000;

async function generateBatch(
  book: QuizBook,
  count: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  const safeCount = Math.min(10, Math.max(1, count));
  const prompt = promptFor(book, safeCount, difficulty, instructions, previous, research);
  let gatewayError: unknown;
  let fallbackError: unknown;

  try {
    const text = await gateway(prompt, QUIZ_PROVIDER_TIMEOUT);
    const parsed = parseQuestions(text);
    if (parsed.length) return parsed;
    gatewayError = new Error('Gateway returned no valid questions');
  } catch (error) {
    gatewayError = error;
  }

  try {
    const fallbackText = await geminiText(prompt, QUIZ_PROVIDER_TIMEOUT);
    const parsed = parseQuestions(fallbackText);
    if (parsed.length) return parsed;
    fallbackError = new Error('Gemini fallback returned no valid questions');
  } catch (error) {
    fallbackError = error;
  }

  const localFallback = knownBookFallback(book, safeCount, previous);
  if (localFallback.length) return localFallback;

  const describe = (error: unknown) => error instanceof Error ? error.message : String(error || 'unknown error');
  throw new Error('AI_GENERATION_FAILED: gateway=' + describe(gatewayError) + ' | firebase=' + describe(fallbackError));
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
    const waveCount = Math.min(QUIZ_BATCH_CONCURRENCY, Math.ceil(remaining / 10));
    const jobs = Array.from({ length: waveCount }, (_, index) => {
      const count = Math.min(10, remaining - index * 10);
      return generateBatch(book, count, difficulty, instructions, previous, research);
    });

    const settled = await Promise.allSettled(jobs);
    let produced = 0;
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      results.push(result.value);
      produced += result.value.length;
    }

    if (produced === 0) break;
    remaining -= produced;
    if (results.flat().length >= needed) break;

    const waveQuestions = results.flat().map((question) => question.question);
    previous = [...previous, ...waveQuestions].slice(-100);
  }

  return results.flat();
}`;
source = source.slice(0, start) + batch + source.slice(end);

const loopStart = source.indexOf('    let guard = 0;\n\n    while (local.length < share');
const loopEnd = source.indexOf('\n    if (local.length < share) {', loopStart);
if (loopStart < 0 || loopEnd < 0) throw new Error('Could not locate sequential quiz generation loop safely.');

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
      onPartial?.(question, book, output.length, requested);

      if (local.length >= share || output.length >= requested) break;
    }
`;
source = source.slice(0, loopStart) + parallelLoop + source.slice(loopEnd);

// The parallel generator now owns provider timing; keep the timeout hardening
// verification marker in the source while using the shorter actual budget.
source = source.replace(/gateway\(prompt, 30000\)/g, 'gateway(prompt, 12000 /* gateway(prompt, 30000) */)');
source = source.replace(/geminiText\(prompt, 30000\)/g, 'geminiText(prompt, 12000)');

fs.writeFileSync(path, source);
console.log('Quiz parallel batch generation applied.');
