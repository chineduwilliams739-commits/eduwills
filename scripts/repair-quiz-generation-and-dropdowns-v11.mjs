import fs from 'node:fs';

const aiPath='lib/quizAiClient.ts';
const pagePath='app/dashboard/quiz/page.tsx';
let ai=fs.readFileSync(aiPath,'utf8');
let page=fs.readFileSync(pagePath,'utf8');

const exactEvidence=[
  'EXACT-BOOK EVIDENCE — Sànyà (Sanya) by Oyin Olugbile has a female protagonist named Sànyà.',
  'EXACT-BOOK EVIDENCE — Dàda is Sànyà’s older brother; he is physically frail and clairvoyant.',
  'EXACT-BOOK EVIDENCE — Àjokè and Aganjú are Sànyà and Dàda’s parents.',
  'EXACT-BOOK EVIDENCE — Important story locations include Bániré, Arómiré and Oluji.',
  'GROUNDING RULE — Never infer gender, relationships, age, setting, occupation, personality, or events from a name, appearance, title, mythology, or generic knowledge.',
  'GROUNDING RULE — Never invent character names or substitute another Sango/Yoruba story for Oyin Olugbile’s Sànyà.'
].join('\\n');

ai=ai.replace(/const CACHE='[^']*';/,"const CACHE='v23-exact-book-resumable-v11';");

const p0=ai.indexOf('function buildPrompt');
const g0=ai.indexOf('async function generateForBook',p0);
const g1=ai.indexOf('\n\nexport async function generateQuiz',g0);
if(p0<0||g0<0||g1<0)throw new Error('Quiz generator markers not found');

const promptLines=[
  'function buildPrompt(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string){',
  '  const curated=(norm(book.title).includes("sanya")&&norm(book.author).includes("oyin olugbile"))?'+JSON.stringify(exactEvidence)+':"";',
  '  return "You are EDUWILLS Quiz AI. Generate factual multiple-choice questions ONLY about the EXACT selected book: "+book.title+" by "+book.author+".\\n\\n"+',
  '    "STRICT GROUNDING: Use only evidence supplied for this exact book. Never substitute another book, review, biography, mythology source, or similarly named work. NEVER infer gender, relationships, age, setting, occupation, personality, or events from names, appearance, titles, or general knowledge. Never invent characters. For Sànyà by Oyin Olugbile, Sànyà is female and Dàda is her older brother.\\n\\n"+',
  '    "USER INSTRUCTIONS: "+(instructions||"Create a diverse quiz from the actual book content.")+"\\nGenerate "+count+" questions. At least 80% must test concrete book content such as characters, relationships, events, decisions, settings, chronology, causes, consequences and distinctive scenes. Avoid generic filler. Use exactly four plausible options and one correct answer. Every question must be supported by the supplied evidence. Difficulty: "+difficulty+"\\n\\n"+',
  '    "PREVIOUS QUESTIONS TO AVOID:\\n"+recent.slice(-80).join(" | ")+"\\n\\nEXACT-BOOK RESEARCH EVIDENCE:\\n"+research.slice(0,60000)+"\\n\\nCURATED EXACT-BOOK EVIDENCE:\\n"+curated+"\\n\\nReturn ONLY JSON: {\\"questions\\":[{\\"question\\":\\"...\\",\\"options\\":[\\"...\\",\\"...\\",\\"...\\",\\"...\\"],\\"answer\\":0,\\"explanation\\":\\"...\\",\\"evidence\\":\\"...\\"}]}";',
  '}'
].join('\n');
ai=ai.slice(0,p0)+promptLines+ai.slice(g0);

const newG0=ai.indexOf('async function generateForBook');
const newG1=ai.indexOf('\n\nexport async function generateQuiz',newG0);
const genLines=[
  'async function generateForBook(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string):Promise<QuizQuestion[]>{',
  '  const requested=Math.max(1,Math.min(100,Number(count)||1));',
  '  const key=await bookCacheKey(book,difficulty,instructions);',
  '  const cached=await readSharedCache(key,recent);',
  '  const accepted:QuizQuestion[]=[]; const seen=new Set(recent.map(fingerprint));',
  '  for(const q of cached){const k=fingerprint(String(q.question||""));if(k&&!seen.has(k)&&valid(q)&&!isMetadata(q)){accepted.push(q);seen.add(k)}if(accepted.length>=requested)break}',
  '  if(accepted.length>=requested)return accepted.slice(0,requested);',
  '  if(await quotaUsed()>=5){if(accepted.length)return accepted.slice(0,requested);throw new Error("AI_QUOTA_EXHAUSTED")}',
  '  let attempts=0; let emptyRuns=0;',
  '  while(accepted.length<requested&&attempts<12){',
  '    attempts++; const remaining=requested-accepted.length; const batch=Math.min(8,remaining);',
  '    const promptText=buildPrompt(book,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],research)+"\\nReturn exactly "+batch+" NEW questions. If evidence is insufficient, return fewer instead of inventing facts.";',
  '    let questions:QuizQuestion[]=[];',
  '    try{questions=parse(await worker(promptText,30000,"quiz"))}catch{try{const r=await geminiFallback(promptText);questions=parse(r.response.text())}catch{questions=[]}}',
  '    let added=0;',
  '    for(const q of questions){const k=fingerprint(q.question);if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||String(q.evidence||q.explanation||"").length<8)continue;accepted.push(q);seen.add(k);added++;if(accepted.length>=requested)break}',
  '    await writeSharedCache(key,accepted);',
  '    if(added>0)emptyRuns=0; else emptyRuns++;',
  '    if(emptyRuns>=3)break;',
  '  }',
  '  if(accepted.length){await writeSharedCache(key,accepted);if(accepted.length>=requested)await recordQuota();return accepted.slice(0,requested)}',
  '  throw new Error("AI generated no verified questions for "+book.title+". Please retry generation.");',
  '}'
].join('\n');
ai=ai.slice(0,newG0)+genLines+ai.slice(newG1);

// Seed exact-book evidence for Sànyà before external research calls so CORS/API failures cannot erase grounding.
const r0=ai.indexOf('export async function researchBooks');
const r1=ai.indexOf('\n\nfunction buildPrompt',r0);
if(r0>=0&&r1>r0){
  const research=[
    'export async function researchBooks(books:QuizBook[]):Promise<string>{',
    '  const key="eduwills:"+CACHE+":research:"+books.map(b=>norm(b.title+"|"+b.author)).join(";");',
    '  try{const x=localStorage.getItem(key);if(x){const p=JSON.parse(x);if(p.e>Date.now())return p.v}}catch{}',
    '  const chunks:string[]=[];',
    '  for(const b of books){',
    '    if(norm(b.title).includes("sanya")&&norm(b.author).includes("oyin olugbile"))chunks.push('+JSON.stringify(exactEvidence)+');',
    '    const t=encodeURIComponent(b.title),a=encodeURIComponent(b.author);',
    '    const urls=["https://www.googleapis.com/books/v1/volumes?q=intitle:"+t+"+inauthor:"+a+"&maxResults=20","https://openlibrary.org/search.json?title="+t+"&author="+a+"&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher"];',
    '    const results=await Promise.allSettled(urls.map(u=>fetch(u,{cache:"no-store"}).then(r=>r.json())));',
    '    for(const r of results)if(r.status==="fulfilled"){const d:any=r.value;for(const x of d.items||[]){const v=x.volumeInfo||{};if(v.description)chunks.push("Book "+b.title+" by "+b.author+": "+v.description)}for(const x of d.docs||[]){if(x.first_sentence)chunks.push("Book evidence: "+(x.first_sentence||[]).join(" "));if(x.subject)chunks.push("Book subjects: "+(x.subject||[]).slice(0,60).join(", "));if(x.description)chunks.push("Book description: "+(typeof x.description==="string"?x.description:JSON.stringify(x.description)))}}',
    '  }',
    '  const result=chunks.join("\\n").slice(0,90000)||("Research the exact book "+books.map(b=>b.title+" by "+b.author).join("; ")+". Do not invent unsupported facts.");',
    '  try{localStorage.setItem(key,JSON.stringify({e:Date.now()+86400000,v:result}))}catch{}',
    '  return result;',
    '}',
    ''
  ].join('\n');
  ai=ai.slice(0,r0)+research+ai.slice(r1+2);
}

const styled='appearance-none w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
page=page.replace(/<select\b([^>]*)>/g,(full,attrs)=>{
  if(attrs.includes('data-eduwills-styled'))return full;
  if(/className="[^"]*"/.test(attrs))attrs=attrs.replace(/className="([^"]*)"/,(m,c)=>'className="'+c+' '+styled+'" data-eduwills-styled="true"');
  else attrs+=' className="'+styled+'" data-eduwills-styled="true"';
  return '<select'+attrs+'>';
});

fs.writeFileSync(aiPath,ai,'utf8');
fs.writeFileSync(pagePath,page,'utf8');
console.log('Quiz generation v11 applied: exact-book grounding, resumable partial cache, up-to-100 batches, and premium dropdown styling.');
