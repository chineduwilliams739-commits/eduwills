import fs from 'node:fs';

const page='app/dashboard/quiz/page.tsx';
const ai='lib/quizAiClient.ts';
let p=fs.readFileSync(page,'utf8');
let a=fs.readFileSync(ai,'utf8');

const oldGate=` if(!active)return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-6 text-white"><div className="mx-auto max-w-xl pt-16 text-center"><Sparkles className="mx-auto" size={48}/><h1 className="mt-5 text-3xl font-black">Your Quiz Studio is waiting ✨</h1><p className="mt-3 text-slate-300">Activate EDUWILLS to unlock personalized book quizzes and learning history.</p><a href={\`${BASE}/dashboard/activation/\`} className="mt-7 inline-flex rounded-2xl bg-white px-6 py-3 font-black text-slate-950">Unlock Quiz Studio</a></div></main>;\n`;
if (p.includes(oldGate)) p=p.replace(oldGate,'');
else if (p.includes('if(!active)return <main')) throw new Error('Unexpected Quiz Studio activation gate format');

const oldAdd=`const ref=await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp()});\n   const s:Setup={id:ref.id,...setupData};`;
const newAdd=`const ref=active?await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp()}):null;\n   const s:Setup={id:ref?.id||\`local-\${Date.now()}\`,...setupData};`;
if(p.includes(oldAdd)) p=p.replace(oldAdd,newAdd);
else if(!p.includes('const ref=active?await addDoc')) throw new Error('Quiz history creation block not found');

const oldSubmit=`try{await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',answers:finalAnswers,score,total:qs.length,percentage,elapsedSeconds:elapsed,completedAt:serverTimestamp(),autoSubmitted:seconds===0||leaveAttemptsRef.current>=3,leaveAttempts:leaveAttemptsRef.current});const text=await generateRemarks`;
const newSubmit=`try{if(active)await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',answers:finalAnswers,score,total:qs.length,percentage,elapsedSeconds:elapsed,completedAt:serverTimestamp(),autoSubmitted:seconds===0||leaveAttemptsRef.current>=3,leaveAttempts:leaveAttemptsRef.current});const text=await generateRemarks`;
if(p.includes(oldSubmit)) p=p.replace(oldSubmit,newSubmit);
else if(!p.includes('if(active)await updateDoc(doc(db,\'quizHistory\'')) throw new Error('Quiz completion update block not found');

const oldRemarks=`setRemarks(text);await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})`;
const newRemarks=`setRemarks(text);if(active)await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})`;
if(p.includes(oldRemarks)) p=p.replace(oldRemarks,newRemarks);

const oldQuota=`const requested=Math.min(100,Math.max(1,Number(count)||10));const key=await cacheKey(books,difficulty,instructions);const cached=await readSharedCache(key,recent);`;
const newQuota=`const requested=Math.min(100,Math.max(1,Number(count)||10));if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');const key=await cacheKey(books,difficulty,instructions);const cached=await readSharedCache(key,recent);`;
if(a.includes(oldQuota)) a=a.replace(oldQuota,newQuota);
else if(!a.includes('const requested=Math.min(100,Math.max(1,Number(count)||10));if(await quotaUsed()>=5)')) throw new Error('Quiz quota block not found');

const oldLater=`if(accepted.length>=requested)return accepted.slice(0,requested);if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');let attempts=0;`;
const newLater=`if(accepted.length>=requested)return accepted.slice(0,requested);let attempts=0;`;
if(a.includes(oldLater)) a=a.replace(oldLater,newLater);

fs.writeFileSync(page,p);fs.writeFileSync(ai,a);
console.log('Unactivated Quiz Studio access, history isolation, and five-per-day quota enforcement repaired.');
