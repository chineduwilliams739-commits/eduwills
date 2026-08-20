import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const quizPath = 'app/dashboard/quiz/page.tsx';
let quiz = read(quizPath);
const activationGate = "setActive(d.activated===true&&expiry(d.activationExpiresAt)>Date.now());";
if (quiz.includes(activationGate)) {
  quiz = quiz.replace(activationGate, 'setActive(true);');
}
const oldCatch = "catch(e:any){console.error(e);setGenerationError(e?.message||'Quiz generation failed.');setGenerationStatus('');setQs([]);setSetup(null)}";
const newCatch = "catch(e:any){console.error(e);const code=String(e?.message||'');setGenerationError(code==='AI_QUOTA_EXHAUSTED'?'You have used your 5 free quiz opportunities for today. Activate your EDUWILLS account to continue generating quizzes.':e?.message||'Quiz generation failed.');setGenerationStatus('');setQs([]);setSetup(null)}";
if (quiz.includes(oldCatch)) quiz = quiz.replace(oldCatch, newCatch);
write(quizPath, quiz);

const homePath = 'app/page.tsx';
let home = read(homePath);
const seoHeading = 'Prepare for WAEC, JAMB & NECO with EDUWILLS.';
if (!home.includes(seoHeading)) {
  const seo = `<section id="seo-learning" className="border-y border-slate-200/70 bg-white py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">Nigerian exam preparation</p><h2 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">${seoHeading}</h2><p className="mt-4 leading-7 text-slate-600">Use EDUWILLS for WAEC practice questions, JAMB and UTME preparation, NECO exam preparation and AI-powered book quizzes. Build practice around the books you study, test your understanding and learn from your results.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><a href={\`${BASE}/study-guides/waec-practice-questions/\`} className="rounded-3xl border border-slate-200 bg-paper p-6"><h3 className="font-black text-ink">WAEC Practice Questions</h3><p className="mt-2 text-sm leading-6 text-slate-600">Study-focused practice and revision guidance for Nigerian secondary students.</p></a><a href={\`${BASE}/study-guides/jamb-utme-practice/\`} className="rounded-3xl border border-slate-200 bg-paper p-6"><h3 className="font-black text-ink">JAMB / UTME Practice</h3><p className="mt-2 text-sm leading-6 text-slate-600">Prepare with structured practice and smart revision habits.</p></a><a href={\`${BASE}/study-guides/neco-exam-preparation/\`} className="rounded-3xl border border-slate-200 bg-paper p-6"><h3 className="font-black text-ink">NECO Exam Preparation</h3><p className="mt-2 text-sm leading-6 text-slate-600">Turn your study material into useful practice sessions.</p></a><a href={\`${BASE}/study-guides/book-quiz-generator/\`} className="rounded-3xl border border-slate-200 bg-paper p-6"><h3 className="font-black text-ink">AI Book Quiz Generator</h3><p className="mt-2 text-sm leading-6 text-slate-600">Search for a book and generate questions based on your study instructions.</p></a></div><p className="mt-7 text-xs text-slate-400">EDUWILLS is an independent learning platform and is not affiliated with or endorsed by WAEC, JAMB or NECO.</p></div></section>`;
  const marker = '<section id="pricing"';
  if (!home.includes(marker)) throw new Error('Homepage pricing section not found');
  home = home.replace(marker, seo + marker);
}
if (!home.includes('href={`${BASE}/study-guides/`}')) {
  home = home.replace('<a href="#pricing" className="text-sm font-semibold text-slate-600">Pricing</a>', '<a href="#pricing" className="text-sm font-semibold text-slate-600">Pricing</a><a href={`${BASE}/study-guides/`} className="text-sm font-semibold text-slate-600">Study Guides</a>');
  home = home.replace("[['How it works','#how'],['Pricing','#pricing'],['Support Chinedu','#support']]", "[['How it works','#how'],['Pricing','#pricing'],['Study Guides',`${BASE}/study-guides/`],['Support Chinedu','#support']]");
}
write(homePath, home);
console.log('Homepage SEO and 5-free-quiz access repair applied.');
