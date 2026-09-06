'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ArrowLeft, ArrowRight, Bot, GraduationCap, MessageCircle, Users, School, ShieldCheck, FileText, Search, Plus, BookOpen, Sparkles } from 'lucide-react';

const BASE = '/eduwills';
type Section = 'chat' | 'groups' | 'schools';

const sections: Array<{ id: Section; label: string; icon: typeof MessageCircle; title: string; description: string }> = [
  { id: 'chat', label: 'CHAT', icon: MessageCircle, title: 'Learn together', description: 'Ask academic questions, discuss lessons and share useful study resources with the EDUWILLS community.' },
  { id: 'groups', label: 'GROUPS', icon: Users, title: 'Study groups', description: 'Join focused study spaces for subjects, classes, exams and shared learning goals.' },
  { id: 'schools', label: 'SCHOOLS', icon: School, title: 'School communities', description: 'Connect school communities, classes and educators in a structured learning environment.' },
];

export default function CommunityHub() {
  const [section, setSection] = useState<Section>('chat');
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, u => {
    if (!u) { window.location.replace(`${BASE}/login/`); return; }
    setLoading(false);
  }), []);

  const current = sections.find(x => x.id === section) || sections[0];
  const Icon = current.icon;

  if (loading) return <main className="min-h-screen bg-paper p-8 text-center font-bold text-slate-500">Loading your community…</main>;

  return <main className="min-h-screen bg-paper pb-28 text-ink">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black shadow-sm"><ArrowLeft size={17}/> Dashboard</a>
        <div className="flex items-center gap-2 text-sm font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white"><BookOpen size={17}/></span> EDUWILLS</div>
      </div>
    </header>

    <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
      <section className="relative overflow-hidden rounded-[2rem] bg-ink p-7 text-white shadow-2xl sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"/>
        <div className="relative max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200"><GraduationCap size={13}/> EDUWILLS COMMUNITY</p>
          <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">Learn with people who are learning too.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">Chat, study in groups and connect school communities without mixing the three experiences together.</p>
        </div>
      </section>

      <section className="mt-7 grid gap-3 md:grid-cols-3">
        {sections.map(item => { const ItemIcon = item.icon; const active = section === item.id; return <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`rounded-2xl border p-5 text-left transition ${active ? 'border-cyan-300 bg-cyan-50 shadow-md' : 'border-slate-200 bg-white hover:border-cyan-200 hover:shadow-sm'}`}>
          <div className="flex items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-xl ${active ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-700'}`}><ItemIcon size={20}/></span><div><p className="text-[10px] font-black tracking-[.18em] text-slate-400">{item.label}</p><p className="mt-0.5 text-sm font-black">{item.title}</p></div></div>
          <p className="mt-4 text-xs leading-5 text-slate-500">{item.description}</p>
        </button>; })}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Icon size={21}/></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">{current.label}</p><h2 className="mt-1 text-2xl font-black">{current.title}</h2></div></div><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">{current.description}</p></div>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-black text-white"><Plus size={15}/> {section === 'chat' ? 'Start conversation' : section === 'groups' ? 'Create group' : 'Add school'}</button>
        </div>

        {section === 'chat' && <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_.8fr]"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-3"><Search size={18} className="text-slate-400"/><span className="text-sm font-bold text-slate-400">Search academic conversations…</span></div><div className="mt-5 space-y-3"><div className="rounded-2xl bg-white p-4"><p className="text-sm font-black">Academic discussion space</p><p className="mt-1 text-xs leading-5 text-slate-500">Ask questions and discuss school subjects with other learners.</p></div><div className="rounded-2xl bg-white p-4"><p className="text-sm font-black">Share learning resources</p><p className="mt-1 text-xs leading-5 text-slate-500">The community will support controlled file sharing for useful study materials.</p></div></div></div><div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5"><Bot className="text-cyan-700" size={22}/><p className="mt-3 text-sm font-black">AI community moderation</p><p className="mt-1 text-xs leading-5 text-slate-600">EDUWILLS will use moderation to keep academic conversations useful, respectful and safer for learners.</p></div></div>}

        {section === 'groups' && <div className="mt-7 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><Users className="text-cyan-700" size={21}/><p className="mt-3 text-sm font-black">Subject groups</p><p className="mt-1 text-xs leading-5 text-slate-500">Spaces for Mathematics, English, Sciences and other subjects.</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><Sparkles className="text-cyan-700" size={21}/><p className="mt-3 text-sm font-black">Exam groups</p><p className="mt-1 text-xs leading-5 text-slate-500">Focused communities for JAMB, WAEC, NECO and other preparation.</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><FileText className="text-cyan-700" size={21}/><p className="mt-3 text-sm font-black">Shared materials</p><p className="mt-1 text-xs leading-5 text-slate-500">Organized group resources and learning files can live alongside discussions.</p></div></div>}

        {section === 'schools' && <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_.8fr]"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><School className="text-cyan-700" size={22}/><p className="mt-3 text-sm font-black">School community hub</p><p className="mt-1 text-xs leading-5 text-slate-500">A structured space for schools, classes, educators and learners to communicate and share academic resources.</p><button type="button" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black shadow-sm">Explore school spaces <ArrowRight size={15}/></button></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-5"><ShieldCheck className="text-amber-700" size={22}/><p className="mt-3 text-sm font-black">Structured access</p><p className="mt-1 text-xs leading-5 text-slate-600">School features can be tied to verified school communities and appropriate roles as the institutional layer is expanded.</p></div></div>}
      </section>
    </div>

    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur"><div className="mx-auto flex max-w-4xl items-center justify-between gap-1">
      <a href={`${BASE}/dashboard/`} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black text-slate-500"><GraduationCap size={18}/>HOME</a>
      <button type="button" onClick={() => setSection('chat')} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black ${section === 'chat' ? 'bg-slate-100 text-ink' : 'text-slate-500'}`}><MessageCircle size={18}/>CHAT</button>
      <button type="button" onClick={() => setSection('groups')} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black ${section === 'groups' ? 'bg-slate-100 text-ink' : 'text-slate-500'}`}><Users size={18}/>GROUPS</button>
      <button type="button" onClick={() => setSection('schools')} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black ${section === 'schools' ? 'bg-slate-100 text-ink' : 'text-slate-500'}`}><School size={18}/>SCHOOLS</button>
      <a href={`${BASE}/dashboard/history/`} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black text-slate-500"><FileText size={18}/>RECORDS</a>
      <a href={`${BASE}/dashboard/personal/`} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-black text-slate-500"><Users size={18}/>PERSONAL</a>
    </div></nav>
  </main>;
}
