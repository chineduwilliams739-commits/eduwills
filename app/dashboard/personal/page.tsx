'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, UserRound, Phone, AtSign, ShieldCheck, BookOpen, LogOut, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const CATEGORY_LABELS: Record<string, string> = {
  primary: 'Primary', 'primary school': 'Primary', pupil: 'Primary', pupils: 'Primary',
  junior: 'Junior Secondary', 'junior secondary': 'Junior Secondary', jss: 'Junior Secondary',
  'junior secondary school': 'Junior Secondary', senior: 'Senior Secondary', sss: 'Senior Secondary',
  'senior secondary': 'Senior Secondary', 'senior secondary school': 'Senior Secondary',
  book: 'Book Learner', books: 'Book Learner', 'book learner': 'Book Learner',
};
const CATEGORY_IDS: Record<string, string> = {
  Primary: 'primary', 'Junior Secondary': 'junior', 'Senior Secondary': 'senior', 'Book Learner': 'book',
};
function expiryMs(v: any) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return Number(v.seconds) * 1000;
  const n = Date.parse(String(v));
  return Number.isFinite(n) ? n : 0;
}
function normaliseCategories(values: any[]): string[] {
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean).map(v => CATEGORY_LABELS[v.toLowerCase()] || v))];
}
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">{icon}{label}</div><div className="mt-2 break-words text-base font-black text-ink">{value}</div></div>;
}

export default function PersonalPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async u => {
      if (!u) { window.location.replace(`${BASE}/login/`); return; }
      try {
        const s = await getDoc(doc(db, 'users', u.uid));
        if (!s.exists()) { setError('Your EDUWILLS profile could not be found.'); return; }
        const d = s.data();
        let tokenCategories: string[] = [];
        try {
          const snap = await getDocs(query(collection(db, 'williTokens'), where('userId', '==', u.uid)));
          const now = Date.now();
          tokenCategories = snap.docs.flatMap(x => {
            const t = x.data();
            const exp = expiryMs(t.expiresAt || t.activationExpiresAt || t.expiry);
            if (t.used !== true || t.revoked === true || t.cancelled === true || (exp && exp <= now)) return [];
            return Array.isArray(t.categories) ? t.categories : [];
          });
        } catch { /* User profile categories remain usable if token query is denied. */ }
        const categories = normaliseCategories([
          ...(Array.isArray(d.categories) ? d.categories : []),
          ...(Array.isArray(d.educationLevels) ? d.educationLevels : []),
          ...(Array.isArray(d.schoolLevels) ? d.schoolLevels : []),
          d.category, d.educationLevel, d.schoolLevel, ...tokenCategories,
        ]);
        const fallback = categories.length ? categories : ['Book Learner'];
        const saved = normaliseCategories([d.activeCategory])[0];
        const activeCategory = saved && fallback.includes(saved) ? saved : fallback[0];
        setUser({ ...d, uid: u.uid, categories: fallback, activeCategory });
        setActive((d.activated === true || d.activationStatus === 'active' || d.williTokenActive === true) && (!d.activationExpiresAt || expiryMs(d.activationExpiresAt) > Date.now()));
      } catch (e) { console.error(e); setError('Could not load your profile. Please try again.'); }
      finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  const availableCategories = useMemo(() => Array.isArray(user?.categories) && user.categories.length ? user.categories : ['Book Learner'], [user]);
  const currentCategory = String(user?.activeCategory || availableCategories[0] || 'Book Learner');
  const firstName = user?.fullName?.split(' ')[0] || 'Learner';

  async function switchCategory(category: string) {
    if (!user?.uid || switching || category === currentCategory) return;
    setSwitching(true); setError('');
    try {
      const categoryId = CATEGORY_IDS[category] || category.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(db, 'users', user.uid), {
        activeCategory: category,
        activeCategoryId: categoryId,
        lastCategorySwitchAt: new Date(),
      }, { merge: true });
      localStorage.setItem('eduwills_active_category', category);
      localStorage.setItem('eduwills_active_category_id', categoryId);
      sessionStorage.setItem('eduwills_active_category', category);
      setUser((v: any) => ({ ...v, activeCategory: category, activeCategoryId: categoryId }));
      // Reload the dashboard so category-aware sections read the new selection immediately.
      window.location.assign(`${BASE}/dashboard/?category=${encodeURIComponent(categoryId)}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.code === 'permission-denied' ? 'Your profile cannot save category changes with the current Firebase rules.' : 'Could not switch category. Please try again.');
      setSwitching(false);
    }
  }

  async function logout() { await signOut(auth); window.location.replace(`${BASE}/`); }

  return <main className="min-h-screen bg-paper px-4 py-5 pb-10 sm:px-8"><div className="mx-auto max-w-4xl">
    <a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm"><ArrowLeft size={17}/> Dashboard</a>
    <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft">
      <div className="bg-ink p-7 text-white sm:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><UserRound size={25}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-cyan-200">PERSONAL</p><h1 className="mt-2 text-3xl font-black tracking-tight">Hello {firstName}.</h1><p className="mt-2 text-sm leading-6 text-slate-300">{loading ? 'Loading your profile…' : 'Manage your account, learning category and activation status.'}</p></div>
      {error ? <div className="p-8 text-center text-sm font-bold text-red-600">{error}</div> : <>
        <section className="border-b border-slate-100 p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Learning category</p><h2 className="mt-1 text-xl font-black text-ink">Switch EDUWILLS category</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Switch between every category assigned to your account. The selected category is saved to your account and becomes the active learning experience.</p></div><RefreshCw className={switching ? 'animate-spin text-cyan-600' : 'text-cyan-600'} size={24}/></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{availableCategories.map((category: string) => <button key={category} type="button" disabled={switching} onClick={() => switchCategory(category)} className={`rounded-2xl border px-4 py-4 text-left transition ${currentCategory === category ? 'border-cyan-500 bg-cyan-50 text-cyan-950 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-slate-50'} disabled:cursor-wait disabled:opacity-70`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-black">{category}</span>{currentCategory === category && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-600 px-2.5 py-1 text-[10px] font-black text-white"><Check size={11}/> CURRENT</span>}</div><span className="mt-1 block text-xs font-bold text-slate-400">Open this category's learning dashboard</span></button>)}</div>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-600">Current category: <span className="text-ink">{currentCategory}</span>{switching ? ' · Switching…' : ''}</div>
        </section>
        <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8"><InfoCard icon={<UserRound size={15}/>} label="Full name" value={user?.fullName || 'Loading…'}/><InfoCard icon={<AtSign size={15}/>} label="Username" value={user?.username || 'Loading…'}/><InfoCard icon={<Phone size={15}/>} label="Phone" value={user?.phone ? `+234 ${String(user.phone).replace(/^\+234\s*/, '')}` : 'Not available'}/><InfoCard icon={<BookOpen size={15}/>} label="Active category" value={currentCategory}/></div>
        <div className="border-t border-slate-100 p-6 sm:p-8"><div className={`flex items-start gap-3 rounded-2xl p-5 ${active ? 'bg-emerald-50' : 'bg-blue-50'}`}><ShieldCheck className={active ? 'mt-0.5 shrink-0 text-emerald-600' : 'mt-0.5 shrink-0 text-eduBlue'} size={19}/><div><div className="text-sm font-black text-ink">Account status</div><p className="mt-1 text-xs leading-5 text-slate-500">{active ? 'Your account is active and your learning features are unlocked.' : 'Your account is registered but not activated yet.'}</p></div></div>{!active && <a href={`${BASE}/dashboard/activation/`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg">Activate my account <ArrowRight size={16}/></a>}<button onClick={logout} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-600"><LogOut size={16}/> Log out</button></div>
      </>}</div></div></main>;
}
