import fs from 'fs';

const quizPath = 'lib/quizAiClient.ts';
let quiz = fs.readFileSync(quizPath, 'utf8');
const gs = quiz.indexOf('export async function generateQuiz(');
const ge = quiz.indexOf('\n\nexport async function askEduwills', gs);
if (gs < 0 || ge < 0) throw new Error('generateQuiz block not found');
const newGenerate = [
"export async function generateQuiz(books:QuizBook[],count:number,difficulty:string,instructions:string,recent:string[]=[],research=''):Promise<QuizQuestion[]>{",
" const requested=Math.min(100,Math.max(1,Number(count)||10));",
" if(!books.length) throw new Error('NO_BOOKS_SELECTED');",
" if(await quotaUsed()>=5) throw new Error('AI_QUOTA_EXHAUSTED');",
" const accepted:QuizQuestion[]=[];",
" const seen=new Set(recent.map(fingerprint));",
" const runBatch=async(bookSet:QuizBook[],size:number,bookResearch:string)=>{",
"   const local:QuizQuestion[]=[]; let attempts=0;",
"   while(local.length<size&&attempts<8){",
"     attempts++; const need=Math.min(12,size-local.length);",
"     const prompt=buildPrompt(bookSet,need,difficulty,instructions,[...recent,...accepted.map(q=>q.question),...local.map(q=>q.question)],bookResearch)+'\\nSTRICT BOOK SCOPE: every question in this batch must be about these exact selected books: '+bookSet.map(b=>b.title+' by '+b.author).join('; ')+'. Return exactly '+need+' new questions and do not use facts from any other book.';",
"     let questions:QuizQuestion[]=[];",
"     try{questions=parse(await worker(prompt,45000,'quiz'))}catch{try{const r=await geminiFallback(prompt);questions=parse(r.response.text())}catch{questions=[]}}",
"     for(const q of questions){const k=fingerprint(q.question);if(!k||seen.has(k)||local.some(x=>similar(x.question,q.question))||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;local.push(q);seen.add(k);if(local.length>=size)break}",
"     if(!questions.length&&attempts>=3)break;",
"   }",
"   return local;",
" };",
" if(books.length===1){",
"   const key=await cacheKey(books,difficulty,instructions);",
"   const cached=await readSharedCache(key,recent);",
"   for(const q of cached||[]){const k=fingerprint(String(q.question||''));if(k&&!seen.has(k)&&valid(q)){accepted.push(q);seen.add(k)}}",
"   if(accepted.length<requested)accepted.push(...await runBatch(books,requested-accepted.length,research));",
"   if(accepted.length<requested)throw new Error('AI generated '+accepted.length+' of '+requested+' verified questions. Please try again.');",
"   await recordQuota(); await writeSharedCache(key,accepted); return accepted.slice(0,requested);",
" }",
" const allocations=books.map(function(_,i){return Math.floor(requested/books.length)+(i<requested%books.length?1:0)});",
" for(let i=0;i<books.length;i++){",
"   const book=books[i]; const target=allocations[i]; if(!target)continue;",
"   const key=await cacheKey([book],difficulty,instructions); const cached=await readSharedCache(key,recent); const before=accepted.length;",
"   for(const q of cached||[]){const k=fingerprint(String(q.question||''));if(k&&!seen.has(k)&&valid(q)){accepted.push(q);seen.add(k);if(accepted.length-before>=target)break}}",
"   if(accepted.length-before<target){const fresh=await runBatch([book],target-(accepted.length-before),research);accepted.push(...fresh)}",
"   if(accepted.length-before<target)throw new Error('AI could not generate enough verified questions for '+book.title+'. Please try again.');",
"   await writeSharedCache(key,accepted.slice(Math.max(0,accepted.length-target)));",
" }",
" await recordQuota(); return accepted.slice(0,requested);",
"}"
].join('\n');
quiz = quiz.slice(0, gs) + newGenerate + quiz.slice(ge);
fs.writeFileSync(quizPath, quiz);

const activationPath = 'app/dashboard/activation/page.tsx';
let activation = fs.readFileSync(activationPath, 'utf8');
const activationReplacements = [
  ['bg-paper px-4 py-5 pb-10 sm:px-8', 'bg-slate-950 px-4 py-6 pb-10 text-white sm:px-8'],
  ['text-slate-600', 'text-slate-300'],
  ['border-slate-200 bg-white shadow-soft', 'border-white/10 bg-slate-900/70 shadow-2xl'],
  ['bg-ink p-7 text-white sm:p-9', 'bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 p-7 text-white sm:p-9'],
  ['bg-blue-50', 'bg-white/[.04]'],
  ['text-eduBlue', 'text-cyan-300'],
  ['bg-ink p-6 text-white', 'bg-slate-950 p-6 text-white'],
  ['border-slate-200 p-6', 'border-white/10 bg-white/[.03] p-6'],
  ['bg-amber-50 p-5', 'bg-white/[.03] p-5'],
  ['text-amber-900', 'text-slate-300'],
  ['bg-emerald-50 p-7', 'border border-white/10 bg-white/[.03] p-7'],
  ['text-emerald-800', 'text-cyan-300'],
  ['bg-white px-4 py-3 text-sm font-black text-emerald-800', 'bg-white/5 px-4 py-3 text-sm font-black text-cyan-300']
];
for (const [a,b] of activationReplacements) activation = activation.split(a).join(b);
fs.writeFileSync(activationPath, activation);

const dashboardPath = 'app/dashboard/page.tsx';
let dashboard = fs.readFileSync(dashboardPath, 'utf8');
const insertAt = dashboard.lastIndexOf('  <nav className="fixed bottom-0');
if (insertAt < 0) throw new Error('dashboard navigation insertion point not found');
const feed = `  <section className="mx-auto mt-10 max-w-7xl px-5 sm:px-8"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-600">EDUWILLS feed</p><h2 className="mt-1 text-2xl font-black">Learning, books & updates</h2></div><span className="text-xs font-bold text-slate-400">A fuller home for future stories and news</span></div><div className="mt-4 grid gap-4 md:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-cyan-600">Book spotlight</p><h3 className="mt-3 text-lg font-black">Discover your next read</h3><p className="mt-2 text-sm leading-6 text-slate-500">Explore books in your library and turn what you read into focused quiz practice.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Study news</p><h3 className="mt-3 text-lg font-black">Smarter revision starts with retrieval</h3><p className="mt-2 text-sm leading-6 text-slate-500">Use short quizzes and targeted review instead of relying on rereading alone.</p></article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">EDUWILLS updates</p><h3 className="mt-3 text-lg font-black">More stories are coming</h3><p className="mt-2 text-sm leading-6 text-slate-500">This space is ready for curated blogs, education news and updates from trusted sources.</p></article></div></section>\n`;
dashboard = dashboard.slice(0, insertAt) + feed + dashboard.slice(insertAt);
const dashboardReplacements = [
  ['bg-paper pb-24 text-ink', 'bg-slate-50 pb-24 text-slate-950'],
  ['bg-white/95 backdrop-blur', 'bg-white/90 backdrop-blur-xl'],
  ['bg-ink p-7 text-white sm:p-10', 'bg-slate-950 p-7 text-white shadow-xl sm:p-10'],
  ['bg-white hover:-translate-y-0.5', 'bg-white hover:-translate-y-1 hover:shadow-lg'],
  ['rounded-2xl border border-slate-200 bg-white/70 opacity-60', 'rounded-2xl border border-slate-200 bg-white/70 opacity-70']
];
for (const [a,b] of dashboardReplacements) dashboard = dashboard.split(a).join(b);
fs.writeFileSync(dashboardPath, dashboard);

console.log('EDUWILLS multi-book quiz grounding and dashboard/activation styling repair applied.');
