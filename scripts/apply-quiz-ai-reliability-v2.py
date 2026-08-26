from pathlib import Path

quiz_path = Path('app/dashboard/quiz/page.tsx')
ai_path = Path('lib/quizAiClient.ts')

quiz = quiz_path.read_text()
ai = ai_path.read_text()

old = """      const chosen = books.filter((b) => selected.includes(b.id));\n      const startedAtMs = Date.now();"""
new = """      const chosen = books.filter((b) => selected.includes(b.id));\n      if (!chosen.length) {\n        setMessage('⚠️ Please select at least one saved book before generating a quiz. EDUWILLS AI will not generate a quiz without a selected book.');\n        setStarting(false);\n        return;\n      }\n      const startedAtMs = Date.now();"""
if old in quiz:
    quiz = quiz.replace(old, new, 1)

old = """      setQuizError(e?.message === 'AI_QUOTA_EXHAUSTED' ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.' : 'EDUWILLS AI could not finish the requested batch. Please try again.');\n      setQs([]);\n    } finally { setQuizLoading(false); }"""
new = """      setQuizError(e?.message === 'AI_QUOTA_EXHAUSTED' ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.' : 'EDUWILLS AI could not finish the requested batch. Please try again.');\n      setQs([]);\n      throw e;\n    } finally { setQuizLoading(false); }"""
if old in quiz:
    quiz = quiz.replace(old, new, 1)

old = """    return <main className=\"min-h-screen bg-paper text-ink\"><header className=\"border-b border-slate-200 bg-white\"><div className=\"mx-auto flex max-w-4xl items-center justify-between px-5 py-3\"><div className=\"text-center\"><div className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black ${seconds !== null && seconds <= 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}><Clock3 size={16}/> {mm}:{ss}</div><div className=\"mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400\">Time remaining</div></div><button onClick={() => setExitQuiz(true)} className=\"inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 shadow-sm\"><X size={15}/> Exit Quiz</button></div></header>"""
new = """    const progress = Math.round(((idx + 1) / Math.max(1, qs.length)) * 100);\n    return <main className=\"min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 text-ink\"><header className=\"sticky top-0 z-30 border-b border-white/70 bg-white/90 shadow-sm backdrop-blur-xl\"><div className=\"mx-auto max-w-5xl px-4 py-3 sm:px-6\"><div className=\"flex items-center justify-between gap-3\"><div className=\"min-w-0\"><p className=\"text-[10px] font-black uppercase tracking-[.2em] text-eduBlue\">EDUWILLS • QUIZ STUDIO</p><p className=\"truncate text-sm font-black text-slate-700\">{setup.books.map((b) => b.title).join(' • ')}</p></div><div className=\"flex items-center gap-2\"><div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black shadow-sm ${seconds !== null && seconds <= 60 ? 'bg-red-100 text-red-700 ring-2 ring-red-200' : 'bg-slate-100 text-slate-700'}`}><Clock3 size={16}/> {mm}:{ss}</div><button onClick={() => setExitQuiz(true)} className=\"inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 shadow-sm hover:bg-red-100\"><X size={15}/> Exit</button></div></div><div className=\"mt-3 h-2 overflow-hidden rounded-full bg-slate-100\"><div className=\"h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 transition-all duration-300\" style={{ width: `${progress}%` }}/></div></div></div></header>"""
if old in quiz:
    quiz = quiz.replace(old, new, 1)

old = """        <section className=\"mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8\"><h1 className=\"text-xl font-black leading-8 sm:text-2xl\">{q.question}</h1>"""
new = """        <section className=\"mt-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60\"><div className=\"border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-6 py-4 sm:px-8\"><div className=\"flex items-center justify-between gap-3\"><span className=\"rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700\">Question {idx + 1}</span><span className=\"text-xs font-black text-slate-400\">{progress}% complete</span></div></div><div className=\"p-6 sm:p-8\"><h1 className=\"text-xl font-black leading-8 text-slate-900 sm:text-2xl\">{q.question}</h1>"""
if old in quiz:
    quiz = quiz.replace(old, new, 1)

# Close the new question-content wrapper introduced above.
quiz = quiz.replace('Swipe sideways to navigate questions</p></div></section>', 'Swipe sideways to navigate questions</p></div></div></section>', 1)
quiz_path.write_text(quiz)

needle = """const gemini=getGenerativeModel(ai,{model:'gemini-3.5-flash-lite',generationConfig:{responseMimeType:'application/json',temperature:0.2,maxOutputTokens:7000}});"""
replacement = needle + "\nconst chatGemini=getGenerativeModel(ai,{model:'gemini-3.5-flash-lite',generationConfig:{temperature:0.35,maxOutputTokens:1200}});"
if needle in ai and "const chatGemini=" not in ai:
    ai = ai.replace(needle, replacement, 1)

old = """export async function askEduwills(prompt:string,history:string[]=[]){const conversation=[...history.slice(-8),`Learner: ${prompt}`].join('\\n');const instruction=`You are EDUWILLS AI, a study assistant for learners. Answer the learner directly and accurately. If the learner asks about a specific book, do not invent plot details; clearly say when you are unsure. Keep answers concise but useful. Plain readable text only; no code, JSON, XML, Markdown code fences, API syntax, variable names, function calls, or internal system/provider terminology. Conversation:\\n${conversation}`;try{return plain(await worker(instruction,20000,'chat'))}catch{try{const r=await geminiFallback(instruction);return plain(r.response.text())}catch{return 'EDUWILLS AI is temporarily busy. Please try again in a moment.'}}}"""
new = """export async function askEduwills(prompt:string,history:string[]=[]){const conversation=[...history.slice(-8),`Learner: ${prompt}`].join('\\n');const instruction=`You are EDUWILLS AI, a study assistant for learners. Answer the learner directly and accurately. If the learner asks about a specific book, do not invent plot details; clearly say when you are unsure. Keep answers concise but useful. Plain readable text only; no code, JSON, XML, Markdown code fences, API syntax, variable names, function calls, or internal system/provider terminology. Conversation:\\n${conversation}`;try{const result=await chatGemini.generateContent(instruction);return plain(result.response.text())}catch{try{return plain(await worker(instruction,12000,'chat'))}catch{return 'EDUWILLS AI is temporarily busy. Please try again in a moment.'}}}"""
if old in ai:
    ai = ai.replace(old, new, 1)

ai = ai.replace("let attempts=0;while(accepted.length<requested&&attempts<4){", "let attempts=0;while(accepted.length<requested&&attempts<3){", 1)
ai = ai.replace("const batch=Math.min(8,remaining);", "const batch=Math.min(20,remaining);", 1)
ai = ai.replace("const selected=books.length?books:[{title:'Selected book',author:'Unknown'}];", "if(!books.length)throw new Error('NO_BOOK_SELECTED');const selected=books;", 1)

ai_path.write_text(ai)

q = quiz_path.read_text()
if '\\<main' in q or '\\:px-' in q:
    raise SystemExit('Quiz page contains escaped JSX/Tailwind punctuation')
if 'NO_BOOK_SELECTED' not in ai_path.read_text():
    raise SystemExit('Quiz empty-book guard missing')
if 'chatGemini=' not in ai_path.read_text():
    raise SystemExit('Dedicated chat Gemini model missing')
print('Quiz and EDUWILLS AI reliability patch applied successfully.')
