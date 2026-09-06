import fs from 'node:fs';

const clientPath = 'lib/quizAiClientStable.ts';
let client = fs.readFileSync(clientPath, 'utf8');

if (!client.includes('async function fetchWithTimeout')) {
  const marker = 'async function gatewayUrl() {';
  const helper = `async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

`;
  if (!client.includes(marker)) throw new Error('Quiz gateway marker not found.');
  client = client.replace(marker, helper + marker);
}

client = client.replace(
  "fetch(`${BASE}/ai-gateway.json?v=30`, { cache: 'no-store' })",
  "fetchWithTimeout(`${BASE}/ai-gateway.json?v=30`, { cache: 'no-store' }, 5000)",
);
client = client.replace(
  "fetch(url, { cache: 'no-store' })",
  "fetchWithTimeout(url, { cache: 'no-store' }, 7000)",
);

// Keep enough parallelism to reach the target of roughly 100 questions/minute.
// Grounding can reject a subset of model output, so generation below deliberately
// requests a safety buffer rather than treating raw AI output as final questions.
client = client.replace(/const QUIZ_BATCH_CONCURRENCY = \d+;/, 'const QUIZ_BATCH_CONCURRENCY = 10;');
client = client.replace(/const QUIZ_BATCH_SIZE = \d+;/, 'const QUIZ_BATCH_SIZE = 10;');
client = client.replace(/const QUIZ_PROVIDER_TIMEOUT = \d+;/, 'const QUIZ_PROVIDER_TIMEOUT = 15000;');

const generateBatchStart = client.indexOf('async function generateBatch(');
const generateBatchEnd = client.indexOf('\n\nasync function generateParallelBatches(', generateBatchStart);
if (generateBatchStart >= 0 && generateBatchEnd > generateBatchStart) {
  const batch = client.slice(generateBatchStart, generateBatchEnd);
  client = client.slice(0, generateBatchStart) + batch + client.slice(generateBatchEnd);
}

// Replace the final collection loop with an adaptive grounded-generation loop.
// The old implementation asked for N raw questions and assumed N would survive
// grounding. That is why a request for 10 could stop at 7/10 even though the AI
// call itself succeeded. Generate a controlled buffer and, if grounding removes
// some, immediately request another batch instead of forcing the user to retry.
const loopStart = client.indexOf('    const needed = share - local.length;');
if (loopStart >= 0) {
  const loopEndMarker = '\n    if (local.length < share)';
  const loopEnd = client.indexOf(loopEndMarker, loopStart);
  if (loopEnd < 0) throw new Error('Could not locate adaptive quiz generation boundary.');
  const adaptive = `    let refillRounds = 0;
    while (local.length < share && refillRounds < 8) {
      refillRounds += 1;
      const remaining = share - local.length;
      // 1.6x buffer compensates for strict grounding/deduplication while
      // keeping each provider request capped at 10 questions.
      const generationTarget = Math.min(100, Math.max(remaining, Math.ceil(remaining * 1.6)));
      const questions = await generateParallelBatches(
        book,
        generationTarget,
        difficulty,
        instructions,
        [...recent, ...output.map((question) => question.question)],
        evidence,
      );

      let accepted = 0;
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
        accepted += 1;

        cacheState.questions.push({ ...question, bookKey: bookKey(book) });
        cacheState.updatedAt = Date.now();
        writeGenerationCache(cacheState);

        const bank = readQuestionBank(book);
        writeQuestionBank(book, [...bank, { ...question, bookKey: bookKey(book) }]);
        onPartial?.(question, book, output.length, requested);

        if (local.length >= share || output.length >= requested) break;
      }

      if (!accepted) break;
    }
`;
  client = client.slice(0, loopStart) + adaptive + client.slice(loopEnd);
}

client = client.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v32-quiz-throughput-grounded-retry';");

fs.writeFileSync(clientPath, client);

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

page = page.replace(/\n\s*const startedAtMs = Date\.now\(\);\n\n\s*const minutes =/, '\n      const minutes =');
page = page.replace(
  /startedAtMs,\n\s*endAtMs: minutes\n\s*\? startedAtMs \+ minutes \* 60000\n\s*: null,/,
  'startedAtMs: 0,\n        endAtMs: null,',
);

const oldReady = `      setQs(\n        generated.slice(\n          0,\n          current.questions\n        )\n      );\n\n      setQuizError('');`;
const newReady = `      const readyAtMs = Date.now();
      const readySetup: Setup = {
        ...current,
        startedAtMs: readyAtMs,
        endAtMs: current.duration ? readyAtMs + current.duration * 60000 : null,
      };

      setQs(generated.slice(0, current.questions));
      setSetup(readySetup);
      setIdx(0);
      setAnswers([]);
      setElapsed(0);
      setSeconds(readySetup.duration ? readySetup.duration * 60 : null);
      setQuizError('');

      try {
        await updateDoc(doc(db, 'quizHistory', current.id), {
          startedAtMs: readyAtMs,
          endAtMs: readySetup.endAtMs,
          status: 'started',
        });
      } catch {}`;
if (page.includes(oldReady)) page = page.replace(oldReady, newReady);

const oldExplain = `      setWhy((p) => ({
        ...p,
        [i]: cleanText(text),
      }));`;
const newExplain = `      let readable = cleanText(text);
      try {
        const parsed = JSON.parse(readable);
        const candidate = parsed?.explanation ?? parsed?.answer ?? parsed?.text ?? parsed?.message;
        if (typeof candidate === 'string') readable = cleanText(candidate);
      } catch {}
      if (!readable || readable === '{}' || readable === '""' || /^null$/i.test(readable)) {
        const selected = q.options[answers[i]] || 'Not answered';
        const correct = q.options[q.answer] || 'the correct option';
        readable = \`Your answer was “\${selected}”, but the correct answer is “\${correct}”. Review the question and the evidence shown with this quiz item.\`;
      }
      setWhy((p) => ({ ...p, [i]: readable }));`;
if (page.includes(oldExplain)) page = page.replace(oldExplain, newExplain);

fs.writeFileSync(pagePath, page);
console.log('Quiz generation UX hardening applied: 10-way parallel batches, adaptive grounded refill, and timer starts only after generation.');
