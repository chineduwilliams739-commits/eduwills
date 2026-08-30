import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EDUWILLS for Students — AI Quiz Practice from Your Books',
  description: 'Use EDUWILLS to turn the books and topics you study into focused AI-powered quizzes for WAEC, JAMB, NECO and everyday revision.',
  alternates: { canonical: 'https://chineduwilliams739-commits.github.io/eduwills/from-chatgpt/' },
  openGraph: {
    title: 'EDUWILLS for Students — AI Quiz Practice from Your Books',
    description: 'Turn what you study into focused quizzes and practise with EDUWILLS.',
    url: 'https://chineduwilliams739-commits.github.io/eduwills/from-chatgpt/',
    siteName: 'EDUWILLS', type: 'website', locale: 'en_NG',
  },
};

const base = '/eduwills';

export default function FromChatGPTPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <a href={`${base}/`} className="text-xl font-black">EDUWILLS</a>
          <a href={`${base}/signup/`} className="rounded-xl bg-eduBlue px-4 py-2.5 text-sm font-black text-white">Start learning</a>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-16 sm:pt-24">
        <p className="text-sm font-black uppercase tracking-[.2em] text-eduBlue">For students discovering EDUWILLS</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">Turn what you read into questions you can actually answer.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">EDUWILLS helps you practise from the books and topics you are studying. Generate focused quizzes, test your recall and use your mistakes to decide what to revise next.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`${base}/signup/`} className="rounded-xl bg-eduBlue px-6 py-3.5 font-black text-white">Create your account</a>
          <a href={`${base}/#categories`} className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-black">Explore study categories</a>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {[
            ['Book-based practice', 'Study a novel, textbook or set book and turn the material into practice questions.'],
            ['Exam preparation', 'Build a consistent revision routine for WAEC, JAMB, NECO and school assessments.'],
            ['Active recall', 'Use questions and explanations to find gaps instead of relying on rereading alone.'],
          ].map(([title, text]) => <article key={title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}
        </div>
        <section className="mt-10 rounded-[2rem] bg-ink p-7 text-white sm:p-9"><h2 className="text-2xl font-black">Start with the material you already study.</h2><p className="mt-3 max-w-2xl leading-7 text-slate-300">Choose a book or topic, practise what you know, review what you missed and keep improving.</p><a href={`${base}/signup/`} className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-ink">Try EDUWILLS →</a></section>
      </section>
      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">EDUWILLS is an independent study tool and is not affiliated with WAEC, JAMB or NECO.</footer>
    </main>
  );
}
