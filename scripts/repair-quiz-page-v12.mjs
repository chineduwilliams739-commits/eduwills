import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(path, 'utf8');

// Recover JSX that was accidentally escaped during previous automated repairs.
s = s.replace(/\\<(?=\/?[A-Za-z])/g, '<');
s = s.replace(/\\>/g, '>');
s = s.replace(/\\`/g, '`');

// Repair malformed select onChange attributes introduced by the dropdown restoration.
s = s.replace(/onChange=\{\(e\)\s*=\s*className="[^"]*"\s*data-eduwills-styled="true">\s*([^}]+)\}/g, 'onChange={(e) => $1}');

// The previous transformation can leave the original className immediately after the handler.
s = s.replace(/onChange=\{\(e\) => ([^}]+)\}\s*className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3\.5 font-bold"/g, 'onChange={(e) => $1} className="appearance-none w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" data-eduwills-styled="true"');
s = s.replace(/onChange=\{\(e\) => setSlot\(e\.target\.value \? Number\(e\.target\.value\) : ''\)\}\s*className="appearance-none[^\"]*"\s*data-eduwills-styled="true"/g, 'onChange={(e) => setSlot(e.target.value ? Number(e.target.value) : \'\')} className="appearance-none w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" data-eduwills-styled="true"');
s = s.replace(/onChange=\{\(e\) => setDuration\(e\.target\.value\)\}\s*className="appearance-none[^\"]*"\s*data-eduwills-styled="true"/g, 'onChange={(e) => setDuration(e.target.value)} className="appearance-none w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" data-eduwills-styled="true"');
s = s.replace(/onChange=\{\(e\) => setDifficulty\(e\.target\.value\)\}\s*className="appearance-none[^\"]*"\s*data-eduwills-styled="true"/g, 'onChange={(e) => setDifficulty(e.target.value)} className="appearance-none w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" data-eduwills-styled="true"');

fs.writeFileSync(path, s);
console.log('Quiz page v12 syntax/dropdown repair applied.');
