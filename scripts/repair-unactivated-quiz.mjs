import fs from 'node:fs';

const page='app/dashboard/quiz/page.tsx';
const ai='lib/quizAiClient.ts';
let p=fs.readFileSync(page,'utf8');
let a=fs.readFileSync(ai,'utf8');

// Unactivated learners get five free generations. They must never be blocked by the
// activated-only History collection during quiz creation/completion.
p=p.replace(/\n\s*if\(!active\)return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-6 text-white">[\s\S]*?<\/main>;\n/, '\n');

// Save to quizHistory only for activated users. Unactivated quizzes stay in memory.
p=p.replace(/const ref=await addDoc\(collection\(db,'quizHistory'\),\{userId:auth\.currentUser\.uid,\.\.\.setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated\.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp\(\)\}\);/, "const ref=active?await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp()}):null;");
p=p.replace("const s:Setup={id:ref.id,...setupData};", "const s:Setup={id:ref?.id||`local-${Date.now()}`,...setupData};");
p=p.replace(/try\{await updateDoc\(doc\(db,'quizHistory',setup\.id\),\{status:'completed',/, "try{if(active)await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',");
p=p.replace("setRemarks(text);await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})", "setRemarks(text);if(active)await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})");

// Enforce the five-generation daily limit inside the AI client before any provider call.
const requested="const requested=Math.min(100,Math.max(1,Number(count)||10));";
if(!a.includes("if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');")){
  a=a.replace(requested, `${requested}if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');`);
}

fs.writeFileSync(page,p);fs.writeFileSync(ai,a);
console.log('EduWILLS: unactivated Quiz Studio is free for five daily generations and is isolated from activated-only History writes.');
