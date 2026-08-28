import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(path, 'utf8');

// Recover JSX that was accidentally escaped during earlier automated repairs.
s = s.replace(/\\<(?=\/?[A-Za-z])/g, '<');
s = s.replace(/\\>/g, '>');
s = s.replace(/\\`/g, '`');

const styledClass = 'appearance-none w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';

// Repair malformed handlers produced by previous dropdown scripts.
s = s.replace(/onChange=\{\(e\)\s*=\s*className="[^"]*"\s*data-eduwills-styled="true">\s*([^}]+)\}/g, 'onChange={(e) => $1}');

// Restore the three styled selects by their state bindings. This is intentionally
// idempotent so repeated deployment runs cannot degrade the JSX.
s = s.replace(/(<select\s+value=\{slot\}\s+onChange=\{\(e\)\s*=>\s*setSlot\(e\.target\.value\s*\?\s*Number\(e\.target\.value\)\s*:\s*''\)\})\s+className="[^"]*"(?:\s+data-eduwills-styled="true")?/g, `$1 className="${styledClass}" data-eduwills-styled="true"`);
s = s.replace(/(<select\s+value=\{duration\}\s+onChange=\{\(e\)\s*=>\s*setDuration\(e\.target\.value\)\})\s+className="[^"]*"(?:\s+data-eduwills-styled="true")?/g, `$1 className="${styledClass}" data-eduwills-styled="true"`);
s = s.replace(/(<select\s+value=\{difficulty\}\s+onChange=\{\(e\)\s*=>\s*setDifficulty\(e\.target\.value\)\})\s+className="[^"]*"(?:\s+data-eduwills-styled="true")?/g, `$1 className="${styledClass}" data-eduwills-styled="true"`);

// Also support the plain select form if an older repair restored it without the
// exact handler formatting above.
s = s.replace(/(<select\s+value=\{slot\}[^>]*?)\s+className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3\.5 font-bold"/g, `$1 className="${styledClass}" data-eduwills-styled="true"`);
s = s.replace(/(<select\s+value=\{duration\}[^>]*?)\s+className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3\.5 font-bold"/g, `$1 className="${styledClass}" data-eduwills-styled="true"`);
s = s.replace(/(<select\s+value=\{difficulty\}[^>]*?)\s+className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3\.5 font-bold"/g, `$1 className="${styledClass}" data-eduwills-styled="true"`);

// Never allow a known malformed handler to reach the Next.js compiler.
if (/onChange=\{\(e\)\s*=\s*className=/.test(s)) {
  throw new Error('Malformed quiz dropdown handler remains');
}
if (!/return\s+<main\b/.test(s)) {
  throw new Error('Quiz page JSX main is missing');
}

fs.writeFileSync(path, s);
console.log('Quiz page v12 syntax/dropdown repair applied safely.');
