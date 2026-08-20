import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const replace=(p,re,rep,label)=>{const s=read(p);if(!re.test(s))throw new Error(`${label}: pattern not found in ${p}`);write(p,s.replace(re,rep));};

const aiPath='lib/quizAiClient.ts';
const ai=read(aiPath);
const start=ai.indexOf('export async function generateQuiz(');
const end=ai.indexOf('export async function askEduwills(',start);
if(start<0||end<0)throw new Error('Could not locate quiz AI functions');
const newGenerate=`export async function generateQuiz(books:QuizBook[],count:number,difficulty:string,instructions:string,recent:string[]=[],research=''):Promise<QuizQuestion[]>{
 const requested=Math.min(100,Math.max(1,Number(count)||10));
 const key=await cacheKey(books,difficulty,instructions);
 const cached=await readSharedCache(key,recent);
 const accepted:QuizQuestion[]=[];
 const seen=new Set(recent.map(fingerprint));
 for(const q of cached||[]){const k=fingerprint(String(q.question||''));if(k&&!seen.has(k)&&valid(q)){accepted.push(q);seen.add(k)}}
 if(accepted.length>=requested)return accepted.slice(0,requested);
 if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');
 let attempts=0;
 while(accepted.length<requested&&attempts<12){
  attempts++;
  const remaining=requested-accepted.length;
  const batch=Math.min(12,remaining);
  const prompt=buildPrompt(books,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],research)+'\\nThis is batch '+attempts+'. Return exactly '+batch+' new questions. Do not repeat any question already listed above.';
  let questions:QuizQuestion[]=[];
  try{questions=parse(await worker(prompt,45000,'quiz'))}catch{try{const r=await geminiFallback(prompt);questions=parse(r.response.text())}catch{questions=[]}}
  let added=0;
  for(const q of questions){const k=fingerprint(q.question);if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;accepted.push(q);seen.add(k);added++;if(accepted.length>=requested)break}
  if(accepted.length>=requested)break;
  if(added===0&&attempts>=3)break;
 }
 if(accepted.length<requested)throw new Error('AI generated '+accepted.length+' of '+requested+' verified questions. Please try again.');
 await recordQuota();
 await writeSharedCache(key,accepted);
 return accepted.slice(0,requested);
}

`;
write(aiPath,ai.slice(0,start)+newGenerate+ai.slice(end));

replace(aiPath,/export async function askEduwills\(prompt:string,history:string\[\]=\[\]\)\{[\s\S]*?\}\nexport async function explainFailure/s,
`export async function askEduwills(prompt:string,history:string[]=[]){const conversation=[...history.slice(-8),\`Learner: \${prompt}\`].join('\\n');const instruction=\`You are EDUWILLS AI, a study assistant for learners. Answer the learner directly and accurately. You may explain books, characters, themes, vocabulary, difficult passages, subjects and study strategies. If the learner asks about a specific book, do not invent plot details; clearly say when you are unsure. Keep answers concise but useful. IMPORTANT OUTPUT RULES: plain readable text only; no code, JSON, XML, Markdown code fences, API syntax, variable names, function calls, or internal system/provider terminology. Never mention prompts, tokens, gateways, providers or implementation details.\\nConversation:\\n\${conversation}\`;try{return plain(await worker(instruction,30000,'chat'))}catch{try{const r=await geminiFallback(instruction);return plain(r.response.text())}catch{return 'EDUWILLS AI is temporarily busy. Please try again in a moment.'}}}
export async function explainFailure`, 'replace askEduwills');

const quizPath='app/dashboard/quiz/page.tsx';
replace(quizPath,/setActive\(d\.activated===true&&expiry\(d\.activationExpiresAt\)>Date\.now\(\)\);/,'setActive(true);','allow free quiz access');
replace(quizPath,/catch\(e:any\)\{console\.error\(e\);setGenerationError\(e\?\.message\|\|\'Quiz generation failed\.\'\);setGenerationStatus\(\'\'\);setQs\(\[\]\);setSetup\(null\)\}/,`catch(e:any){console.error(e);const code=String(e?.message||'');setGenerationError(code==='AI_QUOTA_EXHAUSTED'?'You have used your 5 free quiz opportunities for today. Activate your EDUWILLS account to continue generating quizzes.':e?.message||'Quiz generation failed.');setGenerationStatus('');setQs([]);setSetup(null)}`,'free quiz quota message');

const homePath='app/page.tsx';
let home=read(homePath);
if(!home.includes('Prepare for WAEC, JAMB & NECO with EDUWILLS')){
 const seo=`<section id="seo-learning" className="border-y border-slate-200/70 bg-white py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">Nigerian exam preparation</p><h2 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">Prepare for WAEC, JAMB & NECO with EDUWILLS.</h2><p className="mt-4 leading-7 text-slate-600">Use EDUWILLS for WAEC practice questions, JAMB and UTME preparation, NECO exam preparation and AI-powered book quizzes. Build practice around the books you study, test your understanding and learn from your results.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><a href={\`${BASE}/study-guides/waec-practice-questions/\`} className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="font-black text-ink">WAEC Practice Questions</h3><p className="mt-2 text-sm leading-6 text-slate-600">Study-focused practice and revision guidance for Nigerian secondary students.</p></a><a href={\`${BASE}/study-guides/jamb-utme-practice/\`} className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="font-black text-ink">JAMB / UTME Practice</h3><p className="mt-2 text-sm leading-6 text-slate-600">Prepare with structured practice and smart revision habits.</p></a><a href={\`${BASE}/study-guides/neco-exam-preparation/\`} className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="font-black text-ink">NECO Exam Preparation</h3><p className="mt-2 text-sm leading-6 text-slate-600">Turn your study material into useful practice sessions.</p></a><a href={\`${BASE}/study-guides/book-quiz-generator/\`} className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="font-black text-ink">AI Book Quiz Generator</h3><p className="mt-2 text-sm leading-6 text-slate-600">Search for a book and generate questions based on your study instructions.</p></a></div><p className="mt-7 text-xs text-slate-400">EDUWILLS is an independent learning platform and is not affiliated with or endorsed by WAEC, JAMB or NECO.</p></div></section>`;
 home=home.replace('<section id="pricing"',seo+'<section id="pricing"');
}
if(!home.includes('href={`${BASE}/study-guides/`}')){
 home=home.replace('<a href="#pricing" className="text-sm font-semibold text-slate-600">Pricing</a>','<a href="#pricing" className="text-sm font-semibold text-slate-600">Pricing</a><a href={`${BASE}/study-guides/`} className="text-sm font-semibold text-slate-600">Study Guides</a>');
 home=home.replace("[['How it works','#how'],['Pricing','#pricing'],['Support Chinedu','#support']]","[['How it works','#how'],['Pricing','#pricing'],['Study Guides',`${BASE}/study-guides/`],['Support Chinedu','#support']]");
}
write(homePath,home);

const histPath='app/dashboard/history/page.tsx';
replace(histPath,/setActive\(d\.activated===true&&ms\(d\.activationExpiresAt\)>Date\.now\(\)\);/,'setActive(d.activated===true&&(!d.activationExpiresAt||ms(d.activationExpiresAt)>Date.now()));','history activation check');

console.log('Applied EDUWILLS AI, 100-question batching, 5-free-quiz access, visible SEO and history access fixes.');
