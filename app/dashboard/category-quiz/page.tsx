'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, Sparkles } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const SUBJECTS = {
  primary: ['English Studies', 'Mathematics', 'Basic Science', 'Social Studies', 'Civic Education'],
  junior: ['English Studies', 'Mathematics', 'Basic Science', 'Basic Technology', 'Social Studies', 'Civic Education', 'Computer Studies'],
  senior: ['English Language', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government', 'Literature in English', 'Civic Education', 'Computer Studies'],
} as const;
const EXAMS: Record<string, string[]> = {
  primary: ['Normal Test'],
  junior: ['BECE', 'NECO', 'Normal Test'],
  senior: ['WAEC', 'JAMB', 'NECO', 'Normal Test'],
};

function categoryId(value: string | null) {
  const v = String(value || '').toLowerCase();
  if (v === 'primary') return 'primary';
  if (v === 'junior' || v === 'jss' || v === 'junior-secondary') return 'junior';
  return 'senior';
}

export default function CategoryQuizPage() {
  const [category, setCategory] = useState('senior');
  const [mode, setMode] = useState('Normal Test');
  const [subject, setSubject] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = categoryId(params.get('category'));
    const requestedMode = params.get('mode') || 'normal-test';
    const label = requestedMode.split('-').map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
    setCategory(id); setMode(EXAMS[id].find((x) => x.toLowerCase().replace(/\s+/g, '-') === requestedMode) || label);
    setSubject(SUBJECTS[id][0]);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.replace(`${BASE}/login/`); return; }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const d = snap.data() || {};
        const values = [
          ...(Array.isArray(d.categories) ? d.categories : []),
          ...(Array.isArray(d.educationLevels) ? d.educationLevels : []),
          ...(Array.isArray(d.schoolLevels) ? d.schoolLevels : []),
          d.category, d.educationLevel, d.schoolLevel, d.activeCategory, d.activeCategoryId,
        ].map((x) => String(x || '').toLowerCase());
        setAllowed(values.some((v) => v === id || v.includes(id)));
      } catch { setAllowed(false); }
      finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  const subjects = useMemo(() => SUBJECTS[category as keyof typeof SUBJECTS] || SUBJECTS.senior, [category]);

  function begin() {
    if (!subject) { setMessage('Please select a subject first.'); return; }
    const params = new URLSearchParams({ category, mode, subject });
    window.location.assign(`${BASE}/dashboard/category-quiz/test/?${params.toString()}`);
  }

  if (loading) return <main className="min-h-screen bg-paper p-8 text-center font-bold text-slate-500">Loading quiz setup…</main>;
  if (!allowed) return <main className="min-h-screen bg-paper p-6"><div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-7 text-amber-900"><h1 className="text-xl font-black">Category not assigned</h1><p className="mt-2 text-sm font-medium">This learning category is not currently assigned to your account.</p><a href={`${BASE}/dashboard/personal/`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-900 px-4 py-3 text-sm font-black text-white">Switch category <ArrowRight size={16}/></a></div></main>;

  return <main className="min-h-screen bg-paper pb-12 text-ink">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8"><a href={`${BASE}/dashboard/category/?category=${category}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black"><ArrowLeft size={17}/> Category</a><span className="inline-flex items-center gap-2 font-black"><BookOpen size={18}/> EDUWILLS</span></div></header>
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white sm:p-10"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200"><GraduationCap size={13}/> {category === 'senior' ? 'Senior Secondary' : category === 'junior' ? 'Junior Secondary' : 'Primary'}</div><h1 className="mt-4 text-3xl font-black sm:text-4xl">Build your {mode} quiz</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Choose a subject and EDUWILLS will prepare a focused test using the selected Nigerian learning or examination framework.</p></section>
      <section className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">1. Subject</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{subjects.map((s) => <button key={s} type="button" onClick={() => setSubject(s)} className={`rounded-2xl border p-4 text-left font-black transition ${subject === s ? 'border-cyan-500 bg-cyan-50 text-cyan-950 shadow-sm' : 'border-slate-200 hover:border-cyan-300'}`}><span className="flex items-center justify-between gap-3">{s}{subject === s && <CheckCircle2 className="text-cyan-600" size={19}/>}</span></button>)}</div>
        <div className="mt-8 rounded-2xl bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">2. Framework</p><p className="mt-2 text-lg font-black">{mode}</p><p className="mt-1 text-xs font-bold text-slate-400">The selected examination framework will guide question difficulty and coverage.</p></div>
        {message && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{message}</p>}
        <button type="button" onClick={begin} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-4 text-sm font-black text-white shadow-lg">Continue to test setup <Sparkles size={17}/></button>
      </section>
    </div>
  </main>;
}
