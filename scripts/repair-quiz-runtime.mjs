import fs from 'node:fs';

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

if (!page.includes('generationTicker')) {
  page = page.replace(
    "const [message,setMessage]=useState(''),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[generationStatus,setGenerationStatus]=useState(''),[generationError,setGenerationError]=useState('');",
    "const [message,setMessage]=useState(''),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[generationStatus,setGenerationStatus]=useState(''),[generationError,setGenerationError]=useState('');\n const [generationTicker,setGenerationTicker]=useState(0);\n const generationMessages=['Reading your quiz instructions carefully…','Identifying the exact book and author…','Researching the book content…','Checking characters, events and important details…','Building your questions…','Checking every question against your instructions…','Removing duplicates and weak questions…','Finalising your quiz…'];"
  );
  page = page.replace(
    "useEffect(()=>{answersRef.current=answers},[answers]);",
    "useEffect(()=>{answersRef.current=answers},[answers]);\n useEffect(()=>{if(!busy||setup||generationError){setGenerationTicker(0);return}const t=setInterval(()=>setGenerationTicker(v=>(v+1)%generationMessages.length),2200);return()=>clearInterval(t)},[busy,setup,generationError]);"
  );
}

const overlay = /if\(\(busy\|\|generationStatus\|\|generationError\)&&!setup\)return <main[\s\S]*?;\n if\(setup&&qs\.length&&done\)/;
if (overlay.test(page)) {
  const replacement = `if((busy||generationStatus||generationError)&&!setup)return <main className="fixed inset-0 z-[200] grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-950 p-5"><section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[.08] p-7 text-center text-white shadow-2xl backdrop-blur-xl"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-cyan-500/20">{generationError?<Sparkles size={34}/>:<Loader2 className="animate-spin" size={34}/>}</div><p className="mt-6 text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">EDUWILLS AI · QUIZ STUDIO</p><h1 className="mt-2 text-2xl font-black">{generationError?'We need another try':'Building your quiz'}</h1><p className="mt-3 min-h-[52px] text-sm leading-6 text-slate-300">{generationError||generationMessages[generationTicker]}</p>{!generationError&&<><div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/2 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300"/></div><div className="mt-5 space-y-2 text-left text-xs font-bold text-slate-300"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300"/> {generationStatus||'Preparing the AI…'}</div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-white/40"/> Your instructions stay attached to every generation step.</div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-white/40"/> Questions are checked before they are accepted.</div></div></>}{generationError&&<div className="mt-6 flex gap-3"><button onClick={reset} className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 font-black text-white">Back</button><button onClick={()=>{reset();setTimeout(start,50)}} className="flex-1 rounded-xl bg-white py-3 font-black text-slate-950">Try again</button></div>}</section></main>;\n if(setup&&qs.length&&done)`;
  page = page.replace(overlay, replacement);
}
fs.writeFileSync(pagePath, page);

const libPath = 'lib/quizAiClient.ts';
let lib = fs.readFileSync(libPath, 'utf8');

if (!lib.includes("from 'firebase/auth'")) {
  lib = lib.replace("import app from '@/lib/firebase';", "import app from '@/lib/firebase';\nimport { getAuth } from 'firebase/auth';");
}

if (!lib.includes('EDUWILLS_MULTI_PROVIDER_ROUTER')) {
  const marker = 'async function generateBatch(prompt: string): Promise<QuizQuestion[]> {';
  const router = `async function EDUWILLS_MULTI_PROVIDER_ROUTER(prompt: string): Promise<QuizQuestion[]> {\n  const user = getAuth(app).currentUser;\n  if (!user) throw new Error('AI_AUTH_REQUIRED');\n  const token = await user.getIdToken();\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), 38000);\n  try {\n    const r = await fetch('https://us-central1-eduwills.cloudfunctions.net/quizAiRouter', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },\n      body: JSON.stringify({ prompt }),\n      signal: controller.signal,\n    });\n    if (!r.ok) throw new Error('AI_ROUTER_' + r.status);\n    const data = await r.json();\n    const questions = parseQuestions(String(data?.text || ''));\n    if (!questions.length) throw new Error('AI_ROUTER_EMPTY');\n    return questions;\n  } finally { clearTimeout(timer); }\n}\n\n`;
  if (lib.includes(marker)) lib = lib.replace(marker, router + marker);
}

if (!lib.includes('ROUTER_FIRST_GENERATION')) {
  const old = `async function generateBatch(prompt: string): Promise<QuizQuestion[]> {\n  let last: any = null;\n  for (let attempt = 1; attempt <= 4; attempt++) {`;
  const replacement = `async function generateBatch(prompt: string): Promise<QuizQuestion[]> {\n  let last: any = null;\n  // ROUTER_FIRST_GENERATION: Groq/OpenRouter first; Gemini is the final fallback.\n  try { return await EDUWILLS_MULTI_PROVIDER_ROUTER(prompt); } catch (e) { last = e; }\n  for (let attempt = 1; attempt <= 2; attempt++) {`;
  if (lib.includes(old)) lib = lib.replace(old, replacement);
}

lib = lib.replace('attempt <= 2 ? 80000 : 60000', 'attempt <= 2 ? 30000 : 25000');
lib = lib.replace('failures < 12', 'failures < 6');
lib = lib.replace('Math.min(8, remaining)', 'Math.min(10, remaining)');
lib = lib.replace('repairAttempts < 6', 'repairAttempts < 2');
lib = lib.replace(/const CACHE = '[^']+';/, "const CACHE = 'v17-multiprovider-functional';");

fs.writeFileSync(libPath, lib);
console.log('EDUWILLS quiz runtime: cache-first, secure Groq/OpenRouter router, bounded Gemini fallback, rotating progress UI.');
