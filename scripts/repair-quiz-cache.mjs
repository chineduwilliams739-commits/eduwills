import fs from 'node:fs';

const pagePath='app/dashboard/quiz/page.tsx';
let page=fs.readFileSync(pagePath,'utf8');

// Keep the original Quiz Studio structure/design, but route generation through
// the working multi-provider client and keep free users out of History writes.
if(!page.includes("from '@/lib/quizAiClient'")){
  page=page.replace("import { auth, db } from '@/lib/firebase';", "import { auth, db } from '@/lib/firebase';\nimport { generateQuiz } from '@/lib/quizAiClient';");
  page=page.replace("import {auth,db} from '@/lib/firebase';", "import {auth,db} from '@/lib/firebase';\nimport {generateQuiz} from '@/lib/quizAiClient';");
}

// The original page locked the whole Studio for unactivated users. Keep the
// Studio UI available and enforce the free-tier limit only when generating.
page=page.replace(/\n\s*if\(!active\) return <main[\s\S]*?<\/main>;\n/, '\n');

// The repaired flow needs to remember whether a History document exists.
page=page.replace(
  /type Setup=\{id:string;books:\{title:string;author:string\}\[\];questions:number;duration:number\|null;difficulty:string;instructions:string\};/,
  'type Setup={id:string;books:{title:string;author:string}[];questions:number;duration:number|null;difficulty:string;instructions:string;persisted:boolean};'
);
page=page.replace(
  /type Setup = \{ id: string; books: \{ title: string; author: string \}\[\]; questions: number; duration: number \| null; difficulty: string; instructions: string \};/,
  'type Setup = { id: string; books: { title: string; author: string }[]; questions: number; duration: number | null; difficulty: string; instructions: string; persisted: boolean };'
);

const startQuizRe=/async function startQuiz\(\)\{[\s\S]*?\n\s*async function generate/;
if(startQuizRe.test(page)){
 const replacement=`async function startQuiz(){
  setMessage('');
  if(!selected.length){setMessage('Choose at least one book before starting.');return;}
  if(!auth.currentUser){setMessage('Your session has expired. Please sign in again.');return;}
  setStarting(true);setQuizError('');setQuizLoading(true);
  try{
   const chosen=books.filter(b=>selected.includes(b.id));
   const requested=active?Math.min(100,Math.max(1,Number(questions)||10)):Math.min(20,Math.max(1,Number(questions)||10));
   if(!active&&Number(questions)>20)setMessage('Unactivated accounts are limited to 20 questions per quiz. Your request was capped at 20.');
   const setupData={books:chosen.map(b=>({title:b.title,author:b.author})),questions:requested,duration:duration==='none'?null:Number(duration),difficulty,instructions};
   const recent=active?await getDocs(query(collection(db,'quizHistory'),where('userId','==',auth.currentUser.uid))).then(s=>s.docs.flatMap(d=>Array.isArray(d.data().questionsData)?d.data().questionsData.map((q:any)=>String(q.question||'')):[]).slice(-60)):[];
   const generated=await generateQuiz(setupData.books,requested,difficulty,instructions,recent,"Use the exact selected books and follow the learner's instructions. Generate factual questions from the books. Do not invent quotations or unsupported details.");
   if(!Array.isArray(generated)||generated.length<requested)throw new Error('The AI generated only '+(Array.isArray(generated)?generated.length:0)+' of '+requested+' verified questions. Please try again.');
   const ref=active?await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'multi-provider',createdAt:serverTimestamp()}):null;
   const s:any={id:ref?.id||'free-'+Date.now(),...setupData,persisted:Boolean(ref)};
   setSetup(s);setIdx(0);setAnswers([]);setDone(false);setSeconds(s.duration?s.duration*60:null);setQs(generated);setQuizError('');
  }catch(e:any){console.error(e);setQuizError(String(e?.message||'Quiz generation failed. Please try again.'));setQs([]);setSetup(null)}
  finally{setQuizLoading(false);setStarting(false)}
 }

 async function generate`;
 page=page.replace(startQuizRe,replacement);
}

// Enforce 20 questions for unactivated users in the visible control too.
page=page.replace(
  "max={100} value={questions} onChange={e=>setQuestions(Math.min(100,Math.max(1,Number(e.target.value)||1)))}",
  "max={active?100:20} value={questions} onChange={e=>setQuestions(Math.min(active?100:20,Math.max(1,Number(e.target.value)||1)))}"
);

// Prevent free users from attempting a quizHistory update at submission time.
page=page.replace(
  /try\{await updateDoc\(doc\(db,'quizHistory',setup\.id\),\{status:'completed',questionsData:qs,answers,score:correct,total:qs\.length,percentage,elapsedSeconds:elapsed,completedAt:serverTimestamp\(\)\}\);\} catch\{\}/,
  "if(setup.persisted){try{await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',questionsData:qs,answers,score:correct,total:qs.length,percentage,elapsedSeconds:elapsed,completedAt:serverTimestamp()});}catch{}}"
);

// If AI generation fails, keep the original loading/Studio design but expose a
// clear retry state instead of silently returning to the builder.
const renderAnchor='if(setup&&quizLoading)return';
if(!page.includes('if(quizError&&!setup)return')&&page.includes(renderAnchor)){
  page=page.replace(renderAnchor, "if(quizError&&!setup)return <main className=\"grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6\"><section className=\"w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-2xl\"><div className=\"mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-eduBlue\">!</div><h1 className=\"mt-5 text-2xl font-black\">Quiz generation needs another try</h1><p className=\"mt-3 text-sm leading-6 text-slate-500\">{quizError}</p><div className=\"mt-6 flex gap-3\"><button type=\"button\" onClick={()=>setQuizError('')} className=\"flex-1 rounded-xl border border-slate-200 py-3 font-black\">Back to Studio</button><button type=\"button\" onClick={()=>{setQuizError('');setTimeout(startQuiz,50)}} className=\"flex-1 rounded-xl bg-ink py-3 font-black text-white\">Try again</button></div></section></main>;\n "+renderAnchor);
}

fs.writeFileSync(pagePath,page);
console.log('EDUWILLS Quiz Studio original UI restored; AI routing and free-tier safeguards applied.');
