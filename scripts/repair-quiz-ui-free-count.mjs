import fs from 'node:fs';

const file = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(file, 'utf8');

const stateMarker = "  const [confirmSubmit, setConfirmSubmit] = useState(false), [done, setDone] = useState(false), [feedback, setFeedback] = useState(''), [feedbackLoading, setFeedbackLoading] = useState(false), [whyLoading, setWhyLoading] = useState<number | null>(null), [why, setWhy] = useState<Record<number, string>>({});";
if (!s.includes('dailyQuizCount')) {
  const addition = String.raw`
  const [dailyQuizCount, setDailyQuizCount] = useState(0);
  const loadDailyQuizCount = async (user: any) => {
    try {
      const snap = await getDocs(query(collection(db, 'quizHistory'), where('userId', '==', user.uid)));
      const now = new Date();
      const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const count = snap.docs.filter((x) => {
        const d: any = x.data();
        if (d.status !== 'completed') return false;
        const v: any = d.data?.createdAt || d.createdAt;
        const ms = v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : Date.parse(String(v || '')));
        return Number.isFinite(ms) && ms >= start;
      }).length;
      setDailyQuizCount(count);
    } catch { setDailyQuizCount(0); }
  };`;
  if (!s.includes(stateMarker)) throw new Error('Quiz state marker not found');
  s = s.replace(stateMarker, stateMarker + addition);
}

s = s.replace(
  "setActive(d.activated === true && expiryMs(d.activationExpiresAt) > Date.now()); await load(u);",
  "setActive(d.activated === true && expiryMs(d.activationExpiresAt) > Date.now()); await Promise.all([load(u), loadDailyQuizCount(u)]);"
);

// Unactivated users may enter Quiz Studio. Activation is only required after the free daily allowance is exhausted.
s = s.replace(/  if \(!active\) return <main[\s\S]*?<\/main>;\n  if \(setup && quizLoading\)/, '  if (setup && quizLoading)');

s = s.replace(
  "  async function startQuiz() {\n    if (!selected.length) { setMessage('Choose at least one book before starting.'); return; }\n    setStarting(true); setMessage('');",
  "  async function startQuiz() {\n    if (!selected.length) { setMessage('Choose at least one book before starting.'); return; }\n    if (!active && dailyQuizCount >= 5) { setMessage('You have used all 5 free quizzes for today. Your free allowance resets at midnight UTC.'); return; }\n    const allowedQuestions = active ? 100 : 20;\n    const requestedQuestions = Math.min(allowedQuestions, Math.max(1, Number(questions) || 1));\n    setStarting(true); setMessage('');"
);
s = s.replace(
  "const chosen = books.filter((b) => selected.includes(b.id)); const next: Setup = { id: '', books: chosen.map((b) => ({ title: b.title, author: b.author })), questions, duration:",
  "const chosen = books.filter((b) => selected.includes(b.id)); const next: Setup = { id: '', books: chosen.map((b) => ({ title: b.title, author: b.author })), questions: requestedQuestions, duration:"
);
s = s.replace("books: next.books, questions, duration:", "books: next.books, questions: requestedQuestions, duration:");
s = s.replace(
  "    try { await updateDoc(doc(db, 'quizHistory', setup.id), { status: 'completed', questionsData: qs, answers, score: correct, total: qs.length, percentage, elapsedSeconds: elapsed, completedAt: serverTimestamp() }); } catch {}",
  "    try { await updateDoc(doc(db, 'quizHistory', setup.id), { status: 'completed', questionsData: qs, answers, score: correct, total: qs.length, percentage, elapsedSeconds: elapsed, completedAt: serverTimestamp() }); if (auth.currentUser) await loadDailyQuizCount(auth.currentUser); } catch {}"
);

// Restore the original runner header with Exit Quiz and the answered counter.
const oldHeader = '<div className="mx-auto max-w-4xl px-5 py-3 text-center"><div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-5 py-2 text-sm font-black">';
const newHeader = '<div className="mx-auto max-w-4xl px-5 py-3"><div className="flex items-center justify-between gap-3"><button onClick={() => setConfirmSubmit(true)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">Exit Quiz</button><div className="text-center"><div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-5 py-2 text-sm font-black">';
if (s.includes(oldHeader)) s = s.replace(oldHeader, newHeader);

const oldHeaderEnd = '<div className="mt-1 text-[11px] font-black uppercase tracking-wider text-slate-400">Time remaining</div></div></header>';
const newHeaderEnd = '<div className="mt-1 text-[11px] font-black uppercase tracking-wider text-slate-400">Time remaining</div></div><div className="w-[76px] text-right text-xs font-black text-slate-400">{answers.filter((x) => x !== undefined).length}/{qs.length}</div></div></div></header>';
if (s.includes(oldHeaderEnd)) s = s.replace(oldHeaderEnd, newHeaderEnd);

// Numbered navigator: current, answered and unanswered states are visually distinct.
const navigator = String.raw`<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Question navigator</span><span className="text-xs font-black text-slate-400">{idx + 1} of {qs.length}</span></div><div className="mt-3 flex flex-wrap gap-2">{qs.map((item, i) => { const answered = answers[i] !== undefined; const current = i === idx; return <button key={i} onClick={() => setIdx(i)} className={'grid h-9 w-9 place-items-center rounded-lg border text-xs font-black transition ' + (current ? 'border-eduBlue bg-eduBlue text-white ring-2 ring-blue-100' : answered ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300')}>{i + 1}</button>; })}</div></div>`;
const oldRunnerBody = '<div className="mx-auto max-w-3xl px-5 py-7"><div className="flex items-center justify-between text-xs font-black text-slate-400">';
const newRunnerBody = '<div className="mx-auto max-w-4xl px-5 py-6">' + navigator + '<div className="mt-5 flex items-center justify-between text-xs font-black text-slate-400">';
if (s.includes(oldRunnerBody)) s = s.replace(oldRunnerBody, newRunnerBody);

// AI review belongs inside the overview card.
const oldFeedback = String.raw`<section className="mt-6 rounded-[2rem] bg-white p-7 shadow-soft"><h2 className="text-xl font-black">🤖 AI Study Feedback</h2><p className="mt-3 leading-7 text-slate-600">{feedbackLoading ? 'EDUWILLS AI is reviewing your strengths and weaknesses…' : feedback || 'Your score has been recorded. Review the corrections below to strengthen your learning.'}</p></section>`;
const newFeedback = String.raw`<div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><div className="flex items-center gap-2"><Sparkles size={18} className="text-eduBlue"/><h2 className="font-black text-indigo-950">EDUWILLS AI Review</h2></div><p className="mt-3 leading-7 text-indigo-950">{feedbackLoading ? 'EDUWILLS AI is reviewing your strengths and weaknesses…' : feedback || 'Your score has been recorded. Review the corrections below to strengthen your learning.'}</p></div>`;
if (s.includes(oldFeedback)) s = s.replace(oldFeedback, newFeedback);

// Overview result navigator: every question is marked green (correct) or red (failed).
const status = String.raw`<div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-eduBlue">Question results</p><p className="text-sm font-bold text-slate-500">Green = correct · Red = failed</p></div><div className="text-xs font-black text-slate-400">{correct}/{qs.length} correct</div></div><div className="mt-4 flex flex-wrap gap-2">{qs.map((q, i) => <button key={i} onClick={() => document.getElementById('result-q-' + i)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={'grid h-10 w-10 place-items-center rounded-xl text-sm font-black text-white ' + (answers[i] === q.answer ? 'bg-emerald-500' : 'bg-red-500')}>{i + 1}</button>)}</div></div>`;
const correctionsMarker = '<section className="mt-6 rounded-[2rem] bg-white p-7 shadow-soft"><h2 className="text-xl font-black">Corrections</h2>';
if (s.includes(correctionsMarker)) s = s.replace(correctionsMarker, status + correctionsMarker);
s = s.replace('<article key={i} className="rounded-2xl border border-slate-200 p-5">', '<article id={\'result-q-\' + i} key={i} className="scroll-mt-5 rounded-2xl border border-slate-200 p-5">');

// Visible free-tier counter in Quiz Builder.
const builderMarker = '<p className="text-xs font-black uppercase tracking-wider text-eduBlue">Quiz Builder</p><h2 className="text-xl font-black">Design your quiz</h2></div></div>';
const counter = String.raw`<p className="text-xs font-black uppercase tracking-wider text-eduBlue">Quiz Builder</p><h2 className="text-xl font-black">Design your quiz</h2></div></div><div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-eduBlue">Free quiz allowance</p><p className="mt-1 text-sm font-bold text-slate-700">{active ? 'Activated account — full access' : dailyQuizCount + '/5 quizzes taken today'}</p></div>{!active && <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-eduBlue">{Math.max(0, 5 - dailyQuizCount)} left</span>}</div></div>`;
if (s.includes(builderMarker)) s = s.replace(builderMarker, counter);

s = s.replace('min="1" max="100" value={questions}', 'min="1" max={active ? 100 : 20} value={questions}');
s = s.replace('Math.min(100, Math.max(1, Number(e.target.value) || 1))', 'Math.min(active ? 100 : 20, Math.max(1, Number(e.target.value) || 1))');

// Never silently report success. If the repair did not reach the built source, fail the deployment.
const required = [
  ['daily quiz counter', 'dailyQuizCount'],
  ['free-tier gate', 'dailyQuizCount >= 5'],
  ['20-question free cap', 'active ? 100 : 20'],
  ['Exit Quiz control', 'Exit Quiz'],
  ['question navigator', 'Question navigator'],
  ['overview question results', 'Question results'],
  ['AI review', 'EDUWILLS AI Review'],
];
for (const [name, marker] of required) {
  if (!s.includes(marker)) throw new Error(`Quiz UI repair did not apply: ${name}`);
}

fs.writeFileSync(file, s);
console.log('EduWills Quiz Studio UI, free-tier counter and navigation repair applied and verified.');
