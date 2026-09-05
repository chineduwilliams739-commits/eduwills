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
client = client.replace(/const QUIZ_BATCH_CONCURRENCY = \d+;/, 'const QUIZ_BATCH_CONCURRENCY = 4;');
client = client.replace(/const QUIZ_BATCH_SIZE = \d+;/, 'const QUIZ_BATCH_SIZE = 8;');
client = client.replace(/const QUIZ_PROVIDER_TIMEOUT = \d+;/, 'const QUIZ_PROVIDER_TIMEOUT = 12000;');

const generateBatchStart = client.indexOf('async function generateBatch(');
const generateBatchEnd = client.indexOf('\n\nasync function generateParallelBatches(', generateBatchStart);
if (generateBatchStart >= 0 && generateBatchEnd > generateBatchStart) {
  const batch = client.slice(generateBatchStart, generateBatchEnd);
  const patched = batch.replace('for (let attempt = 0; attempt < 2; attempt++)', 'for (let attempt = 0; attempt < 3; attempt++)');
  client = client.slice(0, generateBatchStart) + patched + client.slice(generateBatchEnd);
}

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
console.log('Quiz generation UX hardening applied successfully.');
