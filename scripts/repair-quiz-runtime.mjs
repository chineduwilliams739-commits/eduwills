import fs from 'node:fs';

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

if (!page.includes('generationTicker')) {
  page = page.replace(
    "const [message,setMessage]=useState(''),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[generationStatus,setGenerationStatus]=useState(''),[generationError,setGenerationError]=useState('');",
    "const [message,setMessage]=useState(''),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[generationStatus,setGenerationStatus]=useState(''),[generationError,setGenerationError]=useState('');\n const [generationTicker,setGenerationTicker]=useState(0);\n const generationMessages=[\n  'Reading your quiz instructions carefully…',\n  'Identifying the exact book and author…',\n  'Researching the book content…',\n  'Checking characters, events and important details…',\n  'Building your questions…',\n  'Checking every question against your instructions…',\n  'Removing duplicates and weak questions…',\n  'Finalising your quiz…'\n ];"
  );
  page = page.replace(
    "useEffect(()=>{answersRef.current=answers},[answers]);",
    "useEffect(()=>{answersRef.current=answers},[answers]);\n useEffect(()=>{if(!busy||setup||generationError){setGenerationTicker(0);return}const t=setInterval(()=>setGenerationTicker(v=>(v+1)%generationMessages.length),2200);return()=>clearInterval(t)},[busy,setup,generationError,generationMessages.length]);"
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

if (!lib.includes('ThinkingLevel')) {
  lib = lib.replace(
    "import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai';",
    "import { getAI, getGenerativeModel, GoogleAIBackend, Schema, ThinkingLevel } from 'firebase/ai';"
  );
}

const models = /\/\/ Gemini 3\.6 Flash[\s\S]*?const CACHE = '[^']+';/;
const modelReplacement = `// Fast, purpose-specific Gemini models. Research returns plain text; quiz generation returns strict JSON.\nconst researchModel = getGenerativeModel(ai, {\n  model: 'gemini-3.6-flash',\n  generationConfig: {\n    temperature: 0.2,\n    maxOutputTokens: 5000,\n    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },\n  },\n  tools: [{ googleSearch: {} }],\n});\nconst grounded = getGenerativeModel(ai, {\n  model: 'gemini-3.6-flash',\n  generationConfig: {\n    responseMimeType: 'application/json',\n    responseSchema: questionSchema,\n    temperature: 0.25,\n    maxOutputTokens: 7000,\n    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },\n  },\n});\nconst fast = getGenerativeModel(ai, {\n  model: 'gemini-3.5-flash-lite',\n  generationConfig: {\n    responseMimeType: 'application/json',\n    responseSchema: questionSchema,\n    temperature: 0.2,\n    maxOutputTokens: 6500,\n    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },\n  },\n});\nconst plain = getGenerativeModel(ai, {\n  model: 'gemini-3.6-flash',\n  generationConfig: { temperature: 0.2, maxOutputTokens: 700, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } },\n});\nconst plainQuiz = fast;\n\nconst CACHE = 'v16-fast-functional-quiz';`;
if (models.test(lib)) lib = lib.replace(models, modelReplacement);
else throw new Error('Quiz model block not found');

lib = lib.replace(/aiCall\(grounded, prompt, 65000\)/g, 'aiCall(researchModel, prompt, 18000)');
lib = lib.replace(/aiCall\(fast, prompt, 50000\)/g, 'aiCall(researchModel, prompt, 10000)');

const batch = /async function generateBatch\(prompt: string\): Promise<QuizQuestion\[\]> \{[\s\S]*?\n\}\n\nexport async function generateQuiz/;
const batchReplacement = `async function generateBatch(prompt: string): Promise<QuizQuestion[]> {\n  let last: any = null;\n  const attempts = [\n    [fast, 30000],\n    [fast, 30000],\n    [grounded, 30000],\n  ] as const;\n  for (let attempt = 0; attempt < attempts.length; attempt++) {\n    try {\n      const [model, timeout] = attempts[attempt];\n      const result = await aiCall(model, prompt, timeout);\n      const questions = parseQuestions(result.response.text());\n      if (questions.length) return questions;\n      last = new Error('Gemini returned no usable questions.');\n    } catch (e) {\n      last = e;\n      if (attempt < attempts.length - 1) await wait(200);\n    }\n  }\n  throw last || new Error('Unable to generate this quiz batch.');\n}\n\nexport async function generateQuiz`;
if (!batch.test(lib)) throw new Error('generateBatch block not found');
lib = lib.replace(batch, batchReplacement);
lib = lib.replace('while (accepted.length < requested && failures < 12)', 'while (accepted.length < requested && failures < 6)');
lib = lib.replace('const batchSize = Math.min(8, remaining);', 'const batchSize = Math.min(10, remaining);');
lib = lib.replace('while (contentCount < targetContent && repairAttempts < 6)', 'while (contentCount < targetContent && repairAttempts < 2)');
fs.writeFileSync(libPath, lib);

console.log('EDUWILLS quiz runtime: fast research, low-thinking Gemini generation, bounded retries, rotating progress UI.');
