import fs from 'node:fs';

const pagePath='app/dashboard/quiz/page.tsx';
const aiPath='lib/quizAiClient.ts';
const historyPath='app/dashboard/history/page.tsx';
let p=fs.readFileSync(pagePath,'utf8');
let a=fs.readFileSync(aiPath,'utf8');
let h=fs.readFileSync(historyPath,'utf8');

// Allow every learner to choose 1..100 questions. Unactivated learners are
// limited by five quiz generations/day, not by question count.
p=p.replace(/max=\{active\?100:20\} value=\{questions\} onChange=\{e=>setQuestions\(Math\.min\(active\?100:20,Math\.max\(1,Number\(e\.target\.value\)\|\|1\)\)\)\}/g,
  'max={100} value={questions} onChange={e=>setQuestions(Math.min(100,Math.max(1,Number(e.target.value)||1)))}');
p=p.replace(/const requested=active\?Math\.min\(100,Math\.max\(1,questions\)\):Math\.min\(20,Math\.max\(1,questions\)\);/g,
  'const requested=Math.min(100,Math.max(1,Number(questions)||10));');

// Use the shared resilient AI client instead of the old direct Pollinations request.
if(!p.includes("import { generateQuiz, researchBooks, generateRemarks, explainFailure as explainQuizFailure } from '@/lib/quizAiClient';")){
  p=p.replace("import { auth, db } from '@/lib/firebase';",
    "import { auth, db } from '@/lib/firebase';\nimport { generateQuiz, researchBooks, generateRemarks, explainFailure as explainQuizFailure } from '@/lib/quizAiClient';");
}

// Shared activation interpretation so valid activated records without a legacy expiry field are not falsely locked.
if(!p.includes('function activeFromRecord(d: any)')){
  const helper=`\nfunction activeFromRecord(d: any) {\n  const e=expiryMs(d.activationExpiresAt||d.expiryAt||d.williTokenExpiresAt);\n  const direct=d.activated===true||d.isActivated===true||d.active===true||d.activationStatus==='active'||d.accountStatus==='active'||d.williTokenActive===true||d.williTokenStatus==='active';\n  if(direct&&(!e||e>Date.now())) return true;\n  for(const key of ['activeWilliTokens','activeTokens','activations','williTokens']){\n    const list=d[key];\n    if(!Array.isArray(list)) continue;\n    for(const item of list){ if(!item||item.active===false||item.used===false) continue; const x=expiryMs(item.expiresAt||item.activationExpiresAt||item.expiry); if(x>Date.now()) return true; }\n  }\n  return false;\n}\n`;
  p=p.replace('function normalize(value: string)',helper+'function normalize(value: string)');
}
p=p.replace(/setActive\(d\.activated===true&&expiryMs\(d\.activationExpiresAt\)>Date\.now\(\)\);/,
  'setActive(activeFromRecord(d));');

// Five free quiz generations/day for unactivated learners. The fifth successful
// generation is allowed; activation is required only from the sixth attempt.
if(!p.includes('const [freeUsed, setFreeUsed]')){
  p=p.replace("const [questions, setQuestions] = useState(10), [duration, setDuration] = useState('20'), [difficulty, setDifficulty] = useState('Mixed'), [instructions, setInstructions] = useState('');",
    "const [questions, setQuestions] = useState(10), [duration, setDuration] = useState('20'), [difficulty, setDifficulty] = useState('Mixed'), [instructions, setInstructions] = useState('');\n  const [freeUsed, setFreeUsed] = useState(0);");
}
if(!p.includes("collection(db, 'quizAiQuota')")){
  p=p.replace('setActive(activeFromRecord(d)); await load(u);',
    "setActive(activeFromRecord(d)); const day=new Date().toISOString().slice(0,10); const quota=await getDoc(doc(db,'quizAiQuota',`${u.uid}_${day}`)); setFreeUsed(quota.exists()?Number(quota.data().generated||0):0); await load(u);");
}

const startMarker='  async function startQuiz() {';
const startIdx=p.indexOf(startMarker);
const generateMarker='\n  async function generate(current: Setup) {';
const generateIdx=p.indexOf(generateMarker,startIdx);
if(startIdx>=0&&generateIdx>startIdx){
  const oldStart=p.slice(startIdx,generateIdx);
  const newStart=`  async function startQuiz() {\n    if (!selected.length) { setMessage('Choose at least one book before starting.'); return; }\n    if (!active && freeUsed >= 5) { setMessage('Your 5 free quiz generations for today are finished. Activate EDUWILLS to continue.'); return; }\n    setStarting(true); setMessage('');\n    try {\n      const chosen = books.filter((b) => selected.includes(b.id));\n      const next: Setup = { id: '', books: chosen.map((b) => ({ title: b.title, author: b.author })), questions: Math.min(100,Math.max(1,Number(questions)||10)), duration: duration === 'none' ? null : Number(duration), difficulty, instructions };\n      const ref = await addDoc(collection(db, 'quizHistory'), { userId: auth.currentUser!.uid, books: next.books, questions: next.questions, duration: next.duration, difficulty, instructions, status: 'ready', createdAt: serverTimestamp() });\n      next.id = ref.id;\n      setSetup(next); setIdx(0); setAnswers([]); setDone(false); setQuizError(''); setFeedback(''); setWhy({}); setElapsed(0); setSeconds(next.duration ? next.duration * 60 : null); setQuizLoading(true); await generate(next);\n    } catch (e:any) { setMessage(e?.message || 'Could not start the quiz. Please try again.'); } finally { setStarting(false); }\n  }\n`;
  p=p.slice(0,startIdx)+newStart+p.slice(generateIdx);
}

const genRe=/  async function generate\(current: Setup\) \{[\s\S]*?\n  \}\n\n  async function submitQuiz/;
const genFn=`  async function generate(current: Setup) {\n    try {\n      const research = await researchBooks(current.books);\n      const generated = await generateQuiz(current.books, current.questions, current.difficulty, current.instructions, [], research);\n      if (generated.length !== current.questions) throw new Error('INCOMPLETE_QUIZ');\n      setQs(generated);\n      if (!active) setFreeUsed((v) => Math.min(5, v + 1));\n    } catch (e:any) {\n      console.warn(e);\n      setQuizError(e?.message === 'AI_QUOTA_EXHAUSTED' ? 'Your 5 free quiz generations for today are finished. Activate EDUWILLS to continue.' : (e?.message || 'EDUWILLS AI could not finish this quiz. Please try again.'));\n      try { await updateDoc(doc(db,'quizHistory',current.id),{status:'failed',error:String(e?.message||e)}); } catch {}\n      setQs([]);\n    } finally { setQuizLoading(false); }\n  }\n\n  async function submitQuiz`;
if(genRe.test(p)) p=p.replace(genRe,genFn);
else throw new Error('Quiz generate block not found; refusing to patch.');

// Route Test Overview feedback through the same resilient AI client and keep output plain.
p=p.replace(/try \{ const prompt = `Give brief EDUWILLS study feedback[\s\S]*?finally \{ setFeedbackLoading\(false\); \}/,
  "try { const pct=percentage; const text=await generateRemarks(setup.books,correct,qs.length,pct,setup.difficulty,elapsed); setFeedback(text); } catch {} finally { setFeedbackLoading(false); }");

// Route per-question explanations through the resilient chat-capable client.
p=p.replace(/try \{ const q = qs\[i\]; const prompt = `You are EDUWILLS Quiz AI[\s\S]*?finally \{ setWhyLoading\(null\); \}/,
  "try { const q=qs[i]; const learner=q.options[answers[i]]||'Not answered'; const text=await explainQuizFailure(setup.books.map((b)=>`${b.title} by ${b.author}`).join('; '),q.question,learner,q.options[q.answer]); setWhy((v)=>({...v,[i]:text})); } catch {} finally { setWhyLoading(null); }");

// History uses the same activation interpretation as the quiz and AI pages.
if(h.includes('setActive(d.activated===true&&ms(d.activationExpiresAt)>Date.now());')){
  const helper=`function activeFromRecord(d:any){const e=ms(d.activationExpiresAt||d.expiryAt||d.williTokenExpiresAt);const direct=d.activated===true||d.isActivated===true||d.active===true||d.activationStatus==='active'||d.accountStatus==='active'||d.williTokenActive===true||d.williTokenStatus==='active';if(direct&&(!e||e>Date.now()))return true;for(const key of ['activeWilliTokens','activeTokens','activations','williTokens']){const list=d[key];if(!Array.isArray(list))continue;for(const item of list){if(!item||item.active===false||item.used===false)continue;const x=ms(item.expiresAt||item.activationExpiresAt||item.expiry);if(x>Date.now())return true;}}return false;}\n`;
  h=h.replace('function result(x:any)',helper+'function result(x:any)');
  h=h.replace('setActive(d.activated===true&&ms(d.activationExpiresAt)>Date.now());','setActive(activeFromRecord(d));');
}

// Keep the shared five-generation quota guard and 100-question batching.
const start=a.indexOf('export async function generateQuiz(');
const end=a.indexOf('export async function askEduwills',start);
if(start<0||end<=start) throw new Error('generateQuiz function boundary not found; refusing to modify AI client.');
const fn=`export async function generateQuiz(books:QuizBook[],count:number,difficulty:string,instructions:string,recent:string[]=[],research=''):Promise<QuizQuestion[]>{\n  const requested=Math.min(100,Math.max(1,Number(count)||10));\n  const key=await cacheKey(books,difficulty,instructions);\n  const cached=await readSharedCache(key,recent);\n  const accepted:QuizQuestion[]=[];\n  const seen=new Set(recent.map(fingerprint));\n  for(const q of cached||[]){const k=fingerprint(String(q.question||''));if(k&&!seen.has(k)&&valid(q)){accepted.push(q);seen.add(k);}if(accepted.length>=requested)break;}\n  if(accepted.length>=requested)return accepted.slice(0,requested);\n  if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');\n  let attempts=0,empty=0;\n  const maxAttempts=Math.max(15,Math.ceil((requested-accepted.length)/10)*3);\n  while(accepted.length<requested&&attempts<maxAttempts&&empty<7){\n    attempts++;const remaining=requested-accepted.length;const batch=Math.min(10,remaining);\n    const prompt=buildPrompt(books,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],research)+'\\nBatch '+attempts+': return EXACTLY '+batch+' new questions. Do not repeat earlier questions.';\n    let questions:QuizQuestion[]=[];\n    try{questions=parse(await worker(prompt,60000,'quiz'));}catch{try{const r=await geminiFallback(prompt);questions=parse(r.response.text());}catch{questions=[];}}\n    let added=0;\n    for(const q of questions){const k=fingerprint(q.question);if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;accepted.push(q);seen.add(k);added++;if(accepted.length>=requested)break;}\n    if(added===0)empty++;else empty=0;\n  }\n  if(accepted.length<requested)throw new Error('AI generated '+accepted.length+' of '+requested+' verified questions. Please try again.');\n  await recordQuota();await writeSharedCache(key,accepted);return accepted.slice(0,requested);\n}\n`;
a=a.slice(0,start)+fn+a.slice(end);

fs.writeFileSync(pagePath,p);
fs.writeFileSync(aiPath,a);
fs.writeFileSync(historyPath,h);
console.log('EduWills: quiz AI routed through shared resilient client, 5 free unactivated generations/day enforced, up to 100 questions supported, history access aligned with activation, and Test Overview AI uses plain-text fallback.');
