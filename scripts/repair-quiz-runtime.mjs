import fs from 'node:fs';

const libPath = 'lib/quizAiClient.ts';
const pagePath = 'app/dashboard/quiz/page.tsx';
let lib = fs.readFileSync(libPath, 'utf8');
let page = fs.readFileSync(pagePath, 'utf8');

// Keep the Quiz page as authoritative TSX; only make exact, idempotent repairs.
lib = lib.replace(/const CACHE = '[^']+';/, "const CACHE = 'v17-multiprovider-functional';");
const fallback = "const selected=books.length?books:[{title:'Selected book',author:'Unknown'}];";
const guard = "if (!Array.isArray(books) || books.length === 0) throw new Error('BOOK_SELECTION_REQUIRED'); const selected=books;";
if (lib.includes(fallback)) lib = lib.replace(fallback, guard);

// Optional public-book research must never kick the learner back to the dashboard.
const oldResearch = 'const research = await researchBooks(current.books);';
const safeResearch = "let research = ''; try { research = await researchBooks(current.books); } catch { research = ''; }";
if (page.includes(oldResearch)) page = page.replace(oldResearch, safeResearch + ' // BOOK_LEARNER_RECOVERY');

// Keep generation failures on the Quiz Studio screen with a retry action.
const marker = '  if (setup && done) {';
const screen = `  if (setup && quizError && !qs.length) {\n    return <main className="grid min-h-screen place-items-center bg-paper p-6"><div className="w-full max-w-lg rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-soft"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><XCircle size={28}/></div><h1 className="mt-4 text-2xl font-black text-slate-900">Quiz generation did not finish</h1><p className="mt-2 text-sm leading-6 text-slate-500">Your selected book is still saved. Retry without losing your setup.</p><p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">{quizError}</p><div className="mt-5 flex gap-3"><button onClick={async () => { if (!setup) return; setQuizLoading(true); setQuizError(''); await generate(setup); }} className="flex-1 rounded-xl bg-eduBlue px-4 py-3 font-black text-white">Retry generation</button><button onClick={() => resetQuiz()} className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700">Back</button></div></div></main>;\n  }\n\n`;
if (page.includes(marker) && !page.includes('Quiz generation did not finish')) page = page.replace(marker, screen + marker);

fs.writeFileSync(libPath, lib);
fs.writeFileSync(pagePath, page);
console.log('Quiz runtime repaired: no-book guard, optional research recovery, and in-place generation retry.');
