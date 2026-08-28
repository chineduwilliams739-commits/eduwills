'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const PRICES: Record<string, number> = {
  Primary: 2000,
  'Junior Secondary': 3000,
  'Senior Secondary': 3000,
  'Book Learner': 4000,
};
const CATEGORIES = Object.keys(PRICES);

type User = { fullName?: string; email?: string; categories?: string[]; category?: string; emailVerified?: boolean };

function moneyNGN(value: number) { return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value); }

export default function ActivationPage() {
  const [uid, setUid] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [quote, setQuote] = useState<{ localCurrency: string; localAmount: number; paymentCurrency: string; paymentAmount: number; displayName: string; rate: number } | null>(null);
  const [country, setCountry] = useState('NG');
  const [currency, setCurrency] = useState('NGN');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async current => {
    if (!current) { window.location.replace(`${BASE}/login/`); return; }
    setUid(current.uid);
    setCountry(current.phoneNumber?.startsWith('+234') ? 'NG' : 'INT');
    setCurrency(current.phoneNumber?.startsWith('+234') ? 'NGN' : 'USD');
    try {
      const snap = await getDoc(doc(db, 'users', current.uid));
      const data = snap.exists() ? snap.data() as User : { email: current.email || '' };
      setUser({ ...data, email: data.email || current.email || '' });
      const existing = Array.isArray(data.categories) ? data.categories.filter(x => CATEGORIES.includes(x)) : [];
      if (existing.length === 1) setSelected(existing);
    } finally { setLoading(false); }
  }), []);

  const categoryTotal = useMemo(() => selected.reduce((sum, item) => sum + (PRICES[item] || 0), 0), [selected]);

  async function getQuote() {
    if (!selected.length) { setMessage('Select at least one learning category.'); return; }
    setMessage(''); setQuoting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('https://us-central1-eduwills.cloudfunctions.net/paystackQuote', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ categories: selected, country, currency }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not calculate payment amount.');
      setQuote(data);
    } catch (e: any) { setMessage(e?.message || 'Could not calculate payment amount.'); } finally { setQuoting(false); }
  }

  async function pay() {
    if (!quote) { await getQuote(); return; }
    setPaying(true); setMessage('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('https://us-central1-eduwills.cloudfunctions.net/paystackInitialize', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ categories: selected, country, currency, amount: quote.paymentAmount, paymentCurrency: quote.paymentCurrency, durationMs: 31536000000 }) });
      const data = await res.json();
      if (!res.ok || !data.authorization_url) throw new Error(data.error || 'Could not open Paystack checkout.');
      window.location.href = data.authorization_url;
    } catch (e: any) { setMessage(e?.message || 'Payment could not be started.'); setPaying(false); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="animate-spin"/></main>;

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8"><div className="mx-auto max-w-3xl">
    <a href={`${BASE}/dashboard/`} className="text-sm font-bold text-slate-300">← Back to dashboard</a>
    <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl sm:p-9">
      <div className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><KeyRound/></div><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">EDUWILLS activation</p><h1 className="mt-2 text-3xl font-black">Choose your learning category</h1><p className="mt-2 text-sm leading-6 text-slate-400">Select the category you want to activate. The amount is calculated automatically before payment.</p></div></div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">{CATEGORIES.map(category => { const active = selected.includes(category); return <button key={category} onClick={() => { setSelected(prev => active ? prev.filter(x => x !== category) : [...prev, category]); setQuote(null); }} className={`rounded-2xl border p-5 text-left transition ${active ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/10 bg-slate-900/60 hover:border-white/20'}`}><div className="flex items-center justify-between"><span className="font-black">{category}</span>{active && <CheckCircle2 className="text-cyan-300" size={20}/>}</div><p className="mt-2 text-sm text-slate-400">Base activation: {moneyNGN(PRICES[category])}</p></button>; })}</div>
      <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-wider text-slate-400">Country code / country<select value={country} onChange={e => { setCountry(e.target.value); setCurrency(e.target.value === 'NG' ? 'NGN' : 'USD'); setQuote(null); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-bold"><option value="NG">Nigeria</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="GH">Ghana</option><option value="KE">Kenya</option><option value="ZA">South Africa</option><option value="CI">Côte d’Ivoire</option><option value="INT">Other country</option></select></label><label className="text-xs font-black uppercase tracking-wider text-slate-400">Payment currency<select value={currency} onChange={e => { setCurrency(e.target.value); setQuote(null); }} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-bold"><option value="NGN">NGN — Nigerian Naira</option><option value="USD">USD — US Dollar</option></select></label></div></div>
      <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-5"><div className="flex justify-between gap-4 text-sm"><span className="text-slate-400">Selected categories</span><span className="font-bold">{selected.length ? selected.join(', ') : 'None'}</span></div><div className="mt-3 flex justify-between gap-4 border-t border-white/10 pt-3"><span className="text-slate-400">Base amount</span><span className="font-black">{moneyNGN(categoryTotal)}</span></div>{quote && <><div className="mt-3 flex justify-between gap-4"><span className="text-slate-400">Estimated local total</span><span className="font-black">{new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.localCurrency }).format(quote.localAmount)}</span></div><div className="mt-3 flex justify-between gap-4"><span className="text-slate-400">Paystack checkout</span><span className="font-black">{new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.paymentCurrency }).format(quote.paymentAmount)}</span></div></>}</div>
      <button onClick={quote ? pay : getQuote} disabled={quoting || paying || !selected.length} className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 px-5 py-4 font-black text-slate-950 disabled:opacity-50">{quoting ? 'Calculating…' : paying ? 'Opening Paystack…' : quote ? 'Continue to secure Paystack payment' : 'Calculate activation amount'}</button>
      <div className="mt-4 flex gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs leading-5 text-slate-400"><ShieldCheck size={18} className="shrink-0 text-emerald-300"/><span>After Paystack confirms a successful payment, EduWills automatically generates a one-year activation code and sends it to your verified email. The code must be redeemed within 7 days.</span></div>
      {user?.email && <div className="mt-3 flex gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs leading-5 text-slate-400"><Mail size={18} className="shrink-0 text-cyan-300"/>Activation details will be sent to <strong className="text-white">{user.email}</strong>.</div>}
      {message && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">{message}</p>}
    </section>
  </div></main>;
}
