'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GraduationCap, Sparkles } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const CATEGORIES = {
  primary: {
    label: 'Primary',
    description: 'Build strong foundations with age-appropriate practice and revision.',
    modes: ['Normal Test'],
  },
  junior: {
    label: 'Junior Secondary',
    description: 'Prepare for JSS learning, revision and examination practice.',
    modes: ['BECE', 'NECO', 'Normal Test'],
  },
  senior: {
    label: 'Senior Secondary',
    description: 'Prepare for senior-secondary subjects and major Nigerian examinations.',
    modes: ['WAEC', 'JAMB', 'NECO', 'Normal Test'],
  },
  book: {
    label: 'Book Learner',
    description: 'Generate quizzes directly from the books saved in your EDUWILLS library.',
    modes: ['Book Quiz'],
  },
} as const;

type CategoryId = keyof typeof CATEGORIES;

function normalizeCategory(value: string | null): CategoryId {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'primary') return 'primary';
  if (v === 'junior' || v === 'jss' || v === 'junior-secondary') return 'junior';
  if (v === 'senior' || v === 'sss' || v === 'senior-secondary') return 'senior';
  return 'book';
}

export default function CategoryHub() {
  const [category, setCategory] = useState<CategoryId>('book');
  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requested = normalizeCategory(new URLSearchParams(window.location.search).get('category'));
    setCategory(requested);
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) { window.location.replace(`${BASE}/login/`); return; }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const d = snap.data() || {};
        const values = [
          ...(Array.isArray(d.categories) ? d.categories : []),
          ...(Array.isArray(d.educationLevels) ? d.educationLevels : []),
          ...(Array.isArray(d.schoolLevels) ? d.schoolLevels : []),
          d.category, d.educationLevel, d.schoolLevel,
        ].map((x) => String(x || '').toLowerCase());
        const active = String(d.activeCategoryId || d.activeCategory || '').toLowerCase();
        const hasCategory = requested === 'book' || values.some((v) => v.includes(requested)) || active === requested;
        setAllowed(hasCategory);
      } catch { setAllowed(false); }
      finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  const config = CATEGORIES[category];
  const modeLinks = useMemo(() => config.modes.map((mode) => ({
    mode,
    href: `${BASE}/dashboard/quiz/?category=${category}&mode=${encodeURIComponent(mode.toLowerCase().replace(/\s+/g, '-'))}`,
  })), [category, config]);

  if (loading) return <main className="min-h-screen bg-paper p-8 text-center font-bold text-slate-500">Loading your learning category…</main>;

  return <main className="min-h-screen bg-paper pb-12 text-ink">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
      <a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black"><ArrowLeft size={17}/> Dashboard</a>
      <div className="inline-flex items-center gap-2 text-sm font-black"><BookOpen size={18}/> EDUWILLS</div>
    </div></header>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white shadow-2xl sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200"><GraduationCap size={13}/> Active learning category</div>
        <h1 className="mt-4 text-3xl font-black sm:text-5xl">{config.label}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{config.description}</p>
      </section>

      {!allowed ? <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900"><p className="font-black">This category is not assigned to your account.</p><p className="mt-1 text-sm font-medium">Return to Personal and select one of your assigned categories.</p><a href={`${BASE}/dashboard/personal/`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-900 px-4 py-3 text-sm font-black text-white">Switch category <ArrowRight size={16}/></a></section> : <>
        <section className="mt-7"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Quiz modes</p><h2 className="mt-1 text-2xl font-black">Choose your test</h2></div><Sparkles className="text-cyan-600" size={24}/></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{modeLinks.map(({ mode, href }) => <a key={mode} href={href} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><CheckCircle2 size={20}/></span><ArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-cyan-600" size={20}/></div><h3 className="mt-5 text-lg font-black">{mode}</h3><p className="mt-1 text-xs font-bold leading-5 text-slate-400">Open {config.label} {mode} quiz setup.</p></a>)}</div>
        </section>
        <div className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500">Your selected category is <span className="text-ink">{config.label}</span>. Category-specific subjects, examination modes and question generation will use this selection.</div>
      </>}
    </div>
  </main>;
}
