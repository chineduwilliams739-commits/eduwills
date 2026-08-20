import fs from 'node:fs';

const file = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(file, 'utf8');

if (!s.includes('function Menu({')) {
  const marker = "function cleanText(text: string) { return String(text || '').replace(/```[\\s\\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/\\s+/g, ' ').trim(); }";
  if (!s.includes(marker)) throw new Error('Quiz page marker not found');
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
  s = s.replace(marker, marker + menu);
}

const slotOld = `<label className="mt-4 block text-sm font-black">Save to slot<div className="relative mt-2"><select value={slot} onChange={(e) => setSlot(e.target.value ? Number(e.target.value) : '')} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold"><option value="">Choose an empty slot…</option>{slots.map((b, i) => !b && <option key={i} value={i + 1}>Slot {i + 1}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/></div></label>`;
const slotNew = `<Menu label="Save to slot" value={slot} options={slots.map((b,i)=>({value:String(i+1),label:\`Slot ${i+1}\`})).filter((_,i)=>!slots[i])} onChange={(v)=>setSlot(v ? Number(v) : '')}/>`;
if (s.includes(slotOld)) s = s.replace(slotOld, slotNew);

const durationOld = `<label className="text-sm font-black">Duration<div className="relative mt-2"><select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold"><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="none">No time limit</option></select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/></div></label>`;
const durationNew = `<Menu label="Duration" value={duration} options={[{value:'10',label:'10 minutes'},{value:'20',label:'20 minutes'},{value:'30',label:'30 minutes'},{value:'45',label:'45 minutes'},{value:'60',label:'60 minutes'},{value:'none',label:'No time limit'}]} onChange={(v)=>setDuration(String(v))}/>`;
if (s.includes(durationOld)) s = s.replace(durationOld, durationNew);

const difficultyOld = `<label className="text-sm font-black">Difficulty<div className="relative mt-2"><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold"><option>Easy</option><option>Medium</option><option>Hard</option><option>Mixed</option></select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/></div></label>`;
const difficultyNew = `<Menu label="Difficulty" value={difficulty} options={[{value:'Easy',label:'Easy'},{value:'Medium',label:'Medium'},{value:'Hard',label:'Hard'},{value:'Mixed',label:'Mixed'}]} onChange={(v)=>setDifficulty(String(v))}/>`;
if (s.includes(difficultyOld)) s = s.replace(difficultyOld, difficultyNew);

// Never display an array directly in the exit warning.
s = s.replace("⚠️ You have {answers.filter((x) => x !== undefined)} answered questions.", "⚠️ You have {answers.filter((x) => x !== undefined).length} answered questions.");

// The result view must not regain the removed standalone numbered-result section.
s = s.replace(/<div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">\{\/\* QUESTION RESULTS \*\/\}[\\s\\S]*?<\\/div>/g, '');

fs.writeFileSync(file, s);
console.log('Quiz Studio final polish applied: styled menus, compact exit warning and preserved overview layout.');
