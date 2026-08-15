'use client';

import { BookOpen, Clock3, Home, LogOut, Menu, UserRound, WalletCards, X, Sparkles, ArrowRight } from 'lucide-react';
import { useState } from 'react';

const nav = [
  { name: 'Quiz', icon: Sparkles, active: true },
  { name: 'History', icon: Clock3 },
  { name: 'Activation', icon: WalletCards },
  { name: 'Personal', icon: UserRound },
];

export default function DashboardPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><BookOpen size={20}/></div><div><div className="font-black tracking-tight">EDUWILLS</div><div className="hidden text-[9px] font-bold uppercase tracking-[.18em] text-slate-400 sm:block">Book Learner</div></div></div>
          <button className="rounded-xl border border-slate-200 p-2 md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={20}/> : <Menu size={20}/>}</button>
          <div className="hidden items-center gap-4 md:flex"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-eduBlue">Book Learner</span><div className="h-9 w-9 rounded-full bg-ink text-center text-sm font-black leading-9 text-white">G</div></div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <aside className={`${mobileOpen ? 'fixed inset-x-5 top-20 z-40 block' : 'hidden'} w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-soft md:static md:block md:w-60 md:self-start`}>
          <div className="space-y-1">{nav.map(({name, icon: Icon, active}) => <a key={name} href={name === 'Quiz' ? '/dashboard' : '#'} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${active ? 'bg-ink text-white' : 'text-slate-500 hover:bg-paper'}`}><Icon size={18}/>{name}</a>)}</div>
          <div className="my-4 border-t border-slate-100"/><a href="/" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500"><LogOut size={18}/>Log out</a>
        </aside>
        <section className="min-w-0 flex-1">
          <div className="rounded-[2rem] bg-ink p-7 text-white sm:p-10"><div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200"><Sparkles size={12}/> AI Book Quiz</div><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">What are you reading?</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Search for a book and EDUWILLS AI will prepare a quiz from the available information about it.</p></div><a href="#search" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-ink">Start a quiz <ArrowRight size={17}/></a></div></div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_310px]">
            <div id="search" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Find a book</h2><p className="mt-1 text-sm text-slate-500">Enter a title, author or both.</p></div><BookOpen className="text-eduBlue"/></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><input className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-paper px-4 py-3.5 text-sm outline-none focus:border-eduBlue" placeholder="e.g. Things Fall Apart"/><button className="rounded-xl bg-eduBlue px-6 py-3.5 text-sm font-black text-white">Search & generate</button></div><div className="mt-7 rounded-2xl bg-blue-50 p-5"><div className="text-xs font-black uppercase tracking-wider text-eduBlue">How it works</div><p className="mt-2 text-sm leading-6 text-slate-600">EDUWILLS will identify the book and author, then prepare questions suitable for your selected learning experience.</p></div></div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><h2 className="font-black">Book slots</h2><span className="text-xs font-bold text-slate-400">0 / 5</span></div><p className="mt-2 text-sm leading-6 text-slate-500">Your five permanent book spaces will appear here. Books added to a slot are retained.</p><div className="mt-5 space-y-2">{[1,2,3,4,5].map((n) => <div key={n} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 p-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-paper text-xs font-black text-slate-400">{n}</div><span className="text-xs font-bold text-slate-400">Empty book slot</span></div>)}</div></div>
          </div>
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Recent quizzes</h2><p className="mt-1 text-sm text-slate-500">Your latest practice sessions will appear here.</p></div><Clock3 className="text-slate-300"/></div><div className="mt-7 rounded-2xl border border-dashed border-slate-200 p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-paper text-slate-300"><Home size={21}/></div><p className="mt-3 text-sm font-bold text-slate-500">No quizzes yet</p><p className="mt-1 text-xs text-slate-400">Search for your first book above to begin.</p></div></div>
        </section>
      </div>
    </main>
  );
}
