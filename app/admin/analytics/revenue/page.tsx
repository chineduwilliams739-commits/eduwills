'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Bot, CreditCard, RefreshCw } from 'lucide-react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const OWNER_UID = 'A45uD8Cu27dI0y0iSWla4CZJBhn1';

type User = { uid?: string; createdAt?: any; registeredAt?: any; created_at?: any; acquisitionSource?: string };
type Token = { userId?: string; uid?: string; paymentStatus?: string; source?: string; acquisitionSource?: string; paymentCurrency?: string; currency?: string; paymentAmount?: number; amount?: number };
type Visitor = { visitorId?: string; firstSource?: string; source?: string; userId?: string; uid?: string };
type Row = { source: string; visitors: number; registrations: number; payingUsers: number; revenue: Record<string, number> };

function toMs(v: any) { if (!v) return 0; if (typeof v?.toMillis === 'function') return v.toMillis(); if (v?.seconds) return Number(v.seconds) * 1000; const n = Date.parse(String(v)); return Number.isFinite(n) ? n : 0; }
function pct(a: number, b: number) { return b ? `${((a / b) * 100).toFixed(1)}%` : '0%'; }
function money(revenue: Record<string, number>) { return Object.entries(revenue).map(([currency, amount]) => `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`).join(' · ') || '—'; }

export default function AdminRevenueAnalyticsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError(''); setRefreshing(true);
    try {
      const current = auth.currentUser;
      if (!current) { window.location.replace(`${BASE}/admin/login/`); return; }
      const admin = await getDoc(doc(db, 'admins', current.uid));
      if (!admin.exists() && current.uid !== OWNER_UID) { window.location.replace(`${BASE}/admin/login/`); return; }

      const [userSnap, tokenSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'williTokens')),
      ]);
      const users: User[] = userSnap.docs.map(d => ({ uid: d.id, ...(d.data() as User) }));
      const tokens: Token[] = tokenSnap.docs.map(d => d.data() as Token);
      const userById = new Map(users.map(u => [u.uid || '', u]));

      const sourceByUser = new Map<string, string>();
      const visitorSets = new Map<string, Set<string>>();
      for (let i = 0; i < 14; i++) {
        const day = new Date(); day.setUTCDate(day.getUTCDate() - i);
        const key = day.toISOString().slice(0, 10);
        const snap = await getDocs(collection(db, 'siteAnalytics', key, 'visitors'));
        snap.forEach(d => {
          const v = d.data() as Visitor;
          const source = String(v.firstSource || v.source || 'unknown').trim().toLowerCase() || 'unknown';
          const visitorId = String(v.visitorId || d.id);
          const set = visitorSets.get(source) || new Set<string>();
          set.add(visitorId); visitorSets.set(source, set);
          const uid = String(v.userId || v.uid || '');
          if (uid && !sourceByUser.has(uid)) sourceByUser.set(uid, source);
        });
      }

      const start = Date.now() - 14 * 86400000;
      const registrationSource = (u: User) => String(u.acquisitionSource || sourceByUser.get(u.uid || '') || 'unknown').trim().toLowerCase() || 'unknown';
      const paidTokens = tokens.filter(t => String(t.paymentStatus || '').toLowerCase() === 'success' || String(t.source || '').toLowerCase() === 'paystack');
      const paidByUser = new Map<string, Token[]>();
      paidTokens.forEach(t => { const uid = String(t.userId || t.uid || ''); if (!uid) return; const list = paidByUser.get(uid) || []; list.push(t); paidByUser.set(uid, list); });

      const sourceNames = new Set<string>([...visitorSets.keys(), ...users.map(registrationSource), ...paidTokens.map(t => String(t.acquisitionSource || '').toLowerCase()).filter(Boolean)]);
      const result: Row[] = [...sourceNames].map(source => {
        const registrations = users.filter(u => registrationSource(u) === source && toMs(u.createdAt || u.registeredAt || u.created_at) >= start).length;
        const payingUsers = [...paidByUser.keys()].filter(uid => {
          const user = userById.get(uid);
          const tokenSource = paidByUser.get(uid)?.find(t => t.acquisitionSource)?.acquisitionSource;
          return String(user?.acquisitionSource || sourceByUser.get(uid) || tokenSource || 'unknown').toLowerCase() === source;
        });
        const revenue: Record<string, number> = {};
        payingUsers.forEach(uid => (paidByUser.get(uid) || []).forEach(t => {
          const currency = String(t.paymentCurrency || t.currency || 'NGN').toUpperCase();
          const amount = Number(t.paymentAmount ?? t.amount ?? 0);
          if (Number.isFinite(amount) && amount > 0) revenue[currency] = (revenue[currency] || 0) + amount;
        }));
        return { source, visitors: visitorSets.get(source)?.size || 0, registrations, payingUsers: payingUsers.length, revenue };
      }).filter(r => r.visitors || r.registrations || r.payingUsers).sort((a, b) => b.payingUsers - a.payingUsers || b.visitors - a.visitors);

      setRows(result);
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'Firebase denied analytics access. Publish the latest Firestore rules.' : 'Could not load revenue attribution.');
    } finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => onAuthStateChanged(auth, user => { if (!user) window.location.replace(`${BASE}/admin/login/`); else load(); }), []);

  const totals = useMemo(() => rows.reduce((a, r) => ({ visitors: a.visitors + r.visitors, registrations: a.registrations + r.registrations, payingUsers: a.payingUsers + r.payingUsers }), { visitors: 0, registrations: 0, payingUsers: 0 }), [rows]);
  const maxVisitors = Math.max(1, ...rows.map(r => r.visitors));
  const chatgpt = rows.find(r => r.source === 'chatgpt');

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading Revenue Analytics…</main>;

  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap items-center justify-between gap-3"><a href={`${BASE}/admin/analytics/`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"><ArrowLeft size={16}/> Analytics</a><button onClick={load} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/> Refresh</button></div>
    <div className="mt-7"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">EDUWILLS monetization</p><h1 className="mt-2 text-3xl font-black tracking-tight">Revenue attribution by traffic source</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">This view connects the first recorded acquisition source to registrations and successful Paystack activation payments. Revenue is shown in the currency actually recorded by the payment.</p></div>
    {error && <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
    <section className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><BarChart3 size={19} className="text-cyan-300"/><p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Visitors · 14d</p><p className="mt-1 text-3xl font-black">{totals.visitors}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><CreditCard size={19} className="text-cyan-300"/><p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Paying users</p><p className="mt-1 text-3xl font-black">{totals.payingUsers}</p><p className="mt-1 text-xs text-slate-500">{pct(totals.payingUsers, totals.visitors)} visitor-to-payment rate</p></div><div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5"><Bot size={19} className="text-cyan-300"/><p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">ChatGPT paying users</p><p className="mt-1 text-3xl font-black text-cyan-300">{chatgpt?.payingUsers || 0}</p><p className="mt-1 text-xs text-slate-500">{pct(chatgpt?.payingUsers || 0, chatgpt?.visitors || 0)} of ChatGPT visitors</p></div></section>
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[.04] p-5 sm:p-7"><div className="flex items-center gap-3"><BarChart3 size={19} className="text-cyan-300"/><h2 className="text-lg font-black">Source conversion table</h2></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><th className="px-3 py-3">Source</th><th className="px-3 py-3">Visitors</th><th className="px-3 py-3">Registrations</th><th className="px-3 py-3">Paying</th><th className="px-3 py-3">Signup rate</th><th className="px-3 py-3">Payment rate</th><th className="px-3 py-3">Revenue</th></tr></thead><tbody>{rows.map(r => <tr key={r.source} className="border-b border-white/5"><td className="px-3 py-4 font-black">{r.source === 'chatgpt' ? <span className="inline-flex items-center gap-2"><Bot size={15} className="text-cyan-300"/> ChatGPT</span> : r.source}</td><td className="px-3 py-4 font-bold">{r.visitors}</td><td className="px-3 py-4 font-bold">{r.registrations}</td><td className="px-3 py-4 font-black text-emerald-300">{r.payingUsers}</td><td className="px-3 py-4">{pct(r.registrations, r.visitors)}</td><td className="px-3 py-4">{pct(r.payingUsers, r.visitors)}</td><td className="px-3 py-4 font-black">{money(r.revenue)}</td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-slate-500">No attributed conversion data yet.</p>}</div></section>
    <section className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[.04] p-5 sm:p-7"><h2 className="font-black">Visitor volume</h2><div className="mt-5 space-y-4">{rows.slice(0, 10).map(r => <div key={r.source}><div className="mb-1 flex justify-between text-xs"><span className="font-bold text-slate-300">{r.source}</span><span className="font-black">{r.visitors}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.max(r.visitors ? 3 : 0, r.visitors / maxVisitors * 100)}%` }}/></div></div>)}</div></div><div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5 sm:p-7"><h2 className="font-black">ChatGPT result</h2><p className="mt-2 text-sm text-slate-400">Once visitors have completed the full journey, this card becomes your direct measurement of whether ChatGPT is producing customers.</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-white/5 p-4"><p className="text-xs text-slate-500">Visitors</p><p className="mt-1 text-xl font-black">{chatgpt?.visitors || 0}</p></div><div className="rounded-xl bg-white/5 p-4"><p className="text-xs text-slate-500">Signups</p><p className="mt-1 text-xl font-black">{chatgpt?.registrations || 0}</p></div><div className="rounded-xl bg-white/5 p-4"><p className="text-xs text-slate-500">Paying</p><p className="mt-1 text-xl font-black">{chatgpt?.payingUsers || 0}</p></div><div className="rounded-xl bg-white/5 p-4"><p className="text-xs text-slate-500">Revenue</p><p className="mt-1 text-xl font-black">{money(chatgpt?.revenue || {})}</p></div></div></div></section>
  </div></main>;
}
