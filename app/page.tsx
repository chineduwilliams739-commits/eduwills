'use client';

import { useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, GraduationCap, Menu, Sparkles, X } from 'lucide-react';

const categories = [
  { name: 'Senior Secondary', price: '₦3,000', detail: 'WAEC · JAMB · NECO · Normal Test', locked: true },
  { name: 'Junior Secondary', price: '₦3,000', detail: 'BECE · NECO · Normal Test', locked: true },
  { name: 'Primary', price: '₦2,000', detail: 'Primary learning & tests', locked: true },
  { name: 'Book Learner', price: '₦4,000', detail: 'AI-powered book quizzes', active: true },
];

export default function HomePage() {
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden bg-paper">
      <nav className="relative z-30 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white shadow-soft">
            <GraduationCap size={23} strokeWidth={2.4} />
          </div>
          <div>
            <div className="text-lg font-black tracking-tight text-ink">EDUWILLS</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Learn. Practice. Excel.</div>
          </div>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#how" className="text-sm font-semibold text-slate-600 hover:text-ink">How it works</a>
          <a href="#pricing" className="text-sm font-semibold text-slate-600 hover:text-ink">Pricing</a>
          <a href="#about" className="text-sm font-semibold text-slate-600 hover:text-ink">About</a>
          <button className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-ink shadow-sm">Login</button>
          <button className="rounded-xl bg-eduBlue px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200">Get started</button>
        </div>

        <button aria-label="Open menu" onClick={() => setOpen(!open)} className="rounded-xl border border-slate-200 bg-white p-2.5 md:hidden">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="absolute left-4 right-4 top-20 z-40 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:hidden">
          <div className="grid gap-2">
            {['How it works', 'Pricing', 'About'].map((item) => <a key={item} href={`#${item === 'How it works' ? 'how' : item.toLowerCase()}`} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-semibold text-ink hover:bg-paper">{item}</a>)}
            <button className="mt-2 rounded-xl border border-slate-200 px-4 py-3 font-bold">Login</button>
            <button className="rounded-xl bg-eduBlue px-4 py-3 font-bold text-white">Get started</button>
          </div>
        </div>
      )}

      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-12 sm:px-8 lg:px-10 lg:pb-28 lg:pt-20">
        <div className="pointer-events-none absolute -right-36 -top-40 h-[520px] w-[520px] rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-44 top-48 h-[420px] w-[420px] rounded-full bg-blue-100/60 blur-3xl" />

        <div className="relative grid items-center gap-14 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-bold text-eduBlue shadow-sm">
              <Sparkles size={14} /> AI-powered learning for students
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.045em] text-ink sm:text-6xl lg:text-7xl">
              Turn every book into a <span className="text-eduBlue">smart quiz.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              EDUWILLS helps learners understand, practice and test themselves with intelligent quizzes built around the books they study.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-6 py-4 font-bold text-white shadow-xl shadow-slate-200 hover:-translate-y-0.5">
                Explore Book Learner <ArrowRight size={18} />
              </button>
              <button className="rounded-2xl border border-slate-200 bg-white px-6 py-4 font-bold text-ink">See how it works</button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
              {['AI-generated questions', 'Book-focused practice', 'Built for Nigerian learners'].map((item) => <span key={item} className="inline-flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={12} /></span>{item}</span>)}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[470px]">
            <div className="absolute -right-5 top-10 hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-soft sm:block">
              <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-eduGold"><Sparkles size={19} /></div><div><div className="text-xs font-bold text-slate-400">AI GENERATED</div><div className="text-sm font-black text-ink">12 questions ready</div></div></div>
            </div>
            <div className="rounded-[2rem] border border-white bg-white p-4 shadow-soft">
              <div className="rounded-[1.5rem] bg-ink p-6 text-white">
                <div className="flex items-center justify-between"><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200">Book Learner</span><BookOpen size={20} className="text-cyan-200" /></div>
                <div className="mt-10 text-xs font-bold uppercase tracking-widest text-slate-400">Now studying</div>
                <div className="mt-2 text-2xl font-black">Your next great read</div>
                <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur"><div className="h-2 w-28 rounded-full bg-cyan-300" /><div className="mt-3 text-sm font-bold">Choose a book to begin</div><div className="mt-1 text-xs text-slate-400">EDUWILLS AI will build your quiz.</div></div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-3 pt-4 text-center"><div><div className="text-lg font-black text-ink">AI</div><div className="text-[10px] font-bold uppercase text-slate-400">Powered</div></div><div><div className="text-lg font-black text-ink">5</div><div className="text-[10px] font-bold uppercase text-slate-400">Book slots</div></div><div><div className="text-lg font-black text-ink">∞</div><div className="text-[10px] font-bold uppercase text-slate-400">Practice</div></div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-slate-200/70 bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-eduBlue">Simple by design</p><h2 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">A smarter way to study.</h2><p className="mt-4 leading-7 text-slate-600">Search for what you are reading, let EDUWILLS build your practice set, then use your history to understand your progress.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[['01', 'Find your book', 'Search for the title you want to study. EDUWILLS identifies the book and its author.'], ['02', 'Generate a quiz', 'Our AI turns accessible book knowledge into thoughtful practice questions.'], ['03', 'Learn from your results', 'Review scores and quiz history so every practice session moves you forward.']].map(([num, title, text]) => <article key={num} className="rounded-3xl border border-slate-200 bg-paper p-7"><div className="text-xs font-black tracking-widest text-eduBlue">{num}</div><h3 className="mt-12 text-xl font-black text-ink">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10">
        <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-eduBlue">Learning plans</p><h2 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">Choose your learning path.</h2><p className="mx-auto mt-4 max-w-2xl text-slate-600">Book Learner is available now. Other learner categories are being prepared for future releases.</p></div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-2">
          {categories.map((category) => <article key={category.name} className={`relative rounded-3xl border p-6 ${category.active ? 'border-blue-200 bg-white shadow-soft' : 'border-slate-200 bg-white/70'}`}>
            {category.active && <span className="absolute right-5 top-5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600">Available now</span>}
            {category.locked && <span className="absolute right-5 top-5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">Coming soon</span>}
            <div className="pr-24"><h3 className="text-lg font-black text-ink">{category.name}</h3><p className="mt-1 text-sm text-slate-500">{category.detail}</p></div>
            <div className="mt-7 flex items-end justify-between"><div><div className="text-2xl font-black text-ink">{category.price}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Activation</div></div><button disabled={category.locked} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${category.active ? 'bg-eduBlue text-white' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}>{category.active ? 'Choose plan' : 'Locked'}</button></div>
          </article>)}
        </div>
      </section>

      <section id="about" className="bg-ink py-16 text-white"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10"><div><div className="text-xl font-black">EDUWILLS</div><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">A learning platform designed to make revision more active, personal and intelligent.</p></div><div className="text-sm text-slate-400">© 2026 EDUWILLS. Built for learning.</div></div></section>
    </main>
  );
}
