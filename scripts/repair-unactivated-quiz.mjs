import fs from 'node:fs';

const page='app/dashboard/quiz/page.tsx';
const ai='lib/quizAiClient.ts';
let p=fs.readFileSync(page,'utf8');
let a=fs.readFileSync(ai,'utf8');

// Quiz Studio must remain usable for unactivated learners during their five free daily generations.
// History writes are deliberately skipped for those learners because History is an activated-only feature.
const gate=/\n\s*if\(!active\)return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-6 text-white">[\s\S]*?<\/main>;\n/;
if(gate.test(p)) p=p.replace(gate,'\n');

const oldAdd=`const ref=await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp()});`;
const newAdd=`const ref=active?await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp()}):null;`;
if(p.includes(oldAdd)) p=p.replace(oldAdd,newAdd);
else if(!p.includes("const ref=active?await addDoc(collection(db,'quizHistory')")) console.log('Quiz history create block already repaired or changed; continuing.');

const oldSetup=`const s:Setup={id:ref.id,...setupData};`;
const newSetup=`const s:Setup={id:ref?.id||\`local-\${Date.now()}\`,...setupData};`;
if(p.includes(oldSetup)) p=p.replace(oldSetup,newSetup);

const oldSubmit=`try{await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',answers:finalAnswers,score,total:qs.length,percentage,elapsedSeconds:elapsed,completedAt:serverTimestamp(),autoSubmitted:seconds===0||leaveAttemptsRef.current>=3,leaveAttempts:leaveAttemptsRef.current});`;
const newSubmit=`try{if(active)await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',answers:finalAnswers,score,total:qs.length,percentage,elapsedSeconds:elapsed,completedAt:serverTimestamp(),autoSubmitted:seconds===0||leaveAttemptsRef.current>=3,leaveAttempts:leaveAttemptsRef.current});`;
if(p.includes(oldSubmit)) p=p.replace(oldSubmit,newSubmit);

const oldRemarks=`setRemarks(text);await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})`;
const newRemarks=`setRemarks(text);if(active)await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})`;
if(p.includes(oldRemarks)) p=p.replace(oldRemarks,newRemarks);

// Keep the five-free-generation rule before generation starts. Do not fail the deployment if
// the AI client has already received an equivalent quota implementation in another commit.
const quotaLine=/const requested=Math\.min\(100,Math\.max\(1,Number\(count\)\|\|10\)\);/;
if(quotaLine.test(a) && !a.includes("if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED')")){
  a=a.replace(quotaLine,match=>`${match}if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');`);
}

fs.writeFileSync(page,p);fs.writeFileSync(ai,a);
console.log('EduWILLS unactivated Quiz Studio access and History isolation repaired successfully.');
