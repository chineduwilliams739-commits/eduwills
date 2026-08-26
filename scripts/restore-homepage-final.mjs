import fs from 'node:fs';

const path = 'app/page.tsx';
let page = fs.readFileSync(path, 'utf8');

const heroTitle = 'AI quiz generator for <span className="text-eduBlue">WAEC, JAMB & NECO.</span> Turn every book into a smart quiz.';
const heroCopy = 'EDUWILLS is an AI quiz generator for Nigerian students preparing for WAEC, JAMB, NECO and school tests. Turn the books you study into intelligent practice quizzes, review your answers and learn smarter.';

page = page.replace(/Turn every book into a <span className="text-eduBlue">smart quiz\.<\/span>/, heroTitle);
page = page.replace(/EDUWILLS helps learners understand, practice and test themselves with intelligent quizzes built around the books they study\./, heroCopy);

const marker = 'EDUWILLS_SEO_CONTENT_V1';
if (!page.includes(marker)) {
  const seo = `
    {/* ${marker}: restored visible homepage exam-prep content */}
    <section aria-labelledby="exam-prep" className="border-y border-slate-200/70 bg-white py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">Nigerian exam preparation</p>
          <h2 id="exam-prep" className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">Free WAEC, JAMB, NECO and book quiz practice</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">EDUWILLS is an AI quiz generator and study platform for Nigerian learners. Practise WAEC and NECO topics, prepare for JAMB and UTME-style tests, or turn a book into a personalised quiz and check what you remember.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <a href="/eduwills/study-guides/waec/" className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="text-lg font-black text-ink">WAEC practice questions</h3><p className="mt-2 text-sm leading-6 text-slate-600">Build exam confidence with focused WAEC revision and practice.</p></a>
          <a href="/eduwills/study-guides/jamb/" className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="text-lg font-black text-ink">JAMB & UTME practice</h3><p className="mt-2 text-sm leading-6 text-slate-600">Prepare for CBT-style JAMB and UTME practice with smart quizzes.</p></a>
          <a href="/eduwills/study-guides/neco/" className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="text-lg font-black text-ink">NECO exam preparation</h3><p className="mt-2 text-sm leading-6 text-slate-600">Revise NECO topics and practise questions before your examination.</p></a>
          <a href="/eduwills/study-guides/" className="rounded-3xl border border-slate-200 bg-paper p-6 hover:border-blue-200"><h3 className="text-lg font-black text-ink">Study Guides</h3><p className="mt-2 text-sm leading-6 text-slate-600">Explore practical study guides for Nigerian students and connect them to quiz practice.</p></a>
        </div>
        <div className="mt-8 rounded-3xl bg-slate-50 p-6">
          <h3 className="text-xl font-black text-ink">How the AI quiz generator works</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Search for a book, choose the verified author, select the number of questions and add your own instructions. EDUWILLS researches the selected book and generates a practice quiz designed around your request.</p>
        </div>
      </div>
    </section>
`;
  const anchor = '    <section id="pricing"';
  if (!page.includes(anchor)) throw new Error('Homepage pricing section not found');
  page = page.replace(anchor, seo + anchor);
}

fs.writeFileSync(path, page);
console.log('EDUWILLS homepage restored: exam-prep SEO content and keyword-focused hero are present.');
