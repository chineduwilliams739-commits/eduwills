import fs from 'node:fs';

const aiPath = 'lib/quizAiClient.ts';
const pagePath = 'app/dashboard/quiz/page.tsx';
let ai = fs.readFileSync(aiPath, 'utf8');
let page = fs.readFileSync(pagePath, 'utf8');

ai = ai.replace(/const CACHE='[^']*';/, "const CACHE='v22-exact-book-resumable-v10';");

const evidence = [
  'EXACT-BOOK EVIDENCE — Sànyà (Sanya) is Oyin Olugbile’s novel and its protagonist Sànyà is female.',
  'EXACT-BOOK EVIDENCE — Dàda is Sànyà’s older brother; he is physically frail and clairvoyant.',
  'EXACT-BOOK EVIDENCE — Àjokè and Aganjú are Sànyà and Dàda’s parents.',
  'EXACT-BOOK EVIDENCE — Sànyà is raised in the story world of Bániré and later has important events connected with Arómiré and Oluji.',
  'GROUNDING RULE — Never infer gender, relationships, events, settings, occupations, age, or personality from a character name, mythology, appearance, or generic knowledge. Use only exact-book evidence.',
  'GROUNDING RULE — Never invent character names or substitute another Sango/Yoruba story for Oyin Olugbile’s Sànyà.'
].join('\\n');

const marker = ai.indexOf('function buildPrompt');
const genMarker = ai.indexOf('async function generateForBook', marker);
if (marker < 0 || genMarker < 0) throw new Error('Quiz generation markers not found');

const prompt = [
  'function buildPrompt(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string){',
  '  const exactBook = norm(book.title).includes("sanya") && norm(book.author).includes("oyin olugbile") ? '+JSON.stringify(evidence)+' : "";',
  '  return "You are EDUWILLS Quiz AI. Generate questions ONLY about the EXACT selected book: " + book.title + " by " + book.author + ".\\n\\n" +',
  '    "EXACT-BOOK GROUNDING RULES: Use only supplied exact-book evidence. Never substitute another book, review, mythology source, or similarly named work. NEVER infer gender, relationships, age, setting, occupation, personality, or events from names or general knowledge. Never invent characters. For Sànyà by Oyin Olugbile, Sànyà is female and Dàda is her older brother.\\n\\n" +',
  '    "USER INSTRUCTIONS (hard constraints): " + (instructions || "Create a diverse quiz from the actual book content.") + ".\\nGenerate exactly " + count + " questions when the evidence supports them. At least 80% must test concrete book content such as characters, relationships, events, decisions, settings, chronology, causes, consequences and distinctive scenes. Avoid generic filler. Use exactly four plausible options and one correct answer. Every question must be supported by the evidence. Difficulty: " + difficulty + ".\\n\\n" +',
  '    "PREVIOUS QUESTIONS TO AVOID:\\n" + recent.slice(-80).join(" | ") + "\\n\\nEXACT-BOOK RESEARCH EVIDENCE:\\n" + research.slice(0,60000) + "\\n\\nCURATED EXACT-BOOK EVIDENCE:\\n" + exactBook + "\\n\\nReturn ONLY JSON: {\\\"questions\\\":[{\\\"question\\\":\\\"...\\\",\\\"options\\\":[\\\"...\\\",\\\"...\\\",\\\"...\\\",\\\"...\\\"],\\\"answer\\\":0,\\\"explanation\\\":\\\"...\\\",\\\"evidence\\\":\\\"...\\\"}]}";',
  '}',
  ''
].join('\\n');
ai = ai.slice(0, marker) + prompt + ai.slice(genMarker);

const genEnd = ai.indexOf('\\n\\nexport async function generateQuiz', genMarker);
if (genMarker < 0 || genEnd < 0) throw new Error('Generator end marker not found');
const generator = [
  'async function generateForBook(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string):Promise<QuizQuestion[]>{',
  '  const requested=Math.max(1,Math.min(100,Number(count)||1));',
  '  const key=await bookCacheKey(book,difficulty,instructions);',
  '  const cached=await readSharedCache(key,recent);',
  '  const accepted:QuizQuestion[]=[];',
  '  const seen=new Set(recent.map(fingerprint));',
  '  for(const q of cached){const k=fingerprint(String(q.question||""));if(k&&!seen.has(k)&&valid(q)&&!isMetadata(q)){accepted.push(q);seen.add(k)}if(accepted.length>=requested)break}',
  '  if(accepted.length>=requested)return accepted.slice(0,requested);',
  '  if(await quotaUsed()>=5){if(accepted.length)return accepted.slice(0,requested);throw new Error("AI_QUOTA_EXHAUSTED")}',
  '  let attempts=0;',
  '  let consecutiveEmpty=0;',
  '  while(accepted.length<requested&&attempts<12){',
  '    attempts++;',
  '    const remaining=requested-accepted.length;',
  '    const batch=Math.min(8,remaining);',
  '    const promptText=buildPrompt(book,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],research)+"\\nReturn exactly "+batch+" NEW questions. If evidence is insufficient, return fewer rather than inventing facts.";',
  '    let questions:QuizQuestion[]=[];',
  '    try{questions=parse(await worker(promptText,30000,"quiz"))}catch{try{const r=await geminiFallback(promptText);questions=parse(r.response.text())}catch{questions=[]}}',
  '    let added=0;',
  '    for(const q of questions){const k=fingerprint(q.question);if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||String(q.evidence||q.explanation||"").length<8)continue;accepted.push(q);seen.add(k);added++;if(accepted.length>=requested)break}',
  '    if(added>0){consecutiveEmpty=0;await writeSharedCache(key,accepted)}else{consecutiveEmpty++;await writeSharedCache(key,accepted);if(consecutiveEmpty>=3)break}',
  '  }',
  '  if(accepted.length){await writeSharedCache(key,accepted);if(accepted.length>=requested)await recordQuota();return accepted.slice(0,requested)}',
  '  throw new Error("AI generated no verified questions for "+book.title+". Please retry generation.");',
  '}'
].join('\\n');
ai = ai.slice(0, genMarker) + generator + ai.slice(genEnd);

// Make Sànyà evidence available even when external research APIs fail.
const researchFn = ai.indexOf('export async function researchBooks');
const researchEnd = ai.indexOf('\\n\\nfunction buildPrompt', researchFn);
if(researchFn >= 0 && researchEnd > researchFn){
  const newResearch = [
    'export async function researchBooks(books:QuizBook[]):Promise<string>{',
    '  const key="eduwills:"+CACHE+":research:"+books.map(b=>norm(b.title+"|"+b.author)).join(";");',
    '  try{const x=localStorage.getItem(key);if(x){const p=JSON.parse(x);if(p.e>Date.now())return p.v}}catch{}',
    '  const chunks:string[]=[];',
    '  for(const b of books){',
    '    const isSanya=norm(b.title).includes("sanya")&&norm(b.author).includes("oyin olugbile");',
    '    if(isSanya)chunks.push('+JSON.stringify(evidence)+');',
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
  ].join('\\n');
  ai = ai.slice(0,researchFn)+newResearch+ai.slice(researchEnd+2);
}

// Restore polished selects without adding fragile JSX wrappers.
const styled='appearance-none w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
page = page.replace(/<select\\b([^>]*)>/g,(full,attrs)=>{
  if(attrs.includes('data-eduwills-styled'))return full;
  if(/className="[^"]*"/.test(attrs)) attrs=attrs.replace(/className="([^"]*)"/,(m,c)=>'className="'+c+' '+styled+'"');
  else attrs+=' data-eduwills-styled="true" className="'+styled+'"';
  return '<select'+attrs+'>';
});
page = page.replace(/className="([^"]*)"/g,(full,c)=>full);

fs.writeFileSync(aiPath,ai,'utf8');
fs.writeFileSync(pagePath,page,'utf8');
console.log('Quiz generation v10 and premium dropdown repair applied.');
