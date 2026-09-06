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

// Keep generation failures inside the generation flow and make them retryable.
if (!page.includes('const [quizGenerationFailed, setQuizGenerationFailed]')) {
  page = page.replace(
    "  const [quizError, setQuizError] = useState('');",
    "  const [quizError, setQuizError] = useState('');\n  const [quizGenerationFailed, setQuizGenerationFailed] = useState(false);\n  const [quizRetrying, setQuizRetrying] = useState(false);",
  );
}

// The timer must begin only after questions exist.
page = page.replace(
  /      const startedAtMs = Date\.now\(\);\n\n      const minutes =/,
  '      const startedAtMs = 0;\n\n      const minutes =',
);
page = page.replace(
  /        endAtMs: minutes\n          \? startedAtMs \+ minutes \* 60000\n          : null,/,
  '        endAtMs: null,',
);

// Mark a successful generation as ready and start the timer at that exact point.
const oldReady = `      setQs(\n        generated.slice(\n          0,\n          current.questions\n        )\n      );\n\n      setQuizError('');`;
const newReady = `      if (!Array.isArray(generated) || generated.length < current.questions) {
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
      } catch {}`;
if (page.includes(oldReady)) page = page.replace(oldReady, newReady);

// Do not consume a free quiz when generation fails.
page = page.replace(
  `      await generate(next);\n\n      if (!active) {`,
  `      const generatedSuccessfully = await generate(next);\n\n      if (!generatedSuccessfully) {\n        return;\n      }\n\n      if (!active) {`,
);

page = page.replace(
  '  async function generate(current: Setup) {',
  '  async function generate(current: Setup): Promise<boolean> {',
);

page = page.replace(
  `      setQuizError('');\n    } catch (e: any) {`,
  `      setQuizError('');\n      return true;\n    } catch (e: any) {`,
);

page = page.replace(
  `      setQs([]);\n    } finally {\n      setQuizLoading(false);\n    }\n  }`,
  `      setQuizGenerationFailed(true);\n      setQs([]);\n      return false;\n    } finally {\n      setQuizLoading(false);\n    }\n  }`,
);

// If the page has a generation error after the loading screen, show a retry screen instead of Studio.
if (!page.includes('Quiz generation failed — please retry')) {
  const marker = `  /* ------------------------------------------------------------------------ */\n  /* Results                                                                   */\n  /* ------------------------------------------------------------------------ */`;
  const failureUi = `  if (quizGenerationFailed && setup && !quizLoading && !qs.length) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-red-50 p-5">
        <div className="w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-7 shadow-2xl">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <XCircle size={28} />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">Quiz generation failed — please retry</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your quiz setup is still saved. This failed attempt has not consumed your free quiz.</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-700">{quizError || 'EDUWILLS AI could not finish generating the requested questions.'}</div>
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
  if (!page.includes(marker)) throw new Error('Quiz results marker not found.');
  page = page.replace(marker, failureUi + marker);
}

fs.writeFileSync(pagePath, page);
console.log('Quiz generation reliability hardening applied: bounded parallel batches, adaptive grounded refill, retryable failure state, no free-quiz charge on failure, strict batch completion, and timer starts only after questions exist.');
