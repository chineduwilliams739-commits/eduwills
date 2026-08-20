import fs from 'node:fs';

const page='app/dashboard/quiz/page.tsx';
const ai='lib/quizAiClient.ts';
let p=fs.readFileSync(page,'utf8');
let a=fs.readFileSync(ai,'utf8');

// Unactivated learners may enter Quiz Studio and receive five free generations.
p=p.replace(/setActive\(d\.activated===true&&expiry\(d\.activationExpiresAt\)>Date\.now\(\)\);/,'setActive(true);');
p=p.replace(/\n\s*if\(!active\)return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-6 text-white">[\s\S]*?<\/main>;\n/,'\n');

// Never write an unactivated learner's quiz into the activated-only History workflow.
const historyCreate=/const ref=await addDoc\(collection\(db,'quizHistory'\),\{userId:auth\.currentUser\.uid,\.\.\.setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated\.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp\(\)\}\);/;
if(historyCreate.test(p)){
 p=p.replace(historyCreate,"const ref=active?await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp()}):null;");
}
p=p.replace(/const s:Setup=\{id:ref\.id,\.\.\.setupData\};/,'const s:Setup={id:ref?.id||`local-${Date.now()}`,...setupData};');

// Completion/history writes are activated-user only.
p=p.replace(/try\{await updateDoc\(doc\(db,'quizHistory',setup\.id\),\{status:'completed',/,'try{if(active)await updateDoc(doc(db,\'quizHistory\',setup.id),{status:\'completed\',');
p=p.replace("setRemarks(text);await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})","setRemarks(text);if(active)await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})");

// Keep the five-generation limit before any provider call.
const requested="const requested=Math.min(100,Math.max(1,Number(count)||10));";
if(!a.includes("if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');")){
 a=a.replace(requested,`${requested}if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');`);
}

fs.writeFileSync(page,p);fs.writeFileSync(ai,a);
console.log('EduWILLS: unactivated Quiz Studio enabled with five daily generations and no History writes.');
