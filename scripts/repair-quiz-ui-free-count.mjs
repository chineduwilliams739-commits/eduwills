import fs from 'node:fs';

const file = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(file, 'utf8');

// Restore the custom dropdown system used by the original Quiz Studio.
s = s.replace("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useRef, useState } from 'react';");
if (!s.includes('function Menu(')) {
  const marker = "function normalize(value: string) { return value.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\\s+/g, ' ').trim(); }";
  if (!s.includes(marker)) throw new Error('normalize marker not found');
  const menu = String.raw`
function Menu({label,value,options,onChange}:{label:string;value:string|number;options:{value:string|number;label:string}[];onChange:(v:string|number)=>void}) {
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close)},[]);
  const selected=options.find(o=>String(o.value)===String(value));
  return <div ref={ref} className="relative">
    <span className="block text-sm font-black text-slate-700">{label}</span>
    <button type="button" onClick={()=>setOpen(v=>!v)} className="mt-2 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-4 py-3.5 text-left font-bold shadow-sm transition hover:border-indigo-300 hover:shadow-md">
      <span>{selected?.label||'Choose…'}</span><ChevronDown size={18} className={'text-slate-400 transition '+(open?'rotate-180':'')}/>
    </button>
    {open&&<div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
      {options.map(o=><button key={String(o.value)} type="button" onClick={()=>{onChange(o.value);setOpen(false)}} className={'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left font-bold transition '+(String(value)===String(o.value)?'bg-gradient-to-r from-indigo-50 to-cyan-50 text-eduBlue':'hover:bg-slate-50')}>
        {o.label}{String(value)===String(o.value)&&<Check size={17}/>}</button>)}
    </div>}
  </div>;
}
`;
  s = s.replace(marker, marker + menu);
}

// Restore styled dropdowns for slot, duration and difficulty.
const oldSlot = `<label className="mt-4 block text-sm font-black">Save to slot<div className="relative mt-2"><select value={slot} onChange={(e) => setSlot(e.target.value ? Number(e.target.value) : '')} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold"><option value="">Choose an empty slot…</option>{slots.map((b, i) => !b && <option key={i} value={i + 1}>Slot {i + 1}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/></div></label>`;
const newSlot = `<Menu label="Save to slot" value={slot} options={slots.map((b,i)=>({value:String(i+1),label:\`Slot ${i+1}\` })).filter((_,i)=>!slots[i])} onChange={(v)=>setSlot(v ? Number(v) : '')}/>`;
if (s.includes(oldSlot)) s=s.replace(oldSlot,newSlot);
const oldDuration = `<label className="text-sm font-black">Duration<div className="relative mt-2"><select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold"><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="none">No time limit</option></select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/></div></label>`;
const newDuration = `<Menu label="Duration" value={duration} options={[{value:'10',label:'10 minutes'},{value:'20',label:'20 minutes'},{value:'30',label:'30 minutes'},{value:'45',label:'45 minutes'},{value:'60',label:'60 minutes'},{value:'none',label:'No time limit'}]} onChange={(v)=>setDuration(String(v))}/>`;
if (s.includes(oldDuration)) s=s.replace(oldDuration,newDuration);
const oldDifficulty = `<label className="text-sm font-black">Difficulty<div className="relative mt-2"><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold"><option>Easy</option><option>Medium</option><option>Hard</option><option>Mixed</option></select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/></div></label>`;
const newDifficulty = `<Menu label="Difficulty" value={difficulty} options={[{value:'Easy',label:'Easy'},{value:'Medium',label:'Medium'},{value:'Hard',label:'Hard'},{value:'Mixed',label:'Mixed'}]} onChange={(v)=>setDifficulty(String(v))}/>`;
if (s.includes(oldDifficulty)) s=s.replace(oldDifficulty,newDifficulty);

// Free-tier state and daily completed-quiz counter.
if (!s.includes('dailyQuizCount')) {
  const state = "  const [confirmSubmit, setConfirmSubmit] = useState(false), [done, setDone] = useState(false), [feedback, setFeedback] = useState(''), [feedbackLoading, setFeedbackLoading] = useState(false), [whyLoading, setWhyLoading] = useState<number | null>(null), [why, setWhy] = useState<Record<number, string>>({});";
  if (!s.includes(state)) throw new Error('quiz state marker not found');
  const addition = `
  const [dailyQuizCount, setDailyQuizCount] = useState(0);
  const loadDailyQuizCount = async (user: any) => {
    try {
      const snap = await getDocs(query(collection(db, 'quizHistory'), where('userId', '==', user.uid)));
      const start = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
      const count = snap.docs.filter((x) => { const d:any=x.data(); if(d.status!=='completed') return false; const v:any=d.completedAt||d.createdAt; const ms=v?.toMillis?v.toMillis():(v?.seconds?v.seconds*1000:Date.parse(String(v||''))); return Number.isFinite(ms)&&ms>=start; }).length;
      setDailyQuizCount(count);
    } catch { setDailyQuizCount(0); }
  };`;
  s = s.replace(state, state + addition);
}

s = s.replace(
  "setActive(d.activated === true && expiryMs(d.activationExpiresAt) > Date.now()); await load(u);",
  "setActive(d.activated === true && expiryMs(d.activationExpiresAt) > Date.now()); await Promise.all([load(u), loadDailyQuizCount(u)]);"
);

// Remove the activation wall from Quiz Studio. Unactivated users get 5 quizzes/day.
s = s.replace(/  if \(!active\) return <main[\s\S]*?<\/main>;\n  if \(setup && quizLoading\)/, '  if (setup && quizLoading)');

// Enforce 5 free quizzes/day and 20-question maximum for unactivated users.
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

// Styled free-tier counter in the builder.
const builder = '<p className="text-xs font-black uppercase tracking-wider text-eduBlue">Quiz Builder</p><h2 className="text-xl font-black">Design your quiz</h2></div></div>';
if (s.includes(builder) && !s.includes('Free quiz allowance')) {
  s = s.replace(builder, builder + `<div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-eduBlue">Free quiz allowance</p><p className="mt-1 text-sm font-bold text-slate-700">{active ? 'Activated account — full access' : dailyQuizCount + '/5 quizzes taken today'}</p></div>{!active && <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-eduBlue">{Math.max(0,5-dailyQuizCount)} left</span>}</div></div>`);
}

s = s.replace('min="1" max="100" value={questions}', 'min="1" max={active ? 100 : 20} value={questions}');
s = s.replace('Math.min(100, Math.max(1, Number(e.target.value) || 1))', 'Math.min(active ? 100 : 20, Math.max(1, Number(e.target.value) || 1))');

// Restore quiz navigation and Exit Quiz.
if (!s.includes('Question navigator')) {
  const marker = '<div className="mx-auto max-w-3xl px-5 py-7"><div className="flex items-center justify-between text-xs font-black text-slate-400">';
  const replacement = `<div className="mx-auto max-w-4xl px-5 py-6"><div className="flex items-center justify-between gap-3"><button type="button" onClick={() => { if (window.confirm('Exit this quiz? Your current progress will be lost.')) resetQuiz(); }} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">Exit Quiz</button><span className="text-xs font-black text-slate-400">Question {idx+1} of {qs.length}</span><span className="text-xs font-black text-slate-400">{answers.filter((x) => x !== undefined).length}/{qs.length} answered</span></div><div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Question navigator</span><span className="text-xs font-black text-slate-400">Tap a number to jump</span></div><div className="flex flex-wrap gap-2">{qs.map((_,i)=><button key={i} type="button" onClick={()=>setIdx(i)} className={'grid h-9 w-9 place-items-center rounded-lg border text-xs font-black '+(i===idx?'border-eduBlue bg-eduBlue text-white ring-2 ring-blue-100':answers[i]!==undefined?'border-emerald-300 bg-emerald-50 text-emerald-700':'border-slate-200 bg-white text-slate-500')}>{i+1}</button>)}</div></div><div className="mt-5 flex items-center justify-between text-xs font-black text-slate-400">`;
  if (!s.includes(marker)) throw new Error('quiz runner marker not found');
  s = s.replace(marker, replacement);
}

// Keep AI review inside the overview card and add question result navigation.
const feedbackOld = '<section className="mt-6 rounded-[2rem] bg-white p-7 shadow-soft"><h2 className="text-xl font-black">🤖 AI Study Feedback</h2><p className="mt-3 leading-7 text-slate-600">{feedbackLoading ? \'EDUWILLS AI is reviewing your strengths and weaknesses…\' : feedback || \'Your score has been recorded. Review the corrections below to strengthen your learning.\'}</p></section>';
if (s.includes(feedbackOld)) {
  s = s.replace(feedbackOld, '<div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><div className="flex items-center gap-2"><Sparkles size={18} className="text-eduBlue"/><h2 className="font-black text-indigo-950">EDUWILLS AI Review</h2></div><p className="mt-3 leading-7 text-indigo-950">{feedbackLoading ? \'EDUWILLS AI is reviewing your strengths and weaknesses…\' : feedback || \'Your score has been recorded. Review the corrections below to strengthen your learning.\'}</p></div>');
}
if (!s.includes('Question results')) {
  const corr = '<section className="mt-6 rounded-[2rem] bg-white p-7 shadow-soft"><h2 className="text-xl font-black">Corrections</h2>';
  const status = `<div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-eduBlue">Question results</p><p className="text-sm font-bold text-slate-500">Green = correct · Red = failed</p></div><span className="text-xs font-black text-slate-400">{correct}/{qs.length} correct</span></div><div className="mt-4 flex flex-wrap gap-2">{qs.map((q,i)=><button key={i} type="button" onClick={()=>document.getElementById('result-q-'+i)?.scrollIntoView({behavior:'smooth',block:'center'})} className={'grid h-10 w-10 place-items-center rounded-xl text-sm font-black text-white '+(answers[i]===q.answer?'bg-emerald-500':'bg-red-500')}>{i+1}</button>)}</div></div>`;
  if (!s.includes(corr)) throw new Error('corrections marker not found');
  s = s.replace(corr, status + corr);
}
s = s.replace('<article key={i} className="rounded-2xl border border-slate-200 p-5">', '<article id={\'result-q-\'+i} key={i} className="scroll-mt-5 rounded-2xl border border-slate-200 p-5">');

// History is restricted for unactivated users.
s = s.replace('<a href={`${BASE}/dashboard/history/`} className="rounded-xl bg-ink px-5 py-3 font-black text-white">View History</a>', "{active ? <a href={`${BASE}/dashboard/history/`} className=\"rounded-xl bg-ink px-5 py-3 font-black text-white\">View History</a> : <span className=\"rounded-xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-500\">History unlocks after activation</span>}");

const required = ['dailyQuizCount','dailyQuizCount >= 5','active ? 100 : 20','Exit Quiz','Question navigator','Free quiz allowance','Question results','EDUWILLS AI Review','function Menu('];
for (const marker of required) if (!s.includes(marker)) throw new Error('Quiz UI repair did not apply: '+marker);

fs.writeFileSync(file,s);
console.log('Quiz Studio UI/free-tier/dropdown repair applied and verified.');
