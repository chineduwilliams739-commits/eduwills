import fs from 'node:fs';

const BASE='/eduwills';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);

const quizPath='app/dashboard/quiz/page.tsx';
let quiz=read(quizPath);

// Free users may enter Quiz Studio. Their five daily generations do not create quizHistory records.
quiz=quiz.replace(/setActive\(d\.activated===true&&expiry\(d\.activationExpiresAt\)>Date\.now\(\)\);/,'setActive(true);');

// Re-check activation immediately before saving the generated quiz. This avoids permission errors for free users.
quiz=quiz.replace(/const ref=await addDoc\(collection\(db,'quizHistory'\),\{userId:auth\.currentUser\.uid,\.\.\.setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated\.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp\(\)\}\);/,
`const userSnap=await getDoc(doc(db,'users',auth.currentUser.uid));const userData=userSnap.exists()?userSnap.data():{};const accountActivated=userData.activated===true&&expiry(userData.activationExpiresAt)>Date.now();const ref=accountActivated?await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'firebase-gemini-research',createdAt:serverTimestamp()}):{id:\`free-\${Date.now()}-\${Math.random().toString(36).slice(2,8)}\`};`);

quiz=quiz.replace(/await updateDoc\(doc\(db,'quizHistory',setup\.id\),\{status:'completed',answers:finalAnswers,score,total:qs\.length,percentage,elapsedSeconds:elapsed,autoSubmitted:seconds===0\|\|leaveAttemptsRef\.current>=3,leaveAttempts:leaveAttemptsRef\.current\}\);/,
`if(!setup.id.startsWith('free-'))await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',answers:finalAnswers,score,total:qs.length,percentage,elapsedSeconds:elapsed,autoSubmitted:seconds===0||leaveAttemptsRef.current>=3,leaveAttempts:leaveAttemptsRef.current});`);
quiz=quiz.replace(/await updateDoc\(doc\(db,'quizHistory',setup\.id\),\{aiRemarks:text\}\)/g,
`if(!setup.id.startsWith('free-'))await updateDoc(doc(db,'quizHistory',setup.id),{aiRemarks:text})`);
write(quizPath,quiz);

// Keep the homepage SEO repair deterministic. BASE is a Node constant here, so it is never evaluated as a browser variable.
const homePath='app/page.tsx';
let home=read(homePath);
if(!home.includes('Prepare for WAEC, JAMB & NECO with EDUWILLS')){
 const seo=`<section id="seo-learning" className="border-y border-slate-200/70 bg-white py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">Nigerian exam preparation</p><h2 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">Prepare for WAEC, JAMB & NECO with EDUWILLS.</h2><p className="mt-4 leading-7 text-slate-600">Use EDUWILLS for WAEC practice questions, JAMB and UTME preparation, NECO exam preparation and AI-powered book quizzes. Build practice around the books you study, test your understanding and learn from your results.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><a href="${BASE}/study-guides/waec-practice-questions/" className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="font-black text-ink">WAEC Practice Questions</h3><p className="mt-2 text-sm leading-6 text-slate-600">Study-focused practice and revision guidance for Nigerian secondary students.</p></a><a href="${BASE}/study-guides/jamb-utme-practice/" className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="font-black text-ink">JAMB / UTME Practice</h3><p className="mt-2 text-sm leading-6 text-slate-600">Prepare with structured practice and smart revision habits.</p></a><a href="${BASE}/study-guides/neco-exam-preparation/" className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="font-black text-ink">NECO Exam Preparation</h3><p className="mt-2 text-sm leading-6 text-slate-600">Turn your study material into useful practice sessions.</p></a><a href="${BASE}/study-guides/book-quiz-generator/" className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="font-black text-ink">AI Book Quiz Generator</h3><p className="mt-2 text-sm leading-6 text-slate-600">Search for a book and generate questions based on your study instructions.</p></a></div><p className="mt-7 text-xs text-slate-400">EDUWILLS is an independent learning platform and is not affiliated with or endorsed by WAEC, JAMB or NECO.</p></div></section>`;
 home=home.replace('<section id="pricing"',seo+'<section id="pricing"');
}
write(homePath,home);
console.log('Applied EDUWILLS fixes successfully.');
