import fs from 'node:fs';
const file='app/dashboard/quiz/page.tsx';
let s=fs.readFileSync(file,'utf8');

const startRe=/  async function startQuiz\(\) \{[\s\S]*?\n  \}\n\n  async function generate\(current: Setup\) \{/;
const startReplacement=`  async function startQuiz() {
    if (!selected.length) { setMessage('Choose at least one book before starting.'); return; }
    if (!active && freeQuizCount >= FREE_DAILY_QUIZZES) { setMessage('You have used all 5 free quizzes for today. Activate EDUWILLS to continue.'); return; }
    const requested = Math.min(maxQuestions, Math.max(1, Number(questions) || 1));
    const chosen = books.filter((b) => selected.includes(b.id));
    if (!chosen.length) { setMessage('Choose at least one book before starting.'); return; }
    setStarting(true); setMessage(''); setQuizError('');
    const provisional: Setup = {
      id: '', books: chosen.map((b) => ({ title: b.title, author: b.author })), questions: requested,
      duration: duration === 'none' ? null : Math.max(5, Number(duration) || 5), difficulty, instructions,
      startedAtMs: Date.now(), endAtMs: null, freeDay: active ? undefined : todayKey()
    };
    setSetup(provisional); setIdx(0); setAnswers([]); setDone(false); setFeedback(''); setWhy({}); setElapsed(0); setSeconds(null); setQuizLoading(true); setTimeWarning('');
    try {
      await generate(provisional);
      const startedAtMs = Date.now();
      const finalSetup: Setup = { ...provisional, startedAtMs, endAtMs: provisional.duration ? startedAtMs + provisional.duration * 60000 : null };
      const ref = await addDoc(collection(db, 'quizHistory'), { userId: auth.currentUser!.uid, books: finalSetup.books, questions: finalSetup.questions, duration: finalSetup.duration, difficulty: finalSetup.difficulty, instructions: finalSetup.instructions, status: 'ready', freeDay: finalSetup.freeDay || null, createdAt: serverTimestamp() });
      finalSetup.id = ref.id;
      setSetup(finalSetup); setSeconds(finalSetup.duration ? finalSetup.duration * 60 : null); setElapsed(0); setQuizLoading(false);
      if (!active) setFreeQuizCount((v) => Math.min(FREE_DAILY_QUIZZES, v + 1));
    } catch (e: any) {
      setQuizLoading(false); setMessage(e?.message || 'EDUWILLS AI could not finish this quiz.');
    } finally { setStarting(false); }
  }

  async function generate(current: Setup) {`;
if(!startRe.test(s)) throw new Error('startQuiz block not found');
s=s.replace(startRe,startReplacement);

const genRe=/  async function generate\(current: Setup\) \{[\s\S]*?\n  \}\n\n  async function submitQuiz/;
const genReplacement=`  async function generate(current: Setup) {
    setQuizError(''); setQuizLoading(true);
    try {
      const research = await researchBooks(current.books);
      const recent = Array.isArray(qs) ? qs.map((q) => q.question) : [];
      const generated = await generateQuiz(current.books, current.questions, current.difficulty, current.instructions, recent, research);
      if (!Array.isArray(generated) || generated.length < current.questions) throw new Error('EDUWILLS AI returned an incomplete batch. Please retry.');
      setQs(generated.slice(0, current.questions)); setQuizError(''); setQuizLoading(false);
    } catch (e: any) {
      console.warn(e);
      const message = e?.message === 'AI_QUOTA_EXHAUSTED' ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.' : (e?.message || 'EDUWILLS AI could not finish the requested batch. Please try again.');
      setQuizError(message); setQuizLoading(false); throw e;
    }
  }

  async function retryGeneration() {
    if (!setup) return;
    setQuizError(''); setQuizLoading(true);
    try { await generate(setup); } catch {}
  }

  async function submitQuiz`;
if(!genRe.test(s)) throw new Error('generate block not found');
s=s.replace(genRe,genReplacement);

const oldExpired="if (saved.setup.endAtMs && Date.now() >= saved.setup.endAtMs) {\n        localStorage.removeItem('eduwills_active_quiz');\n        return;\n      }";
const newExpired="if (saved.setup.endAtMs && Date.now() >= saved.setup.endAtMs) {\n        setSetup(saved.setup); setQs(saved.qs); setAnswers(saved.answers || []); setIdx(Number(saved.idx || 0));\n        setSeconds(0); setElapsed(Math.max(0, Math.floor((Date.now() - Number(saved.setup.startedAtMs || Date.now())) / 1000)));\n        setQuizLoading(false); setDone(false); setTimeWarning('Time is up. Your quiz will be submitted automatically.');\n        setTimeout(() => submitQuiz(true), 0);\n        return;\n      }";
if(s.includes(oldExpired)) s=s.replace(oldExpired,newExpired);

const loadRe=/  if \(setup && quizLoading\) return <main className="grid min-h-screen[\s\S]*?;\n\n  if \(setup && done\)/;
const loadReplacement=`  if (setup && quizLoading) return <main className="relative grid min-h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-white to-violet-100 p-6 text-slate-900"><div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 animate-pulse rounded-full bg-cyan-300/30 blur-3xl"/><div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 animate-pulse rounded-full bg-fuchsia-300/30 blur-3xl"/><div className="relative mx-auto flex w-full max-w-md items-center justify-center"><div className="w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-7 text-center shadow-2xl backdrop-blur-xl"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-white shadow-lg shadow-indigo-200"><Sparkles className="animate-pulse" size={34}/></div><div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-50 to-cyan-50 px-4 py-2 text-xs font-black text-indigo-700"><Loader2 className="animate-spin" size={14}/> EDUWILLS AI is working</div><h1 className="mt-4 text-2xl font-black tracking-tight">Building your {setup.questions}-question quiz ✨</h1><p className="mt-2 text-sm leading-6 text-slate-500">{setup.questions <= 10 ? 'This small quiz should be ready quickly.' : setup.questions <= 20 ? 'I’m preparing a larger batch and checking each question.' : 'I’m building the quiz in efficient batches. Larger quizzes take longer so accuracy is preserved.'}</p><div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-cyan-400"/></div><div className="mt-4 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400"><span>Exact book grounding</span><span>Up to {setup.questions}</span></div></div></div></main>;

  if (setup && quizError && !qs.length) return <main className="relative grid min-h-screen overflow-hidden bg-gradient-to-br from-rose-50 via-white to-cyan-50 p-6"><div className="relative mx-auto flex w-full max-w-md items-center"><div className="w-full rounded-[2rem] border border-white bg-white/95 p-7 text-center shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white"><XCircle size={30}/></div><h1 className="mt-5 text-2xl font-black">We need one more try</h1><p className="mt-2 text-sm leading-6 text-slate-500">{quizError}</p><div className="mt-5 grid gap-3"><button onClick={retryGeneration} className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 px-5 py-3.5 font-black text-white shadow-lg">Retry quiz generation</button><button onClick={resetQuiz} className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 font-black text-slate-700">Back to Quiz Builder</button></div></div></div></main>;

  if (setup && done)`;
if(!loadRe.test(s)) throw new Error('loading block not found');
s=s.replace(loadRe,loadReplacement);

fs.writeFileSync(file,s);
console.log('Quiz startup now generates before starting the timer, shows a bright progress state, retries failed generation instead of returning silently, and auto-submits expired attempts.');
