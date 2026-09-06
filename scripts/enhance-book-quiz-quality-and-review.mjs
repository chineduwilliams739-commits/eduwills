import fs from 'node:fs';

const pagePath = 'app/dashboard/quiz/page.tsx';
const stablePath = 'lib/quizAiClientStable.ts';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

let page = read(pagePath);
let stable = read(stablePath);

// ---------------------------------------------------------------------------
// Pre-generation quiz review. Keep this script syntax-safe: generated source
// is assembled from ordinary strings so JSX template literals cannot escape
// into this Node script.
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
  const reviewLines = [
    '  /* ------------------------------------------------------------------------ */',
    '  /* Pre-generation quiz review                                                */',
    '  /* ------------------------------------------------------------------------ */',
    '',
    '  if (quizReview && !setup) {',
    '    const estimatedMinutes = Math.min(10, Math.max(1, Math.ceil(questions / 10) + Math.max(0, selected.length - 1)));',
    '    const chosenBooks = books.filter((b) => selected.includes(b.id));',
    '',
    '    return (',
    '      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50 text-ink">',
    '        <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">',
    '          <button type="button" onClick={() => setQuizReview(false)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600">',
    '            <ArrowLeft size={17} />',
    '            Back to Quiz Studio',
    '          </button>',
    '',
    '          <section className="mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white shadow-xl sm:p-10">',
    '            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-200">',
    '              <Sparkles size={13} />',
    '              Quiz preparation',
    '            </div>',
    '            <h1 className="mt-4 text-3xl font-black sm:text-4xl">Review your quiz before generation</h1>',
    '            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">EDUWILLS AI will use your selections to build a grounded quiz. Check the details below before generation begins.</p>',
    '',
    '            <div className="mt-7 grid gap-3 sm:grid-cols-2">',
    '              <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Books</p><p className="mt-2 font-bold">{chosenBooks.map((b) => b.title).join(", ")}</p></div>',
    '              <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Questions</p><p className="mt-2 font-bold">{questions} objective questions</p></div>',
    '              <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Difficulty</p><p className="mt-2 font-bold">{difficulty}</p></div>',
    '              <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Quiz duration</p><p className="mt-2 font-bold">{duration === \'none\' ? \'No time limit\' : duration + \' minutes\'}</p></div>',
    '              <div className="rounded-2xl bg-white/10 p-4 sm:col-span-2"><p className="text-xs font-black uppercase tracking-wider text-cyan-200">Your instructions</p><p className="mt-2 font-bold">{instructions.trim() || \'No special instructions — EDUWILLS AI will vary questions across supported book content.\'}</p></div>',
    '            </div>',
    '',
    '            <div className="mt-5 rounded-[1.5rem] border border-cyan-300/20 bg-white/10 p-5">',
    '              <div className="flex items-start gap-3">',
    '                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/20 text-cyan-200"><Clock3 size={21} /></div>',
    '                <div>',
    '                  <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Estimated time to start</p>',
    '                  <p className="mt-1 text-lg font-black">Up to {estimatedMinutes} minute{estimatedMinutes === 1 ? \'\' : \'s\'}</p>',
    '                  <p className="mt-1 text-sm leading-6 text-slate-300">This is an estimate, capped at 10 minutes. Generation time depends on question count, selected books and live book research. Your quiz timer starts only after the requested questions are ready.</p>',
    '                </div>',
    '              </div>',
    '            </div>',
    '',
    '            <div className="mt-6 flex flex-col gap-3 sm:flex-row">',
    '              <button type="button" onClick={() => setQuizReview(false)} className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 font-black text-white hover:bg-white/15">Edit selections</button>',
    '              <button type="button" onClick={proceedToQuizGeneration} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-5 py-4 font-black text-slate-950 shadow-lg"><Sparkles size={19} />Start Quiz Generation</button>',
    '            </div>',
    '          </section>',
    '        </div>',
    '      </main>',
    '    );',
    '  }',
    '',
    '',
  ];
  page = page.replace(reviewMarker, reviewLines.join('\n') + reviewMarker);
}

page = page.replace('            onClick={startQuiz}\n', '            onClick={() => setQuizReview(true)}\n');
page = page.replace('                Generate quiz with EDUWILLS AI\n', '                Proceed to Quiz\n');

write(pagePath, page);

// ---------------------------------------------------------------------------
// Answer-key quality control. This verifier may only change the answer index
// when the exact-book evidence clearly supports it. If verification is
// inconclusive, the batch is rejected rather than guessing.
// ---------------------------------------------------------------------------
if (!stable.includes('async function auditAnswerKeys(')) {
  const auditLines = [
    'async function auditAnswerKeys(book: QuizBook, questions: QuizQuestion[], research: string): Promise<QuizQuestion[]> {',
    '  if (!questions.length) return questions;',
    '  const questionText = questions.map((q, i) => [',
    '    `${i}. Q: ${q.question}`,' ,
    '    `OPTIONS: 0=${q.options[0]} | 1=${q.options[1]} | 2=${q.options[2]} | 3=${q.options[3]}`,' ,
    '  ].join("\\n")).join("\\n");',
    '  const prompt = [',
    '    \'You are EDUWILLS answer-key quality control.\',',
    '    `Verify ONLY the answer index for each multiple-choice question about the exact book "${book.title}" by ${book.author}.`,',
    '    \'Use ONLY the verified evidence below. Do not guess or import facts from another work.\',',
    '    `Return ONLY JSON: ${JSON.stringify({ answers: questions.map(() => -1) })}`,',
    '    `The answers array must contain exactly ${questions.length} integers. Use 0-3 only when the evidence clearly proves that option is correct; use -1 when evidence is insufficient.`,',
    '    \'VERIFIED EVIDENCE:\',',
    '    research.slice(0, 65000),',
    '    \'QUESTIONS:\',',
    '    questionText,',
    '  ].join("\\n\\n");',
    '  try {',
    '    const raw = await gateway(prompt, 15000);',
    '    const parsed = JSON.parse(raw);',
    '    const answers = Array.isArray(parsed?.answers) ? parsed.answers : [];',
    '    if (answers.length !== questions.length) return [];',
    '    const audited: QuizQuestion[] = [];',
    '    for (let i = 0; i < questions.length; i += 1) {',
    '      const answer = Number(answers[i]);',
    '      if (!Number.isInteger(answer) || answer < 0 || answer > 3) return [];',
    '      audited.push({ ...questions[i], answer });',
    '    }',
    '    return audited;',
    '  } catch {',
    '    return [];',
    '  }',
    '}',
    '',
  ];
  const anchor = '\nasync function generateBatch(QuizBook';
  const actualAnchor = '\nasync function generateBatch(book: QuizBook, count: number, difficulty: string, instructions: string, previous: string[], research: string) {';
  stable = stable.replace(actualAnchor, '\n' + auditLines.join('\n') + actualAnchor);
}

const oldReturn = '      if (parsed.length) return parsed;';
if (stable.includes(oldReturn) && !stable.includes('const audited = await auditAnswerKeys(book, parsed, research);')) {
  stable = stable.replace(oldReturn, [
    '      if (parsed.length) {',
    '        const audited = await auditAnswerKeys(book, parsed, research);',
    '        if (audited.length === parsed.length) return audited;',
    '      }',
  ].join('\n'));
}

write(stablePath, stable);
console.log('Book quiz review and answer-key quality control applied safely.');
