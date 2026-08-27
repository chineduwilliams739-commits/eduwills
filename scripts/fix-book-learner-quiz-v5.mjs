import fs from 'node:fs';

const ai='lib/quizAiClient.ts';
let a=fs.readFileSync(ai,'utf8');

// Strengthen book grounding: the model must not infer character facts from names or unsupported summaries.
const oldPrompt="Never invent unsupported facts or quotations. Use exactly four plausible options and one correct answer. Vary facts and avoid duplicates.";
const newPrompt="Never invent unsupported facts or quotations. For characters, never infer gender, pronouns, relationships, age, role, actions, or identity from a name alone; only state those facts when the supplied evidence or verified book knowledge explicitly supports them. If a detail is not established by the evidence, do not turn it into a question or claim. Prefer concrete events and character actions that are directly supported by the exact-book evidence. Use exactly four plausible options and one correct answer. Vary facts and avoid duplicates.";
if(a.includes(oldPrompt)) a=a.replace(oldPrompt,newPrompt);

const oldResearch="const urls=[`https://www.googleapis.com/books/v1/volumes?q=intitle:${t}+inauthor:${a}&maxResults=20`,`https://openlibrary.org/search.json?title=${t}&author=${a}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`];";
const newResearch="const urls=[`https://www.googleapis.com/books/v1/volumes?q=intitle:${t}+inauthor:${a}&maxResults=40`,`https://openlibrary.org/search.json?title=${t}&author=${a}&limit=50&fields=key,title,author_name,first_sentence,subject,description,first_publish_year,publisher,edition_key` ,`https://www.loc.gov/books/?q=${t}&fo=json&c=20`];";
if(a.includes(oldResearch)) a=a.replace(oldResearch,newResearch);

const oldGoogle="if(v.description)chunks.push(`Book ${b.title} by ${b.author}: ${v.description}`);if(v.publishedDate)chunks.push(`Publication: ${v.publishedDate}; publisher: ${v.publisher||'unknown'}.`)";
const newGoogle="if(v.description)chunks.push(`VERIFIED BOOK DESCRIPTION — ${b.title} by ${b.author}: ${v.description}`);if(Array.isArray(v.authors)&&v.authors.length)chunks.push(`VERIFIED BOOK AUTHORS — ${v.authors.join(', ')}`);if(v.publishedDate)chunks.push(`VERIFIED PUBLICATION — ${v.publishedDate}; publisher: ${v.publisher||'unknown'}.`);if(v.categories?.length)chunks.push(`VERIFIED SUBJECTS — ${v.categories.slice(0,20).join(', ')}`)";
if(a.includes(oldGoogle)) a=a.replace(oldGoogle,newGoogle);

const oldOpen="if(x.first_sentence)chunks.push(`Book evidence: ${(x.first_sentence||[]).join(' ')}`);if(x.subject)chunks.push(`Book subjects: ${(x.subject||[]).slice(0,60).join(', ')}`);if(x.description)chunks.push(`Book description: ${typeof x.description==='string'?x.description:JSON.stringify(x.description)}`)";
const newOpen="if(x.first_sentence)chunks.push(`VERIFIED BOOK EVIDENCE — ${(x.first_sentence||[]).join(' ')}`);if(x.subject)chunks.push(`VERIFIED BOOK SUBJECTS — ${(x.subject||[]).slice(0,60).join(', ')}`);if(x.description)chunks.push(`VERIFIED BOOK DESCRIPTION — ${typeof x.description==='string'?x.description:JSON.stringify(x.description)}`);if(Array.isArray(x.author_name)&&x.author_name.length)chunks.push(`VERIFIED BOOK AUTHORS — ${x.author_name.join(', ')}`)";
if(a.includes(oldOpen)) a=a.replace(oldOpen,newOpen);

const oldLoc="for(const x of d.docs||[]){if(x.first_sentence)chunks.push(`Book evidence: ${(x.first_sentence||[]).join(' ')}`);if(x.subject)chunks.push(`Book subjects: ${(x.subject||[]).slice(0,60).join(', ')}`);if(x.description)chunks.push(`Book description: ${typeof x.description==='string'?x.description:JSON.stringify(x.description)}`)}}}";
const newLoc="for(const x of d.results||[]){const text=typeof x.description==='string'?x.description:(Array.isArray(x.description)?x.description.join(' '):'');if(text)chunks.push(`LIBRARY OF CONGRESS EVIDENCE — ${text}`);if(x.title)chunks.push(`LIBRARY OF CONGRESS TITLE — ${x.title}`);if(x.date)chunks.push(`LIBRARY OF CONGRESS DATE — ${x.date}`)}}}";
if(a.includes(oldLoc)) a=a.replace(oldLoc,newLoc);

// Make research itself explicit about evidence quality and prevent the model from treating a generic fallback as book facts.
a=a.replace("const result=chunks.join('\\n').slice(0,90000)||`Research the exact book ${books.map(b=>`${b.title} by ${b.author}`).join('; ')} and do not invent unsupported facts.`;","const result=(chunks.length?`EXACT-BOOK RESEARCH EVIDENCE. Treat this as source material, not permission to guess.\\n${chunks.join('\\n')}`:`No reliable external book evidence was returned for ${books.map(b=>`${b.title} by ${b.author}`).join('; ')}. Do not invent plot or character facts.`).slice(0,90000);");
fs.writeFileSync(ai,a);

const page='app/dashboard/quiz/page.tsx';
let s=fs.readFileSync(page,'utf8');
const start=s.indexOf('  if (setup && qs.length) {');
const end=s.indexOf('\n  return <main className="min-h-screen bg-gradient-to-b',start);
if(start<0||end<0) throw new Error('Quiz question screen boundaries not found');
const block=`  if (setup && qs.length) {
    const q = qs[idx];
    const mm = seconds === null ? '--' : String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = seconds === null ? '--' : String(seconds % 60).padStart(2, '0');
    const selectedAnswer = answers[idx];
    const progress = Math.round(((idx + 1) / Math.max(1, qs.length)) * 100);
    const answered = answers.filter((x) => x !== undefined).length;
    return <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600">EDUWILLS • QUIZ STUDIO</p><p className="truncate text-sm font-black text-slate-800">{setup.books.map((b) => b.title).join(' • ')}</p></div>
            <div className="flex shrink-0 items-center gap-2"><div className={\`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black shadow-sm \${seconds !== null && seconds <= 60 ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-700'}\`}><Clock3 size={16}/>{mm}:{ss}</div><button onClick={() => setExitQuiz(true)} className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"><X size={15}/><span className="ml-1 hidden sm:inline">Exit</span></button></div>
          </div>
          <div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-400 transition-all duration-500" style={{ width: \\`\${progress}%\\` }}/></div><span className="text-xs font-black text-slate-500">{progress}%</span></div>
        </div>
      </header>
      {timeWarning && <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6"><div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">⏰ <span>{timeWarning}</span></div></div>}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Question {idx + 1}</p><p className="mt-1 text-xs font-bold text-slate-400">of {qs.length} • {answered} answered</p></div><div className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">{progress}% complete</div></div>
        {quizError && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{quizError}</div>}
        <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
          <div className="bg-gradient-to-r from-indigo-700 via-violet-600 to-cyan-600 p-6 text-white sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">EDUWILLS AI</p><p className="mt-1 text-sm font-black text-white/90">Knowledge Challenge</p></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-lg font-black">{String.fromCharCode(65 + (selectedAnswer ?? 0))}</div></div></div>
          <div className="p-6 sm:p-9"><h1 className="text-xl font-black leading-8 tracking-tight text-slate-950 sm:text-2xl sm:leading-9">{q.question}</h1><div className="mt-7 grid gap-3">{q.options.map((o, i) => <button type="button" key={i} onClick={() => choose(i)} className={\`group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 sm:p-5 \${selectedAnswer === i ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-md'}\`}><span className={\`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black transition \${selectedAnswer === i ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'}\`}>{String.fromCharCode(65 + i)}</span><span className="text-sm font-bold leading-6 text-slate-800 sm:text-base">{o}</span>{selectedAnswer === i && <CheckCircle2 className="ml-auto shrink-0 text-indigo-600" size={21}/>}</button>)}</div></div>
          <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:px-9"><div className="overflow-x-auto pb-1"><div className="flex w-max min-w-full gap-2">{qs.map((_, i) => <button key={i} onClick={() => setIdx(i)} aria-label={\`Go to question \${i + 1}\`} className={\`grid h-9 min-w-9 place-items-center rounded-xl border px-3 text-xs font-black transition \${i === idx ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' : answers[i] !== undefined ? 'border-slate-300 bg-white text-slate-700' : 'border-slate-200 bg-white text-slate-400 hover:border-indigo-300'}\`}>{i + 1}</button>)}</div></div></div>
        </section>
        <div className="mt-5 flex gap-3"><button disabled={idx === 0} onClick={() => setIdx((v) => Math.max(0, v - 1))} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black shadow-sm transition hover:bg-slate-50 disabled:opacity-40">← Back</button>{idx === qs.length - 1 ? <button disabled={selectedAnswer === undefined} onClick={() => setConfirmSubmit(true)} className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 disabled:opacity-40">Submit quiz ✓</button> : <button disabled={selectedAnswer === undefined} onClick={() => setIdx((v) => v + 1)} className="flex-1 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-40">Next question →</button>}</div>
      </div>
      {confirmSubmit && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm"><div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl"><div className="bg-gradient-to-r from-indigo-600 to-cyan-500 p-7 text-white"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><CheckCircle2/></div><h2 className="mt-4 text-2xl font-black">Ready to submit?</h2><p className="mt-1 text-sm text-white/80">Your answers will be graded and your Test Overview will appear next.</p></div><div className="p-6"><div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">{answered} of {qs.length} questions answered.</div><div className="mt-5 flex gap-3"><button onClick={() => setConfirmSubmit(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-black">Keep working</button><button onClick={() => submitQuiz(false)} className="flex-1 rounded-xl bg-slate-950 px-4 py-3 font-black text-white">Submit quiz</button></div></div></div></div>}
      {exitQuiz && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm"><div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl"><div className="bg-gradient-to-br from-red-600 via-rose-600 to-indigo-600 p-7 text-white"><div className="flex items-center justify-between"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><XCircle size={30}/></div><button onClick={() => setExitQuiz(false)} className="rounded-full bg-white/10 p-2"><X size={19}/></button></div><h2 className="mt-5 text-2xl font-black">Leave this quiz?</h2><p className="mt-2 text-sm leading-6 text-white/85">Your progress is saved on this device. Exiting now will abandon this attempt and it will not be graded.</p></div><div className="p-6"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">⚠️ You have {answered} answered questions.</div><div className="mt-5 flex gap-3"><button onClick={() => setExitQuiz(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-black">Continue quiz</button><button onClick={resetQuiz} className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-black text-white">Exit and discard</button></div></div></div></div>}
    </main>;
  }
`;
s=s.slice(0,start)+block+s.slice(end);
fs.writeFileSync(page,s);
console.log('Book Learner v5 applied: professional Quiz Studio interface and stronger exact-book grounding.');
