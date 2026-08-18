import fs from 'node:fs';

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

if (!page.includes('generationTicker')) {
  page = page.replace(
    "const [message,setMessage]=useState(''),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[generationStatus,setGenerationStatus]=useState(''),[generationError,setGenerationError]=useState('');",
    "const [message,setMessage]=useState(''),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[generationStatus,setGenerationStatus]=useState(''),[generationError,setGenerationError]=useState('');\n const [generationTicker,setGenerationTicker]=useState(0);\n const generationMessages=[\n  'Reading your quiz instructions carefully…',\n  'Identifying the exact book and author…',\n  'Researching events, characters and important details…',\n  'Checking dates, places and chronology…',\n  'Asking Gemini to build the first question batch…',\n  'Checking every question against your instructions…',\n  'Removing duplicates and weak questions…',\n  'Verifying the final questions before we show them…'\n ];"
  );
  page = page.replace(
    "useEffect(()=>{answersRef.current=answers},[answers]);",
    "useEffect(()=>{answersRef.current=answers},[answers]);\n useEffect(()=>{if(!busy||setup||generationError){setGenerationTicker(0);return}const t=setInterval(()=>setGenerationTicker(v=>(v+1)%generationMessages.length),2600);return()=>clearInterval(t)},[busy,setup,generationError,generationMessages.length]);"
  );
}

const overlay = /if\(\(busy\|\|generationStatus\|\|generationError\)&&!setup\)return <main[\s\S]*?;\n if\(setup&&qs\.length&&done\)/;
const replacement = `if((busy||generationStatus||generationError)&&!setup)return <main className="fixed inset-0 z-[200] grid min-h-screen place-items-center bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-950 p-5"><section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[.08] p-7 text-center text-white shadow-2xl backdrop-blur-xl"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-cyan-500/20">{generationError?<Sparkles size={34}/>:<Loader2 className="animate-spin" size={34}/>}</div><p className="mt-6 text-[10px] font-black uppercase tracking-[.22em] text-cyan-200">EDUWILLS AI · QUIZ STUDIO</p><h1 className="mt-2 text-2xl font-black">{generationError?'We need another try':'Building your quiz'}</h1><p className="mt-3 min-h-[52px] text-sm leading-6 text-slate-300">{generationError||generationMessages[generationTicker]}</p>{!generationError&&<><div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/2 animate-[pulse_1.6s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300"/></div><div className="mt-5 space-y-2 text-left text-xs font-bold text-slate-300"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300"/> {generationStatus||'Preparing the AI pipeline…'}</div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-white/40"/> Your instructions stay attached to every generation step.</div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-white/40"/> Unsupported or duplicate questions are rejected automatically.</div></div><p className="mt-6 text-[11px] leading-5 text-slate-400">This can take a little while because EDUWILLS is verifying the book content instead of filling the quiz with guesses.</p></>}{generationError&&<div className="mt-6 flex gap-3"><button onClick={reset} className="flex-1 rounded-xl border border-white/20 bg-white/10 py-3 font-black text-white">Back</button><button onClick={()=>{reset();setTimeout(start,50)}} className="flex-1 rounded-xl bg-white py-3 font-black text-slate-950">Try again</button></div>}</section></main>;
 if(setup&&qs.length&&done)`;
if (!overlay.test(page)) throw new Error('Could not locate quiz generation overlay block');
page = page.replace(overlay, replacement);
fs.writeFileSync(pagePath, page);

const libPath = 'lib/quizAiClient.ts';
let lib = fs.readFileSync(libPath, 'utf8');
lib = lib.replace("const CACHE = 'v14-resilient-instruction-first';", "const CACHE = 'v15-resilient-generation';");

if (!lib.includes('const plainQuiz = getGenerativeModel')) {
  const marker = `const plain = getGenerativeModel(ai, {
  model: 'gemini-3.6-flash',
  generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
});`;
  const insert = `${marker}
const plainQuiz = getGenerativeModel(ai, {
  model: 'gemini-3.6-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: questionSchema,
    temperature: 0.2,
    maxOutputTokens: 10000,
  },
});`;
  if (!lib.includes(marker)) throw new Error('Could not locate plain model block');
  lib = lib.replace(marker, insert);
}

const batch = /async function generateBatch\(prompt: string\): Promise<QuizQuestion\[\]> \{[\s\S]*?\n\}\n\nexport async function generateQuiz/;
const batchReplacement = `async function generateBatch(prompt: string): Promise<QuizQuestion[]> {
  let last: any = null;
  const attempts = [
    [grounded, 80000],
    [grounded, 80000],
    [fast, 60000],
    [fast, 60000],
    [plainQuiz, 60000],
    [plainQuiz, 60000],
  ] as const;
  for (let attempt = 0; attempt < attempts.length; attempt++) {
    try {
      const [model, timeout] = attempts[attempt];
      const result = await aiCall(model, prompt, timeout);
      const questions = parseQuestions(result.response.text());
      if (questions.length) return questions;
      last = new Error('Gemini returned no usable questions.');
    } catch (e) {
      last = e;
      await wait(350 * (attempt + 1));
    }
  }
  throw last || new Error('Unable to generate this quiz batch.');
}

export async function generateQuiz`;
if (!batch.test(lib)) throw new Error('Could not locate generateBatch function');
lib = lib.replace(batch, batchReplacement);
lib = lib.replace('while (accepted.length < requested && failures < 12)', 'while (accepted.length < requested && failures < 20)');
lib = lib.replace('const batchSize = Math.min(8, remaining);', 'const batchSize = Math.min(6, remaining);');
fs.writeFileSync(libPath, lib);

console.log('EDUWILLS quiz runtime repaired: rotating generation UI + multi-model retry/fallback.');
