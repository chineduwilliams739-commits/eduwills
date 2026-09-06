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

// Generation must not silently fall through to the Studio. Keep the setup in
// memory while generation runs, expose a retryable error state, and only start
// the timed attempt after at least one complete question set exists.
if (!page.includes('const [quizRetrying, setQuizRetrying]')) {
  page = page.replace(
    "  const [quizError, setQuizError] = useState('');",
    "  const [quizError, setQuizError] = useState('');\n  const [quizRetrying, setQuizRetrying] = useState(false);\n  const [quizGenerationStarted, setQuizGenerationStarted] = useState(false);",
  );
}

// Preserve the important timer hardening from the previous repair.
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

// Make the generation catch visible and retryable. This is deliberately narrow:
// only the catch belonging to the quiz-generation routine is changed.
const generationCatch = /catch \(error\) \{\s*setQuizError\([^;]*;\s*\}\s*finally \{\s*setQuizLoading\(false\);/;
if (generationCatch.test(page)) {
  page = page.replace(generationCatch, `catch (error) {
      const detail = error instanceof Error ? error.message : String(error || 'Unknown generation error');
      setQuizError(detail || 'Quiz generation failed. Please try again.');
      setQuizGenerationStarted(true);
    } finally {
      setQuizLoading(false);`);
}

// If the existing generator has an empty-result guard, turn it into a real
// failure rather than letting the render logic return to the Studio.
page = page.replace(
  /if \(!generated\.length\) \{\s*setQuizError\([^;]*;?\s*return;\s*\}/,
  `if (!generated.length) {
        throw new Error('No valid questions were returned. The AI generation service may have timed out or rejected the generated questions.');
      }`,
);

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

// Insert a persistent failure screen immediately before the Studio branch.
// It prevents the misleading "back to Studio" transition after generation.
if (!page.includes('Quiz generation failed — please retry')) {
  const studioMarkers = [
    "  if (!setup || !qs.length) {",
    "  if (!setup) {",
  ];
  const marker = studioMarkers.find((m) => page.includes(m));
  if (marker) {
    const failureUi = `  if (quizGenerationStarted && !quizLoading && !qs.length && quizError) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-6 shadow-xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <XCircle size={25} />
          </div>
          <h1 className="text-xl font-black text-slate-900">Quiz generation failed — please retry</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your quiz setup is still saved. We did not consume a free quiz for this failed generation.</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">{quizError}</div>
          <div className="mt-5 flex gap-3">
            <button type="button" disabled={quizRetrying} onClick={() => { setQuizError(''); setQuizRetrying(true); window.setTimeout(() => setQuizRetrying(false), 100); }} className="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white disabled:opacity-60">
              {quizRetrying ? 'Retrying…' : 'Retry Generation'}
            </button>
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
console.log('Quiz generation reliability hardening applied: bounded provider timeouts, adaptive grounded refill, explicit failure state, preserved setup, and post-generation timer start.');
