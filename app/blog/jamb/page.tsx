import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'JAMB & UTME Practice Questions and Study Tips | EDUWILLS',
  description: 'Practical JAMB and UTME study tips, timed practice and revision strategies for Nigerian students.',
};

export default function JAMBBlog() {
  return <main className="min-h-screen bg-paper text-ink"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5"><Link href="/eduwills/" className="font-black">EDUWILLS</Link><Link href="/eduwills/study-guides/" className="font-black text-eduBlue">Study Guides</Link></div></header><article className="mx-auto max-w-4xl px-5 py-12"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">JAMB / UTME preparation</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">JAMB and UTME Practice: Build a Better Study Routine</h1><p className="mt-6 text-lg leading-8 text-slate-600">Build your JAMB preparation around regular practice, careful review and realistic timed sessions.</p><section className="mt-10 space-y-8"><div><h2 className="text-2xl font-black">Practise under time pressure</h2><p className="mt-3 leading-7 text-slate-600">As your preparation improves, use timed sessions to identify question types and topics that take you longest.</p></div><div><h2 className="text-2xl font-black">Review mistakes</h2><p className="mt-3 leading-7 text-slate-600">Keep a simple mistake log. Understanding why an answer was wrong helps you improve faster than simply repeating questions.</p></div><div><h2 className="text-2xl font-black">Mix reading with quizzes</h2><p className="mt-3 leading-7 text-slate-600">Use textbooks and class materials for learning, then test your recall with focused quizzes.</p></div></section><Link href="/eduwills/signup/" className="mt-12 inline-flex rounded-xl bg-ink px-6 py-3 font-black text-white">Practise with EDUWILLS →</Link></article><footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">EDUWILLS is independent and is not affiliated with JAMB.</footer></main>;
}
