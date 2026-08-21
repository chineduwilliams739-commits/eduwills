import fs from 'node:fs';

const quizPath = 'lib/quizAiClient.ts';
let q = fs.readFileSync(quizPath, 'utf8');

// Repair any accidental Markdown-link serialization inside TypeScript URL literals.
q = q.replace(/`\[https:\/\/([^\]]+)\]\(https:\/\/[^)]+\)`/g, '`https://$1`');
q = q.replace(/\[https:\/\/([^\]]+)\]\(https:\/\/[^)]+\)/g, 'https://$1');

const start = q.indexOf('export async function generateQuiz(');
const end = q.indexOf('\n\nexport async function askEduwills', start);
if (start < 0 || end < 0) throw new Error('generateQuiz block not found');

const replacement = `export async function generateQuiz(books:QuizBook[],count:number,difficulty:string,instructions:string,recent:string[]=[],research=''):Promise<QuizQuestion[]>{
 const requested=Math.min(100,Math.max(1,Number(count)||10));
 if(!books.length)throw new Error('NO_BOOKS_SELECTED');
 const seen=new Set(recent.map(fingerprint));
 const accepted:QuizQuestion[]=[];
 const allocations=books.map((_,i)=>Math.floor(requested/books.length)+(i<requested%books.length?1:0));
 const misses: {book:QuizBook,target:number;cached:QuizQuestion[];key:string}[]=[];
 // CACHE-FIRST: every selected book gets its own cache lookup before any AI call.
 for(let i=0;i<books.length;i++){
   const target=allocations[i];
   if(!target)continue;
   const book=books[i];
   const key=await cacheKey([book],difficulty,instructions);
   const cached=await readSharedCache(key,recent);
   const usable:QuizQuestion[]=[];
   for(const item of cached||[]){
     const k=fingerprint(String(item.question||''));
     if(k&&!seen.has(k)&&valid(item)){usable.push(item);seen.add(k);accepted.push(item);if(usable.length>=target)break}
   }
   if(usable.length<target)misses.push({book,target:target-usable.length,cached:usable,key});
 }
 if(!misses.length)return accepted.slice(0,requested);
 if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');
 const fresh=await Promise.all(misses.map(async miss=>{
   const bookResearch=await researchBooks([miss.book]);
   const local:QuizQuestion[]=[];
   let attempts=0;
   while(local.length<miss.target&&attempts<4){
     attempts++;
     const need=miss.target-local.length;
     const prompt=buildPrompt([miss.book],need,difficulty,instructions,[...recent,...accepted.map(x=>x.question),...local.map(x=>x.question)],bookResearch)+'\\nSTRICT BOOK SCOPE: every question must be about ONLY '+miss.book.title+' by '+miss.book.author+'. Do not use facts from another selected book. Return exactly '+need+' new questions.';
     let got:QuizQuestion[]=[];
     try{got=parse(await worker(prompt,Math.min(30000,14000+need*1800),'quiz'))}
     catch{try{const r=await geminiFallback(prompt);got=parse(r.response.text())}catch{got=[]}}
     for(const item of got){
       const k=fingerprint(item.question);
       if(!k||seen.has(k)||local.some(x=>similar(x.question,item.question))||isMetadata(item))continue;
       if(!groundedForBooks([miss.book],item,bookResearch))continue;
       local.push(item);seen.add(k);if(local.length>=miss.target)break;
     }
     if(!got.length)break;
   }
   return {miss,local};
 }));
 for(const result of fresh){
   const {miss,local}=result;
   if(local.length<miss.target)throw new Error('AI could not generate enough verified questions for '+miss.book.title+'. Please try again.');
   accepted.push(...local);
   // Cache only the verified questions for this exact book.
   await writeSharedCache(miss.key,local);
 }
 await recordQuota();
 return accepted.slice(0,requested);
}`;
q=q.slice(0,start)+replacement+q.slice(end);
fs.writeFileSync(quizPath,q);

const activationPath='app/dashboard/activation/page.tsx';
let a=fs.readFileSync(activationPath,'utf8');
// Make the activation surface deterministic: no inherited text colors and no translucent card backgrounds.
a=a.replace(/<main className="[^"]*"/, '<main className="eduwills-activation min-h-screen bg-slate-50 px-4 py-6 pb-14 text-slate-950 sm:px-8"');
a=a.replace(/border-white\/10 bg-slate-900\/70/g,'border-slate-200 bg-white');
a=a.replace(/bg-white\/\[\.04\]/g,'bg-slate-50');
a=a.replace(/bg-white\/\[\.03\]/g,'bg-slate-50');
a=a.replace(/border-white\/10 bg-slate-950/g,'border-slate-200 bg-slate-950');
// Ensure the key dark banner remains readable while all light cards remain visible.
a=a.replace('bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950','bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800');
fs.writeFileSync(activationPath,a);

const cssPath='app/globals.css';
let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('.eduwills-activation')){
 css += `\n/* EDUWILLS activation visibility guard: prevents inherited theme styles from hiding copy/cards. */\n.eduwills-activation{color:#0f172a;background:#f8fafc;}\n.eduwills-activation h1,.eduwills-activation h2,.eduwills-activation h3{color:#0f172a;}\n.eduwills-activation p,.eduwills-activation li{color:#475569;}\n.eduwills-activation .text-white{color:#fff!important;}\n.eduwills-activation .bg-slate-950 p,.eduwills-activation .bg-slate-950 h1,.eduwills-activation .bg-slate-950 h2,.eduwills-activation .bg-slate-950 h3{color:#fff;}\n.eduwills-activation input{color:#0f172a;background:#fff;}\n`;
}
fs.writeFileSync(cssPath,css);
console.log('EDUWILLS cache-first quiz generation and activation visibility v2 applied.');
