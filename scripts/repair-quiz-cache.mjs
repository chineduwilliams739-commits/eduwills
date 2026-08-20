import fs from 'node:fs';

const pagePath='app/dashboard/quiz/page.tsx';
let page=fs.readFileSync(pagePath,'utf8');

page=page.replace(
  "import {addDoc,collection,doc,getDoc,getDocs,query,serverTimestamp,updateDoc,where} from 'firebase/firestore';",
  "import {addDoc,collection,doc,getDoc,getDocs,increment,limit,query,runTransaction,serverTimestamp,updateDoc,where} from 'firebase/firestore';"
);

const helperAnchor="const difficulties=[['Easy','Easy'],['Medium','Medium'],['Hard','Hard'],['Mixed','Mixed']];";
if(!page.includes('QUIZ_POOL_TTL_MS')){
 page=page.replace(helperAnchor, helperAnchor+`\n\nconst QUIZ_POOL_TTL_MS=7*24*60*60*1000;\nconst DAILY_AI_GENERATIONS=5;\nconst QUIZ_POOL_VARIANTS=5;\nconst stableHash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)};\nconst quizPoolKey=(books:Book[],count:number,difficulty:string,instructions:string)=>stableHash(JSON.stringify({books:books.map(b=>[norm(b.title),norm(b.author)]),count,difficulty,instructions:norm(instructions)}));\nconst quizDay=()=>new Date().toISOString().slice(0,10);\n\nasync function reserveAiGeneration(uid:string){\n const ref=doc(db,'quizAiQuota',uid+'_'+quizDay());\n return runTransaction(db,async tx=>{\n  const snap=await tx.get(ref);const current=snap.exists()?Number(snap.data().generated||0):0;\n  if(current>=DAILY_AI_GENERATIONS)throw new Error('The AI generation quota for today has been reached. Please use a cached quiz or try again tomorrow.');\n  tx.set(ref,{uid,day:quizDay(),generated:current+1,updatedAt:serverTimestamp()},{merge:true});\n  return current+1;\n });\n}\n\nasync function loadQuizPool(key:string,recent:string[],requested:number){\n try{\n  const snap=await getDocs(query(collection(db,'quizQuestionCache'),where('cacheKey','==',key),limit(QUIZ_POOL_VARIANTS)));\n  const candidates=snap.docs.map(d=>({id:d.id,...d.data()} as any)).filter(x=>Array.isArray(x.questions)&&x.questions.length>=requested&&Number(x.expiresAtMs||0)>Date.now());\n  if(!candidates.length)return null;\n  const scored=candidates.map(x=>{const overlap=x.questions.reduce((n:any,q:any)=>n+(recent.some(r=>similar(String(q.question||''),r))?1:0),0);return {...x,overlap}}).sort((a:any,b:any)=>a.overlap-b.overlap||Number(a.lastUsedAtMs||0)-Number(b.lastUsedAtMs||0));\n  const chosen=scored[0];\n  try{await updateDoc(doc(db,'quizQuestionCache',chosen.id),{lastUsedAtMs:Date.now(),usageCount:increment(1)})}catch{}\n  return chosen.questions.slice(0,requested) as QuizQuestion[];\n }catch{return null}\n}\n\nasync function saveQuizPool(key:string,books:Book[],difficulty:string,instructions:string,questions:QuizQuestion[]){\n try{\n  const now=Date.now();\n  const snap=await getDocs(query(collection(db,'quizQuestionCache'),where('cacheKey','==',key),limit(QUIZ_POOL_VARIANTS)));\n  const docs=snap.docs.map(d=>({id:d.id,...d.data()} as any));\n  const same=docs.find(x=>Array.isArray(x.questions)&&x.questions.length===questions.length&&x.questions[0]?.question===questions[0]?.question);\n  if(same)return;\n  const expired=docs.filter(x=>Number(x.expiresAtMs||0)<=now).sort((a,b)=>Number(a.expiresAtMs||0)-Number(b.expiresAtMs||0))[0];\n  const data={cacheKey:key,books:books.map(b=>({title:b.title,author:b.author})),difficulty,instructions:String(instructions||'').slice(0,2000),questions,createdAtMs:now,expiresAtMs:now+QUIZ_POOL_TTL_MS,lastUsedAtMs:0,usageCount:0};\n  if(expired)await updateDoc(doc(db,'quizQuestionCache',expired.id),data);else if(docs.length<QUIZ_POOL_VARIANTS)await addDoc(collection(db,'quizQuestionCache'),data);\n }catch{}\n}\n`);
}

// The Quiz Studio source has evolved between deployments. Do not depend on a
// formatting-specific leading space or exact indentation when locating start().
const startRe=/async function start\(\)\{[\s\S]*?\n\s*\}\n\s*async function submit/;
if(startRe.test(page)){
 const startReplacement=`async function start(){
  if(!selected.length){setMessage('Choose at least one saved book.');return}if(!auth.currentUser){setMessage('Your session has expired.');return}
  setBusy(true);setGenerationError('');setGenerationStatus('Checking the question cache…');setMessage('');
  try{
   const chosen=books.filter(b=>selected.includes(b.id));const setupData={books:chosen.map(b=>({title:b.title,author:b.author})),questions,duration:duration==='none'?null:Number(duration),difficulty,instructions};
   const recent=await recentQuestions();
   const cacheKey=quizPoolKey(chosen,questions,difficulty,instructions);
   const cached=await loadQuizPool(cacheKey,recent,questions);
   if(cached&&cached.length>=questions){
    setGenerationStatus('Found a verified cached question set — rotating questions for you…');
    const ref=active?await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:cached,total:cached.length,generationMode:'cached-question-pool',createdAt:serverTimestamp()}):null;
    const s:Setup={id:ref?.id||'free-'+Date.now(),...setupData,persisted:Boolean(ref)};setSetup(s);setIdx(0);setDone(false);setConfirm(false);setExitConfirm(false);setAnswers(Array(cached.length).fill(null));answersRef.current=Array(cached.length).fill(null);setElapsed(0);setSeconds(s.duration?s.duration*60:null);setQs(cached);setRemarks('');setGenerationStatus('');setLeaveAttempts(0);leaveAttemptsRef.current=0;allowNavigationRef.current=false;historyArmedRef.current=false;quizUrlRef.current=window.location.href;return;
   }
   setGenerationStatus('No suitable cached set yet — reserving one AI generation…');
   await reserveAiGeneration(auth.currentUser.uid);
   setGenerationStatus('Researching your selected books from multiple sources…');
   const research=await researchBooks(setupData.books);
   if(!research.trim())throw new Error('No reliable book information was found. Please try again later.');
   setGenerationStatus('Generating questions with the AI providers…');
   const generated=await generateQuiz(setupData.books,questions,difficulty,instructions,recent,research);
   if(!Array.isArray(generated)||generated.length<questions)throw new Error('The quiz AI could only verify '+(Array.isArray(generated)?generated.length:0)+' of '+questions+' questions.');
   if(generated.some(q=>!q.question||!Array.isArray(q.options)||q.options.length!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3))throw new Error('The AI returned an incomplete question set. Please try again.');
   await saveQuizPool(cacheKey,chosen,difficulty,instructions,generated);
   const ref=active?await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser.uid,...setupData,status:'ready',score:null,percentage:null,questionsData:generated,total:generated.length,generationMode:'multi-provider-research',createdAt:serverTimestamp()}):null;
   const s:Setup={id:ref?.id||'free-'+Date.now(),...setupData,persisted:Boolean(ref)};setSetup(s);setIdx(0);setDone(false);setConfirm(false);setExitConfirm(false);setAnswers(Array(generated.length).fill(null));answersRef.current=Array(generated.length).fill(null);setElapsed(0);setSeconds(s.duration?s.duration*60:null);setQs(generated);setRemarks('');setGenerationStatus('');setLeaveAttempts(0);leaveAttemptsRef.current=0;allowNavigationRef.current=false;historyArmedRef.current=false;quizUrlRef.current=window.location.href;
  }catch(e:any){console.error(e);setGenerationError(e?.message||'Quiz generation failed.');setGenerationStatus('');setQs([]);setSetup(null)}
  finally{setBusy(false)}
 }

 async function submit`;
 page=page.replace(startRe,startReplacement);
 console.log('Quiz cache repair applied.');
}else{
 console.log('Quiz Studio start() already differs from the old repair template; leaving the current implementation unchanged.');
}

// Unactivated learners may use Quiz Studio within the existing 5-AI-generation daily quota.
page=page.replace("if(!active)return <main", "if(false&& !active)return <main");
fs.writeFileSync(pagePath,page);
console.log('EDUWILLS quiz resilience repair complete.');
