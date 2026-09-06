import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(path, 'utf8');

if (!page.includes("const [quizGenerationStarted, setQuizGenerationStarted]")) {
  const marker = "  const [quizError, setQuizError] = useState('');";
  if (!page.includes(marker)) throw new Error('quizError state marker not found');
  page = page.replace(marker, `${marker}\n  const [quizGenerationStarted, setQuizGenerationStarted] = useState(false);\n  const [quizRetrying, setQuizRetrying] = useState(false);`);
}

page = page.replace(
  '      const startedAtMs = Date.now();',
  '      const startedAtMs = 0;',
);
page = page.replace(
  /        endAtMs: minutes\n          \? startedAtMs \+ minutes \* 60000\n          : null,/,
  '        endAtMs: null,',
);

page = page.replace(
  "    setStarting(true);\n    setMessage('');",
  "    setStarting(true);\n    setQuizGenerationStarted(true);\n    setQuizGenerationFailed(false);\n    setMessage('');",
);

page = page.replace(
  "      await generate(next);\n\n      if (!active) {",
  "      const generatedSuccessfully = await generate(next);\n\n      if (!generatedSuccessfully) {\n        return;\n      }\n\n      if (!active) {",
);

page = page.replace(
  '  async function generate(current: Setup) {',
  '  async function generate(current: Setup): Promise<boolean> {',
);

const oldSuccess = `      setQs(\n        generated.slice(\n          0,\n          current.questions\n        )\n      );\n\n      setQuizError('');`;
const newSuccess = `      if (!Array.isArray(generated) || generated.length < current.questions) {\n        throw new Error(\n          \`EDUWILLS AI returned only \${Array.isArray(generated) ? generated.length : 0} of \${current.questions} requested questions.\`,\n        );\n      }\n\n      const readyAtMs = Date.now();\n      const readySetup: Setup = {\n        ...current,\n        startedAtMs: readyAtMs,\n        endAtMs: current.duration ? readyAtMs + current.duration * 60000 : null,\n      };\n\n      setQs(generated.slice(0, current.questions));\n      setSetup(readySetup);\n      setIdx(0);\n      setAnswers([]);\n      setElapsed(0);\n      setSeconds(readySetup.duration ? readySetup.duration * 60 : null);\n      setQuizError('');\n      setQuizGenerationFailed(false);\n      return true;`;
if (page.includes(oldSuccess)) page = page.replace(oldSuccess, newSuccess);
else if (!page.includes('const readyAtMs = Date.now();')) throw new Error('quiz generation success boundary not found');

const oldCatch = `      setQs([]);\n    } finally {\n      setQuizLoading(false);\n    }\n  }`;
const newCatch = `      setQuizGenerationFailed(true);\n      setQs([]);\n      return false;\n    } finally {\n      setQuizLoading(false);\n    }\n  }`;
if (page.includes(oldCatch)) page = page.replace(oldCatch, newCatch);

// Failed attempts must not count toward the daily free allowance.
page = page.replace(
  "history.docs.filter(\n                (x) => String(x.data()?.freeDay || '') === day\n              ).length",
  "history.docs.filter((x) => {\n                const data = x.data() || {};\n                return String(data.freeDay || '') === day && data.status !== 'failed';\n              }).length",
);
page = page.replace(
  "snap.docs.filter(\n        (d) => String(d.data()?.freeDay || '') === day\n      ).length",
  "snap.docs.filter((d) => {\n        const data = d.data() || {};\n        return String(data.freeDay || '') === day && data.status !== 'failed';\n      }).length",
);

// Persist a failed status so a failed attempt cannot be mistaken for a completed/used quiz.
const failureStatus = `      setQuizGenerationFailed(true);\n      setQs([]);\n      return false;`;
if (page.includes(failureStatus) && !page.includes("status: 'failed'")) {
  page = page.replace(
    failureStatus,
    `      setQuizGenerationFailed(true);\n      setQs([]);\n      try {\n        if (current.id) await updateDoc(doc(db, 'quizHistory', current.id), { status: 'failed', failedAt: serverTimestamp() });\n      } catch {}\n      return false;`,
  );
}

if (!page.includes('Quiz generation failed — please retry')) {
  const marker = `  /* ------------------------------------------------------------------------ */\n  /* Results                                                                   */\n  /* ------------------------------------------------------------------------ */`;
  if (!page.includes(marker)) throw new Error('Quiz results marker not found');
  const ui = `  if (quizGenerationStarted && quizGenerationFailed && setup && !quizLoading && !qs.length) {\n    return (\n      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-red-50 p-5">\n        <div className="w-full max-w-md rounded-[2rem] border border-red-100 bg-white p-7 shadow-2xl">\n          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><XCircle size={28} /></div>\n          <h1 className="mt-5 text-2xl font-black text-slate-900">Quiz generation failed — please retry</h1>\n          <p className="mt-2 text-sm leading-6 text-slate-600">Your quiz setup is still saved. This failed attempt has not consumed your free quiz.</p>\n          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-700">{quizError || 'EDUWILLS AI could not finish generating the requested questions.'}</div>\n          <button type="button" disabled={quizRetrying} onClick={() => { if (!setup) return; setQuizRetrying(true); setQuizError(''); void (async () => { try { await generate(setup); } finally { setQuizRetrying(false); } })(); }} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-4 font-black text-white disabled:opacity-60">\n            {quizRetrying ? 'Retrying…' : 'Retry Generation'}\n          </button>\n          <button type="button" onClick={() => { setQuizGenerationStarted(false); setQuizGenerationFailed(false); setQuizError(''); setSetup(null); }} className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-3 font-black text-slate-700">Back to Quiz Studio</button>\n        </div>\n      </main>\n    );\n  }\n\n`;
  page = page.replace(marker, ui + marker);
}

fs.writeFileSync(path, page);
console.log('Quiz generation failure UX and free-quiz accounting repaired.');
