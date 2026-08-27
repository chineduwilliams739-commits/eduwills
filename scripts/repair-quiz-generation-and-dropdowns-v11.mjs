import fs from 'node:fs';

const aiPath = 'lib/quizAiClient.ts';
const pagePath = 'app/dashboard/quiz/page.tsx';
let ai = fs.readFileSync(aiPath, 'utf8');
let page = fs.readFileSync(pagePath, 'utf8');

// Marker-independent repair: previous scripts change the exact shape of this file.
const evidence = [
  'EXACT-BOOK EVIDENCE — Sànyà (Sanya) by Oyin Olugbile has a female protagonist named Sànyà.',
  'EXACT-BOOK EVIDENCE — Dàda is Sànyà’s older brother; he is physically frail and clairvoyant.',
  'EXACT-BOOK EVIDENCE — Àjokè and Aganjú are Sànyà and Dàda’s parents.',
  'EXACT-BOOK EVIDENCE — Important story locations include Bániré, Arómiré and Oluji.',
  'GROUNDING RULE — Never infer gender, relationships, age, setting, occupation, personality, or events from a name, appearance, title, mythology, or generic knowledge.',
  'GROUNDING RULE — Never invent character names or substitute another Sango/Yoruba story for Oyin Olugbile’s Sànyà.'
].join('\\n');

ai = ai.replace(/const CACHE\s*=\s*[\'\"][^\'\"]*[\'\"];?/, "const CACHE='v23-exact-book-resumable-v11';");

const marker = 'const EDUWILLS_EXACT_BOOK_GROUNDING = ';
if (!ai.includes(marker)) {
  const declaration = marker + JSON.stringify(evidence) + ';';
  const validEnd = ai.search(/\nconst ai\s*=\s*getAI\(/);
  if (validEnd >= 0) ai = ai.slice(0, validEnd) + '\n' + declaration + ai.slice(validEnd);
  else ai = declaration + '\n' + ai;
}

const instruction = ' STRICT EXACT-BOOK GROUNDING: use only evidence for the exact selected book and author; never infer gender, relationships, age, setting, occupation, personality, or events from names, appearance, titles, mythology, or general knowledge; never substitute another similarly named work; every question must be supported by exact-book research evidence. ';
if (!ai.includes('EXACT-BOOK RESEARCH EVIDENCE')) {
  ai = ai.replace('You are EDUWILLS Quiz AI.', 'You are EDUWILLS Quiz AI.' + instruction + 'EXACT-BOOK RESEARCH EVIDENCE IS REQUIRED.');
}

// Add a curated evidence block to the Sànyà research path if the current implementation has one.
if (!ai.includes('CURATED EXACT-BOOK EVIDENCE')) {
  const researchFn = ai.indexOf('export async function researchBooks');
  const nextExport = researchFn >= 0 ? ai.indexOf('\nexport async function', researchFn + 10) : -1;
  if (researchFn >= 0) {
    const end = nextExport > researchFn ? nextExport : ai.length;
    const fn = ai.slice(researchFn, end);
    if (fn.includes('const chunks')) {
      const patched = fn.replace('const chunks', 'const chunks').replace('{', '{\n  if(books.some(b=>norm(b.title).includes("sanya")&&norm(b.author).includes("oyin olugbile"))) chunks.push("CURATED EXACT-BOOK EVIDENCE\\n"+' + marker + ');');
      ai = ai.slice(0, researchFn) + patched + ai.slice(end);
    }
  }
}

// Restore styled dropdowns idempotently.
const selectClass = 'appearance-none w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
page = page.replace(/<select\b([^>]*)>/g, (full, attrs) => {
  if (attrs.includes('data-eduwills-styled')) return full;
  if (/className="[^"]*"/.test(attrs)) attrs = attrs.replace(/className="([^"]*)"/, (_m, c) => `className="${c} ${selectClass}"`);
  else if (/className=\{`[^`]*`\}/.test(attrs)) attrs = attrs.replace(/className=\{`([^`]*)`\}/, (_m, c) => `className={\`${c} ${selectClass}\`}`);
  else attrs += ` className="${selectClass}"`;
  attrs += ' data-eduwills-styled="true"';
  return '<select' + attrs + '>';
});

fs.writeFileSync(aiPath, ai, 'utf8');
fs.writeFileSync(pagePath, page, 'utf8');
console.log('Quiz generation v11 applied: marker-independent exact-book grounding, resilient cache namespace, and premium dropdown styling.');
