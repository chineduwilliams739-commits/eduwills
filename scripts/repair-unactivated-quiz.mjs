import fs from 'node:fs';

const page='app/dashboard/quiz/page.tsx';
const ai='lib/quizAiClient.ts';
let p=fs.readFileSync(page,'utf8');
let a=fs.readFileSync(ai,'utf8');

// Keep the original Quiz Studio interface and runner intact. Unactivated users are
// allowed into the studio; the page already persists History only when active.
// Only cap the question selector for unactivated learners.
const originalMax="max={100} value={questions} onChange={e=>setQuestions(Math.min(100,Math.max(1,Number(e.target.value)||1)))}";
const cappedMax="max={active?100:20} value={questions} onChange={e=>setQuestions(Math.min(active?100:20,Math.max(1,Number(e.target.value)||1)))}";
if(p.includes(originalMax)) p=p.replace(originalMax,cappedMax);

// Enforce the same cap immediately before generation, so changing the input
// through browser tools cannot bypass the 20-question limit.
const startMarker="const setupData={books:chosen.map(b=>({title:b.title,author:b.author})),questions,duration:duration==='none'?null:Number(duration),difficulty,instructions};";
if(p.includes(startMarker)&&!p.includes("const requested=active?Math.min(100,Math.max(1,questions)):Math.min(20,Math.max(1,questions));")){
  p=p.replace(startMarker,"const requested=active?Math.min(100,Math.max(1,questions)):Math.min(20,Math.max(1,questions));const setupData={books:chosen.map(b=>({title:b.title,author:b.author})),questions:requested,duration:duration==='none'?null:Number(duration),difficulty,instructions};");
}

// Preserve the existing five-generation daily quota in quizAiClient.
if(!a.includes("if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');")){
  const marker="const requested=Math.min(100,Math.max(1,Number(count)||10));";
  if(a.includes(marker)) a=a.replace(marker,marker+"if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');");
}

fs.writeFileSync(page,p);
fs.writeFileSync(ai,a);
console.log('EduWILLS: original Quiz Studio preserved; unactivated question limit capped at 20.');
