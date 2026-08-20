import fs from 'node:fs';

const quizFile='app/dashboard/quiz/page.tsx';
let q=fs.readFileSync(quizFile,'utf8');

q=q.replace("const minutes = duration === 'none' ? null : Number(duration);", "const minutes = duration === 'none' ? null : Math.max(5, Number(duration) || 5);");
q=q.replace('className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3"', 'className="relative mx-auto flex max-w-4xl items-center px-5 py-3"');
q=q.replace('<div className="text-center"><div className={`inline-flex items-center gap-2 rounded-full', '<div className="mx-auto text-center"><div className={`inline-flex items-center gap-2 rounded-full');
q=q.replace('className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 shadow-sm"', 'className="absolute left-5 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-black text-red-700 shadow-sm"');
q=q.replace('<span>QUESTION {idx + 1} OF {qs.length}</span><span>{answers.filter((x) => x !== undefined).length} answered</span>', '<span className="sr-only">Question {idx + 1} of {qs.length}</span><span>{answers.filter((x) => x !== undefined).length} answered</span>');
q=q.replace('<section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8"><h1', '<section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8"><p className="mb-2 text-xs font-black uppercase tracking-wider text-eduBlue">Question {idx + 1}</p><h1');
q=q.replace('className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-sm disabled:opacity-40"', 'className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-black disabled:opacity-40"');
q=q.replace('className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-3 font-black text-sm text-white disabled:opacity-40"', 'className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40"');
q=q.replace('className="flex-1 rounded-xl bg-ink px-4 py-3 font-black text-sm text-white disabled:opacity-40"', 'className="flex-1 rounded-lg bg-ink px-3 py-2.5 text-xs font-black text-white disabled:opacity-40"');
q=q.replace('{answers.filter((x) => x !== undefined)} answered questions.', '{answers.filter((x) => x !== undefined).length} answered questions.');
fs.writeFileSync(quizFile,q);

const adminFile='app/admin/page.tsx';
let a=fs.readFileSync(adminFile,'utf8');
if(!a.includes("const [customDurationValue, setCustomDurationValue]")){
  a=a.replace("const [duration, setDuration] = useState('30 days');", "const [duration, setDuration] = useState('30 days');\n  const [customDurationValue, setCustomDurationValue] = useState('30');\n  const [customDurationUnit, setCustomDurationUnit] = useState<'minutes'|'hours'|'days'>('days');");
}
if(!a.includes('function manualDurationMs(')){
  const marker='function remaining(date: Date | null) {';
  const helper="function manualDurationMs(value: string, unit: 'minutes'|'hours'|'days') { const n = Number(value); if (!Number.isFinite(n) || n <= 0) return 0; return n * (unit === 'minutes' ? 60000 : unit === 'hours' ? 3600000 : 86400000); }\n\n";
  if(!a.includes(marker)) throw new Error('Admin remaining marker not found');
  a=a.replace(marker, helper+marker);
}
a=a.replace("const ms = durations.find(x => x[0] === chosen)?.[1];", "const ms = chosen === 'custom' ? manualDurationMs(customDurationValue, customDurationUnit) : durations.find(x => x[0] === chosen)?.[1];");
a=a.replace("if (!ms) return alert('No valid WilliToken duration is configured for this user.');", "if (!ms) return alert('Enter a valid manual WilliToken duration greater than zero.');");
const oldTokenUI='<select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold">{durations.map(x => <option key={x[0]} value={x[0]}>{x[0]}</option>)}</select><button onClick={createToken}';
const newTokenUI='<div className="grid gap-2"><select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold">{durations.map(x => <option key={x[0]} value={x[0]}>{x[0]}</option>)}<option value="custom">Custom duration…</option></select>{duration === \'custom\' && <div className="grid grid-cols-2 gap-2"><input type="number" min="1" step="1" value={customDurationValue} onChange={e => setCustomDurationValue(e.target.value)} placeholder="Amount" className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold"/><select value={customDurationUnit} onChange={e => setCustomDurationUnit(e.target.value as \'minutes\'|\'hours\'|\'days\')} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold"><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div>}</div><button onClick={createToken}';
if(a.includes(oldTokenUI)) a=a.replace(oldTokenUI,newTokenUI); else if(!a.includes('Custom duration…')) throw new Error('Admin WilliToken duration UI marker not found');
fs.writeFileSync(adminFile,a);
console.log('Latest quiz positioning, minimum duration, question labels, compact controls, and manual WilliToken duration applied.');
