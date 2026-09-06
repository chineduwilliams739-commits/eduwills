import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(path, 'utf8');

function replaceOnce(label, from, to) {
  if (!page.includes(from)) throw new Error(`${label} not found`);
  page = page.replace(from, to);
}

// Add explicit generation-failure state to the current quiz page.
if (!page.includes('quizGenerationFailed')) {
  replaceOnce(
    'quiz error state',
    "  const [quizError, setQuizError] = useState('');",
    "  const [quizError, setQuizError] = useState('');\n  const [quizGenerationFailed, setQuizGenerationFailed] = useState(false);\n  const [quizRetrying, setQuizRetrying] = useState(false);",
  );
}

// The quiz clock must not start while AI is still generating questions.
page = page.replace('      const startedAtMs = Date.now();', '      const startedAtMs = 0;');
page = page.replace(
  /        endAtMs: minutes\n          \? startedAtMs \+ minutes \* 60000\n          : null,/,
  '        endAtMs: null,',
);

page = page.replace(
  "    setStarting(true);\n    setMessage('');",
  "    setStarting(true);\n    setQuizGenerationFailed(false);\n    setMessage('');",
);

// Do not consume a free quiz unless generation actually succeeds.
page = page.replace(
  '      await generate(next);\n\n      if (!active) {',
  "      const generatedSuccessfully = await generate(next);\n\n      if (!generatedSuccessfully) {\n        return;\n      }\n\n      if (!active) {",
);

page = page.replace(
  '  async function generate(current: Setup) {',
  '  async function generate(current: Setup): Promise<boolean> {',
);

// Make the successful-generation boundary robust to formatting changes made by
// earlier workflow hardening scripts. This is deliberately regex-based rather
// than dependent on one exact multiline formatting shape.
if (!page.includes('const readyAtMs = Date.now();')) {
  const successRegex = /\s*setQs\(\s*generated\.slice\(\s*0,\s*current\.questions\s*\)\s*\);/m;
  if (!successRegex.test(page)) {
    throw new Error('Generated-question success boundary not found');
  }

  page = page.replace(
    successRegex,
    `
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
      setQuizGenerationFailed(false);\n\n      try {
        await updateDoc(doc(db, 'quizHistory', current.id), {
          startedAtMs: readyAtMs,
          endAtMs: readySetup.endAtMs,
          status: 'started',
        });
      } catch {}

      return true;`,
  );
} else if (!page.includes('return true;')) {
  // The earlier UX hardener may already have installed the ready boundary;
  // ensure generate still returns success for startQuiz's gate.
  page = page.replace(
    /\s*setQuizError\(''\);\s*\n\s*try \{\n\s*await updateDoc\(doc\(db, 'quizHistory', current\.id\), \{[\s\S]*?\}\);\n\s*\} catch \{\}/m,
    (match) => `${match}\n\n      return true;`,
  );
}

// Replace the swallowed-error path with an explicit retryable failure.
if (!page.includes('setQuizGenerationFailed(true);')) {
  const catchRegex = /\s*setQs\(\[\]\);\s*\n\s*\} finally \{\s*\n\s*setQuizLoading\(false\);\s*\n\s*\}/m;
  if (!catchRegex.test(page)) throw new Error('Quiz generation catch boundary not found');
  page = page.replace(
    catchRegex,
    `
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
    }`,
  );
}

// Exclude failed generation records from the free-quiz allowance.
page = page.replace(
  "history.docs.filter(\n                (x) => String(x.data()?.freeDay || '') === day\n              ).length",
  "history.docs.filter((x) => {\n                const data = x.data() || {};\n                return String(data.freeDay || '') === day && data.status !== 'failed';\n              }).length",
);
page = page.replace(
  "snap.docs.filter(\n        (d) => String(d.data()?.freeDay || '') === day\n      ).length",
  "snap.docs.filter((d) => {\n        const data = d.data() || {};\n        return String(data.freeDay || '') === day && data.status !== 'failed';\n      }).length",
);

// Keep the user inside the quiz flow and expose a retry instead of falling back
// to the Quiz Studio with no explanation.
if (!page.includes('Quiz generation failed — please retry')) {
  const marker = '  /* ------------------------------------------------------------------------ */\n  /* Results                                                                   */\n  /* ------------------------------------------------------------------------ */';
  if (!page.includes(marker)) throw new Error('Quiz results marker not found');
  const ui = `  if (quizGenerationFailed && setup && !quizLoading && !qs.length) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-red-50 p-5">
        <div className="w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-7 shadow-2xl">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><XCircle size={28} /></div>
          <h1 className="mt-5 text-2xl font-black text-slate-900">Quiz generation failed — please retry</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Your quiz setup is still saved. This failed attempt has not consumed your free quiz.</p>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-700">{quizError || 'EDUWILLS AI could not finish the requested questions.'}</div>
          <button type="button" disabled={quizRetrying} onClick={() => { if (!setup) return; setQuizRetrying(true); setQuizError(''); void (async () => { try { await generate(setup); } finally { setQuizRetrying(false); } })(); }} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-4 font-black text-white disabled:opacity-60">
            {quizRetrying ? 'Retrying…' : 'Retry Generation'}
          </button>
          <button type="button" onClick={() => { setQuizGenerationFailed(false); setQuizError(''); setSetup(null); }} className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-3 font-black text-slate-700">Back to Quiz Studio</button>
        </div>
      </main>
    );
  }

`;
  page = page.replace(marker, ui + marker);
}

const required = [
  'quizGenerationFailed',
  'Quiz generation failed — please retry',
  'Retry Generation',
  'generatedSuccessfully',
  'Promise<boolean>',
  'readyAtMs',
  'return true;',
  'return false;',
];
const missing = required.filter((x) => !page.includes(x));
if (missing.length) throw new Error(`Quiz generation repair incomplete: ${missing.join(', ')}`);

fs.writeFileSync(path, page);
console.log('Quiz generation failure UX repaired with a formatting-tolerant success boundary, visible retry state, no free-quiz charge on failure, and timer start only after questions exist.');
