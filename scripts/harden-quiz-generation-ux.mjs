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
client = client.replace(/const QUIZ_BATCH_CONCURRENCY = \d+;/, 'const QUIZ_BATCH_CONCURRENCY = 10;');
client = client.replace(/const QUIZ_BATCH_SIZE = \d+;/, 'const QUIZ_BATCH_SIZE = 10;');
client = client.replace(/const QUIZ_PROVIDER_TIMEOUT = \d+;/, 'const QUIZ_PROVIDER_TIMEOUT = 15000;');

const loopStart = client.indexOf('    const needed = share - local.length;');
if (loopStart >= 0) {
  const loopEndMarker = '\n    if (local.length < share)';
  const loopEnd = client.indexOf(loopEndMarker, loopStart);
  if (loopEnd < 0) throw new Error('Could not locate adaptive quiz generation boundary.');
  const adaptive = `    let refillRounds = 0;
    while (local.length < share && refillRounds < 8) {
      refillRounds += 1;
      const remaining = share - local.length;
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

client = client.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v33-quiz-reliable-generation';");
fs.writeFileSync(clientPath, client);

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

if (!page.includes('const [quizRetrying, setQuizRetrying]')) {
  page = page.replace(
    "  const [quizError, setQuizError] = useState('');",
    "  const [quizError, setQuizError] = useState('');\n  const [quizRetrying, setQuizRetrying] = useState(false);\n  const [quizGenerationStarted, setQuizGenerationStarted] = useState(false);",
  );
}

// A quiz is not considered started until questions have actually been generated.
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
      setQuizGenerationStarted(false);

      try {
        await updateDoc(doc(db, 'quizHistory', current.id), {
          startedAtMs: readyAtMs,
          endAtMs: readySetup.endAtMs,
          status: 'started',
        });
      } catch {}`;
if (page.includes(oldReady)) page = page.replace(oldReady, newReady);

// Make the generation error visible instead of swallowing it.
const generationCatch = /catch \(e: any\) \{\n\s*console\.warn\(e\);\n\s*\n\s*const rawError = e instanceof Error \? e\.message : String\(e\?\.message \|\| e \|\| 'Unknown error'\);\n\s*setQuizError\([\s\S]*?\);\n\s*\n\s*setQs\(\[\]\);/;
if (generationCatch.test(page)) {
  page = page.replace(generationCatch, `catch (e: any) {
      console.warn(e);
      const rawError = e instanceof Error ? e.message : String(e?.message || e || 'Unknown error');
      setQuizError(
        rawError === 'AI_QUOTA_EXHAUSTED'
          ? 'EDUWILLS AI has reached today’s generation limit. Please try again later.'
          : rawError === 'AUTHENTICATION_REQUIRED'
            ? 'Your EDUWILLS login session is not ready. Please sign in again and retry.'
            : rawError || 'EDUWILLS AI could not finish generating the requested questions. Please retry.'
      );
      setQuizGenerationStarted(true);
      setQs([]);`);
}

// Do not count a free quiz unless generation actually produced questions.
page = page.replace(
  `      await generate(next);\n\n      if (!active) {`,
  `      const generatedSuccessfully = await generate(next);\n\n      if (!generatedSuccessfully) {\n        return;\n      }\n\n      if (!active) {`,
);

// Make generate return a success flag so failed AI calls never consume a free attempt.
page = page.replace(
  '  async function generate(current: Setup) {',
  '  async function generate(current: Setup): Promise<boolean> {',
);
page = page.replace(
  `      setQuizError('');\n    } catch (e: any) {`,
  `      setQuizError('');\n      setQuizGenerationStarted(false);\n      return true;\n    } catch (e: any) {`,
);
page = page.replace(
  `      setQs([]);\n    } finally {\n      setQuizLoading(false);\n    }\n  }`,
  `      setQs([]);\n      return false;\n    } finally {\n      setQuizLoading(false);\n    }\n  }`,
);

// Retry the same saved setup directly; do not send the learner back through Studio.
page = page.replace(
  `setQuizRetrying(true); window.setTimeout(() => setQuizRetrying(false), 100);`,
  `setQuizRetrying(true);\n                setQuizError('');\n                void (async () => {\n                  try { await generate(setup); } finally { setQuizRetrying(false); }\n                })();`,
);

// If the exact generated failure UI was not inserted by the earlier repair,
// install it immediately before the Studio branch.
if (!page.includes('Quiz generation failed — please retry')) {
  const marker = page.includes('  if (!setup || !qs.length) {')
    ? '  if (!setup || !qs.length) {'
    : page.includes('  if (!setup) {')
      ? '  if (!setup) {'
      : '';
  if (marker) {
    const failureUi = `  if (quizGenerationStarted && !quizLoading && !qs.length && quizError) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-6 shadow-xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><XCircle size={25} /></div>
          <h1 className="text-xl font-black text-slate-900">Quiz generation failed — please retry</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your quiz setup is still saved. A failed generation does not consume a free quiz.</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">{quizError}</div>
          <div className="mt-5 flex gap-3">
            <button type="button" disabled={quizRetrying} onClick={() => { if (!setup) return; setQuizRetrying(true); setQuizError(''); void (async () => { try { await generate(setup); } finally { setQuizRetrying(false); } })(); }} className="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white disabled:opacity-60">{quizRetrying ? 'Retrying…' : 'Retry Generation'}</button>
            <button type="button" onClick={() => { setQuizGenerationStarted(false); setQuizError(''); }} className="rounded-2xl border border-slate-200 px-4 py-3 font-black text-slate-700">Back to Studio</button>
          </div>
        </div>
      </main>
    );
  }

`;
    page = page.replace(marker, failureUi + marker);
  }
}

fs.writeFileSync(pagePath, page);
console.log('Quiz generation reliability hardening applied: fast bounded batches, adaptive grounded refill, retryable failure state, no free-quiz charge on failure, and timer starts only after questions exist.');
