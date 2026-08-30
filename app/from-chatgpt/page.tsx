import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EDUWILLS — Study Smarter with AI-Powered Quizzes',
  description: 'Turn the books and topics you study into focused AI-powered quizzes for WAEC, JAMB, NECO and everyday revision.',
  alternates: { canonical: 'https://chineduwilliams739-commits.github.io/eduwills/from-chatgpt/' },
  openGraph: {
    title: 'EDUWILLS — Study Smarter with AI-Powered Quizzes',
    description: 'Turn what you study into focused quizzes and practise with EDUWILLS.',
    url: 'https://chineduwilliams739-commits.github.io/eduwills/from-chatgpt/',
    siteName: 'EDUWILLS', type: 'website', locale: 'en_NG',
  },
};

const base = '/eduwills';

const features = [
  ['📚', 'Quiz from your books', 'Search for a book or topic and turn what you are studying into focused practice questions.'],
  ['🎯', 'Prepare for exams', 'Build a stronger revision routine around WAEC, JAMB, NECO and school assessments.'],
  ['🧠', 'Practise active recall', 'Test what you remember instead of only rereading. Find weak areas and revise them.'],
];

const steps = [
  ['01', 'Choose what to study', 'Pick a book, subject or topic you want to practise.'],
  ['02', 'Let EDUWILLS build your quiz', 'Get questions designed around the material you want to revise.'],
  ['03', 'Answer, learn and improve', 'Test yourself, review your performance and keep practising.'],
];

export default function FromChatGPTPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href={`${base}/`} className="text-xl font-black tracking-tight">EDUWILLS<span className="text-eduBlue">.</span></a>
          <a href={`${base}/signup/`} className="rounded-xl bg-eduBlue px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/20">Start learning</a>
        </div>
      </header>

      <section className="relative border-b border-slate-200 bg-gradient-to-b from-blue-50 via-white to-white px-5 pb-16 pt-14 sm:pb-24 sm:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-black text-eduBlue shadow-sm">✨ Found EDUWILLS through ChatGPT?</div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Study smarter. Practise with AI. <span className="text-eduBlue">Get ready.</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">Turn the books and topics you already study into practice quizzes. EDUWILLS helps you test your knowledge, spot gaps and build a better revision habit.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={`${base}/signup/`} className="inline-flex items-center justify-center rounded-xl bg-eduBlue px-6 py-3.5 font-black text-white shadow-xl shadow-blue-500/20 transition hover:-translate-y-0.5">Try EDUWILLS free →</a>
              <a href={`${base}/#categories`} className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-black transition hover:bg-slate-50">Explore subjects & books</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500"><span>✓ Book-based quizzes</span><span>✓ Exam revision</span><span>✓ Instant practice</span></div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px] px-2 pb-2 pt-2 sm:px-4 lg:min-h-[570px]">
            <div className="pointer-events-none absolute inset-4 rounded-[2.5rem] bg-blue-200/40 blur-2xl" />
            <div className="relative grid gap-5 sm:grid-cols-2 sm:items-start lg:block lg:min-h-[550px]">
              <div className="relative z-0 rounded-[1.5rem] border-2 border-indigo-300 bg-indigo-50 p-5 shadow-xl sm:translate-y-8 sm:-rotate-3 lg:absolute lg:left-0 lg:top-10 lg:w-56">
                <div className="flex items-center justify-between"><span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">JAMB CBT</span><span className="text-xl">🎯</span></div>
                <p className="mt-5 text-sm font-black text-slate-900">JAMB Mock Test</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Timed UTME-style practice with objective questions.</p>
                <div className="mt-4 h-2.5 rounded-full bg-indigo-200"><div className="h-full w-[72%] rounded-full bg-indigo-600" /></div>
                <p className="mt-2 text-[10px] font-black text-indigo-700">Question 36 of 50</p>
              </div>

              <div className="relative z-0 rounded-[1.5rem] border-2 border-amber-300 bg-amber-50 p-5 shadow-xl sm:translate-y-8 sm:rotate-3 lg:absolute lg:right-0 lg:top-44 lg:w-56">
                <div className="flex items-center justify-between"><span className="rounded-full bg-amber-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">BECE</span><span className="text-xl">📘</span></div>
                <p className="mt-5 text-sm font-black text-slate-900">BECE Practice</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Junior Secondary revision for subjects and school assessments.</p>
                <div className="mt-4 flex gap-1.5"><span className="h-2.5 flex-1 rounded-full bg-amber-400" /><span className="h-2.5 flex-1 rounded-full bg-amber-400" /><span className="h-2.5 flex-1 rounded-full bg-slate-200" /></div>
                <p className="mt-2 text-[10px] font-black text-amber-700">Revision progress · 66%</p>
              </div>

              <div className="relative z-10 mx-auto w-full max-w-[390px] rounded-[2rem] border-2 border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:col-span-2 sm:mt-0 lg:absolute lg:left-1/2 lg:top-20 lg:w-[350px] lg:-translate-x-1/2 lg:p-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-eduBlue">Practice quiz</p><p className="mt-1 text-sm font-black">Literature • Question 1 of 10</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-600">AI Quiz</span></div>
                <p className="mt-5 text-lg font-black leading-7">Who wrote <em>Things Fall Apart</em>?</p>
                <div className="mt-4 space-y-2">{['Chinua Achebe', 'Wole Soyinka', 'Chimamanda Ngozi Adichie', 'Ben Okri'].map((answer, i) => <div key={answer} className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-bold ${i === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-slate-50 text-slate-600'}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-black shadow-sm">{String.fromCharCode(65 + i)}</span><span className="min-w-0 break-words">{answer}</span>{i === 0 && <span className="ml-auto shrink-0 text-xs font-black">✓</span>}</div>)}</div>
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><strong className="text-slate-700">Explanation:</strong> Chinua Achebe wrote the novel, first published in 1958.</div>
                <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400"><span>10 questions</span><span>Keep going →</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">Why students use it</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your study material. Your questions. Your practice.</h2><p className="mt-4 leading-7 text-slate-600">EDUWILLS is built to make revision more active and useful, whether you are preparing for an exam or simply trying to understand a book better.</p></div>
        <div className="mt-9 grid gap-5 md:grid-cols-3">{features.map(([icon, title, text]) => <article key={title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"><span className="text-2xl">{icon}</span><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-5 py-16 sm:py-20"><div className="mx-auto max-w-6xl"><div className="text-center"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">How it works</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Three simple steps to better practice.</h2></div><div className="mt-10 grid gap-5 md:grid-cols-3">{steps.map(([number, title, text]) => <article key={number} className="rounded-[1.75rem] border border-slate-200 bg-white p-6"><span className="text-sm font-black text-eduBlue">{number}</span><h3 className="mt-4 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div></div></section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20"><div className="rounded-[2rem] bg-ink px-7 py-10 text-white sm:px-12 sm:py-14"><div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Ready to practise?</p><h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Stop just reading. Start testing what you know.</h2><p className="mt-4 max-w-2xl leading-7 text-slate-300">Create your EDUWILLS account and start turning your study time into active practice.</p></div><a href={`${base}/signup/`} className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 font-black text-ink transition hover:-translate-y-0.5">Create your account →</a></div></div></section>

      <section className="mx-auto max-w-4xl px-5 pb-16 sm:pb-20"><h2 className="text-2xl font-black">Frequently asked questions</h2><div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5">{[['What can I practise?', 'You can use EDUWILLS for books, subjects and educational topics, including revision for WAEC, JAMB, NECO and school assessments.'], ['Do I need to know exactly what to search for?', 'No. Start with the book, subject or topic you want to study and follow the available options in EDUWILLS.'], ['Is EDUWILLS affiliated with WAEC, JAMB or NECO?', 'No. EDUWILLS is an independent study tool and is not affiliated with those examination bodies.']].map(([q, a]) => <details key={q} className="group py-5"><summary className="cursor-pointer list-none font-black">{q}<span className="float-right text-slate-400">+</span></summary><p className="mt-3 max-w-3xl leading-7 text-slate-600">{a}</p></details>)}</div></section>

      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">EDUWILLS is an independent study tool and is not affiliated with WAEC, JAMB or NECO.</footer>
    </main>
  );
}
