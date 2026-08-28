'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Bot, Globe2, RefreshCw, Users, UserPlus } from 'lucide-react';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const OWNER_UID = 'A45uD8Cu27dI0y0iSWla4CZJBhn1';

type Visitor = { visitorId: string; source?: string; firstSeenAt?: string; language?: string; path?: string };
type Day = { day: string; visitors: number; sources: Record<string, number> };
type StatIcon = React.ComponentType<React.ComponentProps<typeof Users>>;

function dateKey(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    setRefreshing(true);
    try {
      const current = auth.currentUser;
      if (!current) { window.location.replace(`${BASE}/admin/login/`); return; }
      const admin = await getDoc(doc(db, 'admins', current.uid));
      if (!admin.exists() && current.uid !== OWNER_UID) { window.location.replace(`${BASE}/admin/login/`); return; }

      const results = await Promise.all(Array.from({ length: 14 }, (_, i) => (async () => {
        const day = dateKey(i);
        const snap = await getDocs(collection(db, 'siteAnalytics', day, 'visitors'));
        const sources: Record<string, number> = {};
        snap.forEach(d => { const v = d.data() as Visitor; const source = v.source || 'unknown'; sources[source] = (sources[source] || 0) + 1; });
        return { day, visitors: snap.size, sources };
      })()));
      setDays(results);
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'Firebase denied analytics access. Publish the latest Firestore rules.' : 'Could not load analytics.');
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => onAuthStateChanged(auth, user => { if (!user) window.location.replace(`${BASE}/admin/login/`); else load(); }), []);

  const today = days[0];
  const fourteenTotal = useMemo(() => days.reduce((sum, d) => sum + d.visitors, 0), [days]);
  const topSources = useMemo(() => {
    const map: Record<string, number> = {};
    days.forEach(d => Object.entries(d.sources).forEach(([source, count]) => { map[source] = (map[source] || 0) + count; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [days]);
  const max = Math.max(1, ...days.map(d => d.visitors));
  const statCards: Array<[string, string | number, StatIcon]> = [
    ['Today', today?.visitors || 0, Users],
    ['14-day visitor records', fourteenTotal, Globe2],
    ['ChatGPT today', today?.sources?.chatgpt || 0, Bot],
    ['Top source', topSources[0]?.[0] || '—', BarChart3]
  ];

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading Analytics…</main>;

  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`${BASE}/admin/`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"><ArrowLeft size={16}/> Admin</a>
        <button onClick={load} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/> Refresh</button>
      </div>
      <div className="mt-7"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">EDUWILLS analytics</p><h1 className="mt-2 text-3xl font-black tracking-tight">Daily visitors & acquisition</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Unique visitors are counted once per browser per UTC day. No IP address is collected by this tracker.</p></div>
      {error && <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><Icon size={19} className="text-cyan-300"/><p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
      </section>
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.04] p-5 sm:p-7"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Last 14 days</h2><p className="mt-1 text-xs text-slate-500">Unique visitors by UTC day</p></div><BarChart3 className="text-cyan-300"/></div><div className="mt-7 space-y-3">{days.map(d => <div key={d.day} className="grid grid-cols-[86px_1fr_42px] items-center gap-3 text-sm"><span className="font-bold text-slate-400">{d.day.slice(5)}</span><div className="h-3 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-cyan-400" style={{width:`${Math.max(2,(d.visitors/max)*100)}%`}}/></div><span className="text-right font-black">{d.visitors}</span></div>)}</div></section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[.04] p-5 sm:p-7"><div className="flex items-center gap-3"><UserPlus size={19} className="text-cyan-300"/><h2 className="font-black">Traffic sources</h2></div><div className="mt-5 space-y-3">{topSources.length ? topSources.map(([source,count]) => <div key={source} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"><span className="font-semibold text-slate-300">{source}</span><span className="font-black">{count}</span></div>) : <p className="text-sm text-slate-500">No visitor data yet.</p>}</div></div><div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5 sm:p-7"><div className="flex items-center gap-3"><Bot size={19} className="text-cyan-300"/><h2 className="font-black">ChatGPT acquisition</h2></div><p className="mt-4 text-sm leading-6 text-slate-400">When users arrive from a ChatGPT link or app referral, the tracker labels the source as <strong className="text-white">chatgpt</strong>. This lets us measure whether the ChatGPT app is actually sending visitors to EduWills.</p><div className="mt-5 text-4xl font-black text-cyan-300">{days.reduce((n,d)=>n+(d.sources.chatgpt||0),0)}</div><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">ChatGPT-sourced visitors in the last 14 days</p></div></section>
    </div>
  </main>;
}
