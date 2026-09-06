import fs from 'node:fs';

const pagePath = 'app/dashboard/quiz/page.tsx';
const stablePath = 'lib/quizAiClientStable.ts';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value);
}

let page = read(pagePath);
let stable = read(stablePath);

// ---------------------------------------------------------------------------
// Book quiz pre-generation review screen.
// ---------------------------------------------------------------------------
if (!page.includes("const [quizReview, setQuizReview] = useState(false);")) {
  page = page.replace(
    "  const [starting, setStarting] = useState(false);\n",
    "  const [starting, setStarting] = useState(false);\n  const [quizReview, setQuizReview] = useState(false);\n",
  );
}

if (!page.includes('function proceedToQuizGeneration()')) {
  page = page.replace(
    "  async function startQuiz() {\n",
    "  function proceedToQuizGeneration() {\n    setQuizReview(false);\n    void startQuiz();\n  }\n\n  async function startQuiz() {\n",
  );
}

const reviewMarker = "  /* ------------------------------------------------------------------------ */\n  /* Quiz generation loading                                                  */\n  /* ------------------------------------------------------------------------ */\n";

if (!page.includes('Review your quiz before generation')) {
  const reviewBlock = `  /* ------------------------------------------------------------------------ */\n  /* Pre-generation quiz review                                                */\n  /* ------------------------------------------------------------------------ */\n\n  if (quizReview && !setup) {\n    const estimatedMinutes = Math.min(10, Math.max(1, Math.ceil(questions / 10) + Math.max(0, selected.length - 1)));\n    const chosenBooks = books.filter((b) => selected.includes(b.id));\n\n    return (\n      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50 text-ink">\n        <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">\n          <button\n            type="button"\n            onClick={() => setQuizReview(false)}\n            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"\n          >\n            <ArrowLeft size={17} />\n            Back to Quiz Studio\n          </button>\n\n          <section className="mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white shadow-xl sm:p-10">\n            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-200">\n              <Sparkles size={13} />\n              Quiz preparation\n            </div>\n\n            <h1 className="mt-4 text-3xl font-black sm:text-4xl">\n              Review your quiz before generation\n            </h1>\n\n            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">\n              EDUWILLS AI will now use your selections to build a grounded quiz. Check the details below before generation begins.\n            </p>\n\n            <div className="mt-7 grid gap-3 sm:grid-cols-2">\n              <div className="rounded-2xl bg-white/10 p-4">\n                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Books</p>\n                <p className="mt-2 font-bold">{chosenBooks.map((b) => b.title).join(', ')}</p>\n              </div>\n              <div className="rounded-2xl bg-white/10 p-4">\n                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Questions</p>\n                <p className="mt-2 font-bold">{questions} objective questions</p>\n              </div>\n              <div className="rounded-2xl bg-white/10 p-4">\n                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Difficulty</p>\n                <p className="mt-2 font-bold">{difficulty}</p>\n              </div>\n              <div className="rounded-2xl bg-white/10 p-4">\n                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Quiz duration</p>\n                <p className="mt-2 font-bold">{duration === 'none' ? 'No time limit' : `${duration} minutes`}</p>\n              </div>\n              <div className="rounded-2xl bg-white/10 p-4 sm:col-span-2">\n                <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Your instructions</p>\n                <p className="mt-2 font-bold">{instructions.trim() || 'No special instructions — EDUWILLS AI will vary the questions across supported book content.'}</p>\n              </div>\n            </div>\n\n            <div className="mt-5 rounded-[1.5rem] border border-cyan-300/20 bg-white/10 p-5">\n              <div className="flex items-start gap-3">\n                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/20 text-cyan-200">\n                  <Clock3 size={21} />\n                </div>\n                <div>\n                  <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Estimated time to start</p>\n                  <p className="mt-1 text-lg font-black">Up to {estimatedMinutes} minute{estimatedMinutes === 1 ? '' : 's'}</p>\n                  <p className="mt-1 text-sm leading-6 text-slate-300">\n                    Generation time depends on the number of questions, selected books and live book research. EDUWILLS will begin the quiz automatically when the full requested set is ready.\n                  </p>\n                </div>\n              </div>\n            </div>\n\n            <div className="mt-6 flex flex-col gap-3 sm:flex-row">\n              <button\n                type="button"\n                onClick={() => setQuizReview(false)}\n                className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 font-black text-white hover:bg-white/15"\n              >\n                Edit selections\n              </button>\n              <button\n                type="button"\n                onClick={proceedToQuizGeneration}\n                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-4 font-black text-slate-950 shadow-lg"\n              >\n                <Sparkles size={19} />\n                Start Quiz Generation\n              </button>\n            </div>\n          </section>\n        </div>\n      </main>\n    );\n  }\n\n`;
  page = page.replace(reviewMarker, reviewBlock + reviewMarker);
}

const oldStartButton = `            onClick={startQuiz}\n`;
if (page.includes(oldStartButton)) {
  page = page.replace(oldStartButton, `            onClick={() => setQuizReview(true)}\n`);
}
page = page.replace('                Generate quiz with EDUWILLS AI\n', '                Proceed to Quiz\n');

write(pagePath, page);

// ---------------------------------------------------------------------------
// Answer-key quality control. The generator already grounds questions; this
// second, compact gateway-only check verifies the answer index against the
// same exact-book evidence before a batch reaches the learner.
// ---------------------------------------------------------------------------
if (!stable.includes('async function auditAnswerKeys(')) {
  const auditFunction = `\nasync function auditAnswerKeys(book: QuizBook, questions: QuizQuestion[], research: string): Promise<QuizQuestion[]> {\n  if (!questions.length) return questions;\n  const prompt = \\`You are EDUWILLS answer-key quality control. Verify ONLY the answer index for each supplied multiple-choice question about the exact book "\\${book.title}" by \\${book.author}. Use ONLY the verified evidence below. Do not rewrite questions or options. Do not guess. If the evidence does not clearly establish which option is correct, return -1 for that question. Return ONLY JSON: {"answers":[0,1,2,3,-1]}. The array must have exactly \\${questions.length} integers in the same order. An answer index is correct only when that option is directly supported by the evidence.\\n\\nVERIFIED EVIDENCE:\\n\\${research.slice(0, 65000)}\\n\\nQUESTIONS:\\n\\${questions.map((q, i) => \\`\\${i}. Q: \\${q.question}\\nOPTIONS: 0=\\${q.options[0]} | 1=\\${q.options[1]} | 2=\\${q.options[2]} | 3=\\${q.options[3]}\\`).join('\\n')}`;\n  try {\n    const raw = await gateway(prompt, 15000);\n    const parsed = JSON.parse(raw);\n    const answers = Array.isArray(parsed?.answers) ? parsed.answers : [];\n    if (answers.length !== questions.length) return [];\n    return questions.map((q, i) => {\n      const answer = Number(answers[i]);\n      return Number.isInteger(answer) && answer >= 0 && answer < 4 ? { ...q, answer } : null;\n    }).filter(Boolean) as QuizQuestion[];\n  } catch {\n    return [];\n  }\n}\n`;
  const anchor = '\nasync function generateBatch(book: QuizBook, count: number, difficulty: string, instructions: string, previous: string[], research: string) {';
  stable = stable.replace(anchor, auditFunction + anchor);
}

const oldReturn = `      if (parsed.length) return parsed;`;
if (stable.includes(oldReturn) && !stable.includes('const audited = await auditAnswerKeys(book, parsed, research);')) {
  stable = stable.replace(oldReturn, `      if (parsed.length) {\n        const audited = await auditAnswerKeys(book, parsed, research);\n        if (audited.length) return audited;\n      }`);
}

write(stablePath, stable);

console.log('Book quiz review and answer-key quality control applied.');
