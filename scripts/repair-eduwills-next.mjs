import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const must = (condition, message) => { if (!condition) throw new Error(message); };

// Keep the quiz AI client as the single source of truth for the cache-first,
// exact-book generation implementation.
write('lib/quizAiClient.ts', read('scripts/quizAiClient.final.ts'));

let quiz = read('app/dashboard/quiz/page.tsx');

// Imports and username used by the fresh result image.
quiz = quiz.replace(
  /import \{ explainFailure as explainQuizFailure, generateQuiz, generateRemarks, researchBooks(?:, searchBookAuthors)? \} from '@\/lib\/quizAiClient';/,
  "import { explainFailure as explainQuizFailure, generateQuiz, generateRemarks, researchBooks, searchBookAuthors } from '@/lib/quizAiClient';"
);
if (!quiz.includes("const [username, setUsername] = useState('');")) {
  quiz = quiz.replace(
    "const [freeQuizCount, setFreeQuizCount] = useState(0), [timeWarning, setTimeWarning] = useState('');",
    "const [freeQuizCount, setFreeQuizCount] = useState(0), [timeWarning, setTimeWarning] = useState('');\n  const [username, setUsername] = useState('');"
  );
}
quiz = quiz.replace(
  "const d = s.data() || {};\n      const isActive",
  "const d = s.data() || {};\n      setUsername(String(d.username || d.userName || d.fullName || u.displayName || '').replace(/^@/, '').trim());\n      const isActive"
);

// Remove the small hard-coded book list so the search is not limited to Sànyà/SCARS.
quiz = quiz.replace(/type CuratedBook = [^\n]+\n\nconst CURATED_BOOKS:[\s\S]*?\n\];\n\n/, '');

// Replace the old title/author search with the broadened multi-source search service.
const findBookReplacement = `  async function findBook() {
    const raw = title.trim(); if (!raw) return;
    setSearching(true); setMessage(''); setAuthors([]); setAuthor(''); setAuthorQuery('');
    try {
      const results = await searchBookAuthors('title', raw);
      const exact = results.filter(r => normalize(r.title) === normalize(raw));
      const usable = exact.length ? exact : results.slice(0, 50);
      const names = Array.from(new Set(usable.flatMap(r => r.authors).filter(Boolean))).slice(0, 50);
      setAuthors(names);
      setMessage(names.length ? 'Select a verified author from the broadened book index.' : 'No verified author was found. Try the exact title or search the author by name.');
    } catch { setMessage('Book search is temporarily unavailable.'); } finally { setSearching(false); }
  }

  async function searchAuthor() {`;
quiz = quiz.replace(/  async function findBook\(\) \{[\s\S]*?\n  \}\n\n  async function searchAuthor\(\) \{/, findBookReplacement);

const authorReplacement = `  async function searchAuthor() {
    const q = authorQuery.trim(); if (!q) return;
    setSearching(true);
    try {
      const results = await searchBookAuthors('author', q);
      const names = Array.from(new Set(results.flatMap(r => r.authors).filter(Boolean))).slice(0, 50);
      setAuthors(names);
      setMessage(names.length ? 'Select a verified author from the broadened book index.' : 'No verified author match was found. Try another spelling.');
    } finally { setSearching(false); }
  }

  async function saveBook() {`;
quiz = quiz.replace(/  async function searchAuthor\(\) \{[\s\S]*?\n  \}\n\n  async function saveBook\(\) \{/, authorReplacement);

// Fresh result image: this only changes the image downloaded immediately after a quiz.
// Quiz History remains untouched.
const imagePatch = [
  '  function makeResultImage(): Promise<Blob> {',
  '    return new Promise((resolve) => {',
  '      const canvas = document.createElement(\'canvas\'); canvas.width = 1400; canvas.height = 1000;',
  '      const g = canvas.getContext(\'2d\')!; const score = scoreFor(qs, answers); const pct = scoreFor(qs, answers, true);',
  '      g.fillStyle = \'#07111f\'; g.fillRect(0, 0, 1400, 1000);',
  '      g.fillStyle = \'#123b5d\'; g.fillRect(0, 0, 1400, 220);',
  '      g.fillStyle = \'#22d3ee\'; g.beginPath(); g.arc(1280, 80, 180, 0, Math.PI * 2); g.fill();',
  '      g.fillStyle = \'#fff\'; g.font = \'900 52px sans-serif\'; g.fillText(\'EDUWILLS\', 75, 78); g.font = \'900 32px sans-serif\'; g.fillText(\'TEST OVERVIEW\', 75, 132);',
  '      g.font = \'900 116px sans-serif\'; g.fillText(String(pct) + \'%\', 75, 350); g.font = \'700 34px sans-serif\'; g.fillText(String(score) + \'/\' + qs.length + \' correct\', 80, 405);',
  '      g.font = \'600 25px sans-serif\';',
  '      const lines = [',
  '        \'Username: @\' + (username || \'learner\'),',
  '        \'Date: \' + new Date().toLocaleString(undefined, { dateStyle: \'medium\', timeStyle: \'short\' }),',
  '        \'Books: \' + ((setup && setup.books ? setup.books.map(b => b.title).join(\', \') : \'\') || \'Quiz\'),',
  '        \'Difficulty: \' + ((setup && setup.difficulty) || \'Mixed\'),',
  '        \'Time allocated: \' + (setup && setup.duration ? setup.duration + \' minutes\' : \'No time limit\'),',
  '        \'Time elapsed: \' + elapsedText(elapsed)',
  '      ];',
  '      lines.forEach((t, i) => g.fillText(String(t).slice(0, 78), 80, 490 + i * 48));',
  '      g.fillStyle = \'#0f2238\'; g.beginPath(); g.roundRect(760, 285, 540, 430, 28); g.fill();',
  '      g.fillStyle = \'#fff\'; g.font = \'900 28px sans-serif\'; g.fillText(\'EDUWILLS AI INSIGHT\', 805, 340); g.font = \'500 23px sans-serif\';',
  '      const text = String(feedback || \'Review the correction section to identify your strongest and weakest areas.\').replace(/\\s+/g, \' \').trim(); let line = \'\'; let y = 390;',
  '      for (const word of text.split(\' \')) { const test = line ? line + \' \' + word : word; if (g.measureText(test).width > 450) { g.fillText(line, 805, y); y += 36; line = word; if (y > 665) break; } else line = test; }',
  '      if (line && y <= 665) g.fillText(line, 805, y);',
  '      g.fillStyle = \'#94a3b8\'; g.font = \'500 19px sans-serif\'; g.fillText(\'Generated by EDUWILLS\', 80, 930); canvas.toBlob(b => resolve(b!), \'image/png\');',
  '    });',
  '  }',
  '  async function downloadResult'
].join('\n');
quiz = quiz.replace(/  function makeResultImage\(\): Promise<Blob> \{[\s\S]*?\n  \}\n  async function downloadResult/, imagePatch);

// Restore the polished Quiz Studio controls without touching the quiz-history design.
if (!quiz.includes('function Menu({label,value,options,onChange}')) {
  const marker = "function cleanText(text: string) { return String(text || '').replace(/```[\\s\\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/\\s+/g, ' ').trim(); }";
  must(quiz.includes(marker), 'Quiz page marker not found while restoring Quiz Studio menus.');
  const menu = String.raw`
function Menu({label,value,options,onChange}:{label:string;value:string|number;options:{value:string|number;label:string}[];onChange:(v:string|number)=>void}) {
  const [open,setOpen]=useState(false);
  const selected=options.find((o)=>String(o.value)===String(value));
  return <div className="relative">
    <span className="block text-sm font-black">{label}</span>
    <button type="button" onClick={()=>setOpen((v)=>!v)} className="mt-2 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-4 py-3.5 text-left font-bold shadow-sm transition hover:border-indigo-300 hover:shadow-md">
      <span>{selected?.label || 'Choose…'}</span><ChevronDown size={18} className={'text-slate-400 transition '+(open?'rotate-180':'')}/>
    </button>
    {open && <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
      {options.map((o)=><button key={String(o.value)} type="button" onClick={()=>{onChange(o.value);setOpen(false)}} className={'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left font-bold transition '+(String(value)===String(o.value)?'bg-gradient-to-r from-indigo-50 to-cyan-50 text-eduBlue':'hover:bg-slate-50')}>
        {o.label}{String(value)===String(o.value)&&<Check size={17}/>}</button>)}
    </div>}
  </div>;
}
`;
  quiz = quiz.replace(marker, marker + menu);
}
quiz = quiz.replace(/<label className="mt-4 block text-sm font-black">Save to slot[\s\S]*?<\/label>/, '<Menu label="Save to slot" value={slot} options={slots.map((b,i)=>({value:String(i+1),label:`Slot ${i+1}`})).filter((_,i)=>!slots[i])} onChange={(v)=>setSlot(v ? Number(v) : "")}/>');
quiz = quiz.replace(/<label className="text-sm font-black">Duration[\s\S]*?<\/label>/, '<Menu label="Duration" value={duration} options={[{value:"10",label:"10 minutes"},{value:"20",label:"20 minutes"},{value:"30",label:"30 minutes"},{value:"45",label:"45 minutes"},{value:"60",label:"60 minutes"},{value:"none",label:"No time limit"}]} onChange={(v)=>setDuration(String(v))}/>');
quiz = quiz.replace(/<label className="text-sm font-black">Difficulty[\s\S]*?<\/label>/, '<Menu label="Difficulty" value={difficulty} options={[{value:"Easy",label:"Easy"},{value:"Medium",label:"Medium"},{value:"Hard",label:"Hard"},{value:"Mixed",label:"Mixed"}]} onChange={(v)=>setDifficulty(String(v))}/>');

// Restore the branded AI-processing screen.
const processing = String.raw`<div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-cyan-200/60 bg-white shadow-2xl"><div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white sm:p-9"><div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-200"><Sparkles size={28}/></div><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">EDUWILLS AI • QUIZ STUDIO</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">AI is processing your quiz…</h1><p className="mt-2 text-sm leading-6 text-slate-300">Checking your selected books, consulting verified learning context, and preparing a balanced question set.</p></div></div></div><div className="p-6 sm:p-8"><div className="grid gap-3"><div className="flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500 text-white"><Loader2 className="animate-spin" size={18}/></span><div><p className="text-sm font-black text-slate-900">Reading selected books</p><p className="text-xs text-slate-500">Keeping every question inside the exact book scope.</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white"><BookOpen size={18}/></span><div><p className="text-sm font-black text-slate-900">Checking cache before AI generation</p><p className="text-xs text-slate-500">Cached verified questions are reused first to reduce AI calls and waiting time.</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white"><Sparkles size={18}/></span><div><p className="text-sm font-black text-slate-900">Building your quiz</p><p className="text-xs text-slate-500">Balancing difficulty and avoiding repeated questions.</p></div></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-indigo-600 via-cyan-500 to-cyan-300"/></div><p className="mt-3 text-center text-xs font-bold text-slate-400">This screen stays visible until the question set is ready.</p>{setup?.books?.length ? <div className="mt-5 flex flex-wrap justify-center gap-2">{setup.books.map((b,i)=><span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">{b.title}</span>)}</div> : null}</div></div>`;
quiz = quiz.replace(/  if \(setup && quizLoading\) return <main[\s\S]*?<\/main>;\n\n  if \(setup && done\)/, `  if (setup && quizLoading) return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-5 sm:p-8">${processing}</main>;

  if (setup && done)`);

write('app/dashboard/quiz/page.tsx', quiz);

// Make activation buttons readable against the dark/cyan EDUWILLS theme.
let activation = read('app/dashboard/activation/page.tsx');
const oldDashboardButton = `className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black shadow-lg transition hover:-translate-y-0.5" style={{background:'#0b1830',borderColor:'#22d3ee',color:'#ffffff',fontWeight:900,letterSpacing:'0.01em',boxShadow:'0 8px 24px rgba(2,6,23,.35), 0 0 0 1px rgba(34,211,238,.08)'}}`;
activation = activation.replace(oldDashboardButton, 'className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/50 bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-2.5 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:brightness-105"');
activation = activation.replace('className="mt-3 w-full rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white shadow-lg disabled:opacity-50"', 'className="mt-3 w-full rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 px-5 py-3.5 font-black text-white shadow-lg shadow-cyan-900/20 transition hover:brightness-105 disabled:opacity-50"');
activation = activation.replace('className="mt-6 w-full rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white"', 'className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 px-5 py-3.5 font-black text-white shadow-lg shadow-cyan-900/20 transition hover:brightness-105"');
write('app/dashboard/activation/page.tsx', activation);

// Keep the education/news feed on the dashboard without disturbing the existing layout.
let dashboard = read('app/dashboard/page.tsx');
if (!dashboard.includes("import EducationFeed from '@/components/EducationFeed';")) {
  dashboard = dashboard.replace("import { auth, db } from '@/lib/firebase';", "import { auth, db } from '@/lib/firebase';\nimport EducationFeed from '@/components/EducationFeed';");
}
if (!dashboard.includes('<EducationFeed />')) {
  dashboard = dashboard.replace('  </div>\n  <nav className="fixed bottom-0', '    <EducationFeed />\n  </div>\n  <nav className="fixed bottom-0');
}
write('app/dashboard/page.tsx', dashboard);

must(quiz.includes("searchBookAuthors('title', raw)"), 'Broadened title search was not wired into Quiz Studio.');
must(quiz.includes("searchBookAuthors('author', q)"), 'Broadened author search was not wired into Quiz Studio.');
must(quiz.includes('canvas.width = 1400; canvas.height = 1000;'), 'Fresh quiz result image was not upgraded.');
must(quiz.includes('function Menu({label,value,options,onChange}'), 'Quiz Studio custom menus were not restored.');
must(quiz.includes('AI is processing your quiz'), 'Quiz AI processing screen was not restored.');
must(activation.includes('Activate with WilliToken'), 'Activation page is missing the WilliToken action.');
must(activation.includes('from-cyan-500 via-sky-500 to-indigo-600'), 'Activation action styling was not restored.');
must(dashboard.includes('<EducationFeed />'), 'EducationFeed component was not wired into the dashboard.');
must(fs.existsSync('components/EducationFeed.tsx'), 'EducationFeed component is missing.');

console.log('EDUWILLS stable implementation applied: broadened book search, cache-first quiz generation, fresh result image, restored Quiz Studio menus/processing UI, readable activation actions, and education feed.');
