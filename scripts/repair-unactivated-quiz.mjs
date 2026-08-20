import fs from 'node:fs';

const page='app/dashboard/quiz/page.tsx';
const ai='lib/quizAiClient.ts';
let p=fs.readFileSync(page,'utf8');
let a=fs.readFileSync(ai,'utf8');

// All learners may request up to 100 questions. Unactivated learners are limited
// by the existing 5-generation daily quota, not by an artificial question-count cap.
const oldSelector="max={active?100:20} value={questions} onChange={e=>setQuestions(Math.min(active?100:20,Math.max(1,Number(e.target.value)||1)))}";
const newSelector="max={100} value={questions} onChange={e=>setQuestions(Math.min(100,Math.max(1,Number(e.target.value)||1)))}";
p=p.replace(oldSelector,newSelector);

// Also repair older versions that still contain the original unrestricted selector.
const originalSelector="max={100} value={questions} onChange={e=>setQuestions(Math.min(100,Math.max(1,Number(e.target.value)||1)))}";
if(!p.includes(originalSelector)){
  p=p.replace(/max=\{active\?100:20\} value=\{questions\} onChange=\{e=>setQuestions\(Math\.min\(active\?100:20,Math\.max\(1,Number\(e\.target\.value\)\|\|1\)\)\)\}/,newSelector);
}

// Enforce the 1..100 range at generation time as well.
const oldSetup="const requested=active?Math.min(100,Math.max(1,questions)):Math.min(20,Math.max(1,questions));const setupData={books:chosen.map(b=>({title:b.title,author:b.author})),questions:requested,duration:duration==='none'?null:Number(duration),difficulty,instructions};";
const newSetup="const requested=Math.min(100,Math.max(1,Number(questions)||10));const setupData={books:chosen.map(b=>({title:b.title,author:b.author})),questions:requested,duration:duration==='none'?null:Number(duration),difficulty,instructions};";
p=p.replace(oldSetup,newSetup);

// Replace the brittle batching loop with a resilient loop. The provider may return
// fewer than requested in a batch; keep requesting fresh batches until the target
// is reached, while still bounding retries so a genuinely unavailable provider does
// not hang forever. Large quizzes can therefore reach the full 100-question maximum.
const start=a.indexOf('export async function generateQuiz(');
const end=a.indexOf('export async function askEduwills',start);
if(start>=0&&end>start){
  const fn=`export async function generateQuiz(books:QuizBook[],count:number,difficulty:string,instructions:string,recent:string[]=[],research=''):Promise<QuizQuestion[]>{
  const requested=Math.min(100,Math.max(1,Number(count)||10));
  const key=await cacheKey(books,difficulty,instructions);
  const cached=await readSharedCache(key,recent);
  const accepted:QuizQuestion[]=[];
  const seen=new Set(recent.map(fingerprint));
  for(const q of cached||[]){
    const k=fingerprint(String(q.question||''));
    if(k&&!seen.has(k)&&valid(q)){accepted.push(q);seen.add(k)}
    if(accepted.length>=requested)break;
  }
  if(accepted.length>=requested)return accepted.slice(0,requested);
  if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');

  let attempts=0;
  let emptyBatches=0;
  const maxAttempts=Math.max(12,Math.ceil((requested-accepted.length)/8)*3);
  while(accepted.length<requested&&attempts<maxAttempts&&emptyBatches<6){
    attempts++;
    const remaining=requested-accepted.length;
    const batch=Math.min(10,remaining);
    const prompt=buildPrompt(books,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],research)+
      '\\nThis is generation batch '+attempts+'. Return EXACTLY '+batch+' new questions. Do not repeat any question already listed above. If the book evidence is insufficient, use the strongest supported content rather than metadata or invented facts.';
    let questions:QuizQuestion[]=[];
    try{
      questions=parse(await worker(prompt,60000,'quiz'));
    }catch{
      try{
        const r=await geminiFallback(prompt);
        questions=parse(r.response.text());
      }catch{questions=[]}
    }
    let added=0;
    for(const q of questions){
      const k=fingerprint(q.question);
      if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;
      accepted.push(q);seen.add(k);added++;
      if(accepted.length>=requested)break;
    }
    if(added===0)emptyBatches++;else emptyBatches=0;
  }
  if(accepted.length<requested)throw new Error('AI generated '+accepted.length+' of '+requested+' verified questions. Please try again.');
  await recordQuota();
  await writeSharedCache(key,accepted);
  return accepted.slice(0,requested);
}
`;
  a=a.slice(0,start)+fn+a.slice(end);
}else{
  throw new Error('generateQuiz function boundary not found; refusing to modify AI client.');
}

// Keep the existing 5-generation daily quota. Do not create a second quota system.
if(!a.includes("if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');")){
  throw new Error('Quiz quota guard is missing; refusing to deploy without the safety limit.');
}

fs.writeFileSync(page,p);
fs.writeFileSync(ai,a);
console.log('EduWills: unactivated learners can use their 5 daily quiz generations with up to 100 questions per quiz; batching now retries safely until the requested count is reached.');
