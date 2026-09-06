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

// Generation failures are explicit and retryable.
if (!page.includes('const [quizGenerationFailed, setQuizGenerationFailed]')) {
  const stateMarker = "  const [quizError, setQuizError] = useState('');";
  if (!page.includes(stateMarker)) throw new Error('Quiz error state marker not found.');
  page = page.replace(
    stateMarker,
    `${stateMarker}\n  const [quizGenerationFailed, setQuizGenerationFailed] = useState(false);\n  const [quizRetrying, setQuizRetrying] = useState(false);`,
  );
}

// The timer must begin only after generation succeeds.
page = page.replace('      const startedAtMs = Date.now();', '      const startedAtMs = 0;');
page = page.replace(
  /        endAtMs: minutes\s*\? startedAtMs \+ minutes \* 60000\s*:\s*null,/,
  '        endAtMs: null,',
);
page = page.replace(
  '    setStarting(true);\n    setMessage(\'\');',
  '    setStarting(true);\n    setQuizGenerationFailed(false);\n    setMessage(\'\');',
);

// Replace the entire generation function by stable function boundaries instead of fragile formatting.
const generateStart = page.indexOf('  async function generate(current: Setup)');
const submitStart = page.indexOf('  async function submitQuiz', generateStart);
if (generateStart < 0 || submitStart < 0 || submitStart <= generateStart) {
  throw new Error('Quiz generation function boundaries not found.');
}

const generateFn = `  async function generate(current: Setup): Promise<boolean> {
    try {
      const research = await researchBooks(current.books);

      const recent = Array.isArray(qs)
        ? qs.map((q) => q.question)
        : [];

      const generated = await generateQuiz(
        current.books,
        current.questions,
        current.difficulty,
        current.instructions,
        recent,
        research
      );

      if (!Array.isArray(generated) || generated.length < current.questions) {
        throw new Error(
          \`EDUWILLS AI returned only \${Array.isArray(generated) ? generated.length : 0} of \${current.questions} requested questions.\`,
        );
      }

      const readyAtMs = Date.now();
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
      setQuizGenerationFailed(false);

      try {
        await updateDoc(doc(db, 'quizHistory', current.id), {
          startedAtMs: readyAtMs,
          endAtMs: readySetup.endAtMs,
          status: 'started',
        });
      } catch {}

      return true;
    } catch (e: any) {
      console.warn(e);

      const rawError = e instanceof Error ? e.message : String(e?.message || e || 'Unknown error');
      setQuizError(
        rawError === 'AI_QUOTA_EXHAUSTED'
          ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again later.'
          : rawError === 'AUTHENTICATION_REQUIRED'
            ? 'Your EDUWILLS login session is not ready. Please sign in again and retry.'
            : rawError || 'EDUWILLS AI could not finish the requested questions. Please retry.'
      );

      setQuizGenerationFailed(true);
      setQs([]);

      try {
        if (current.id) {
          await updateDoc(doc(db, 'quizHistory', current.id), {
            status: 'failed',
            failedAt: serverTimestamp(),
          });
        }
      } catch {}

      return false;
    } finally {
      setQuizLoading(false);
    }
  }

`;
page = page.slice(0, generateStart) + generateFn + page.slice(submitStart);

// Gate the free-quiz charge on successful generation.
page = page.replace(
  '      await generate(next);\n\n      if (!active) {',
  '      const generatedSuccessfully = await generate(next);\n\n      if (!generatedSuccessfully) {\n        return;\n      }\n\n      if (!active) {',
);

// Failed generation records do not count against the free daily allowance.
page = page.replace(
  /history\.docs\.filter\(\s*\(x\) => String\(x\.data\(\)\?\.freeDay \|\| ''\) === day\s*\)/m,
  "history.docs.filter((x) => {\n                const data = x.data() || {};\n                return String(data.freeDay || '') === day && data.status !== 'failed';\n              })",
);
page = page.replace(
  /snap\.docs\.filter\(\s*\(d\) => String\(d\.data\(\)\?\.freeDay \|\| ''\) === day\s*\)/m,
  "snap.docs.filter((d) => {\n        const data = d.data() || {};\n        return String(data.freeDay || '') === day && data.status !== 'failed';\n      })",
);

// Retry screen keeps the user in the quiz flow instead of silently returning to Studio.
if (!page.includes('Quiz generation failed — please retry')) {
  const marker = '  /* ------------------------------------------------------------------------ */\n  /* Results                                                                   */\n  /* ------------------------------------------------------------------------ */';
  if (!page.includes(marker)) throw new Error('Quiz results marker not found.');

  const ui = `  if (quizGenerationFailed && setup && !quizLoading && !qs.length) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-red-50 p-5">
        <div className="w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-7 shadow-2xl">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <XCircle size={28} />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">Quiz generation failed — please retry</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your quiz setup is still saved. This failed attempt has not consumed your free quiz.</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-700">{quizError || 'EDUWILLS AI could not finish the requested questions.'}</div>
          <button
            type="button"
            disabled={quizRetrying}
            onClick={() => {
              if (!setup) return;
              setQuizRetrying(true);
              setQuizError('');
              void (async () => {
                try {
                  await generate(setup);
                } finally {
                  setQuizRetrying(false);
                }
              })();
            }}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-4 font-black text-white disabled:opacity-60"
          >
            {quizRetrying ? 'Retrying…' : 'Retry Generation'}
          </button>
          <button
            type="button"
            onClick={() => {
              setQuizGenerationFailed(false);
              setQuizError('');
              setSetup(null);
            }}
            className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-3 font-black text-slate-700"
          >
            Back to Quiz Studio
          </button>
        </div>
      </main>
    );
  }

`;
  page = page.replace(marker, ui + marker);
}

fs.writeFileSync(pagePath, page);
console.log('Quiz generation reliability hardening applied: bounded parallel batches, adaptive grounded refill, retryable failure state, no free-quiz charge on failure, strict batch completion, and timer starts only after questions exist.');
