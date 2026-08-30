'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

declare global { interface Window { PaystackPop?: any } }

const BASE = '/eduwills';
const PAYMENT_CONFIG_URL = `${BASE}/payment-backend.json`;
const NGN_AMOUNT = 4000;
const USD_AMOUNT = 5;

export default function ActivationPaymentPage() {
  const [uid, setUid] = useState('');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentBackend, setPaymentBackend] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { window.location.replace(`${BASE}/login/`); return; }
      setUid(u.uid);
    });

    fetch(PAYMENT_CONFIG_URL, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('PAYMENT_BACKEND_CONFIG_MISSING')))
      .then(data => {
        const url = String(data?.baseUrl || '').replace(/\/$/, '');
        if (!url) throw new Error('PAYMENT_BACKEND_CONFIG_MISSING');
        setPaymentBackend(url);
      })
      .catch(() => setMessage('Payment service is being prepared. Please refresh in a moment.'));

    return () => unsub();
  }, []);

  async function pay() {
    setMessage('');
    if (!uid) return setMessage('Your account is still loading. Please wait a moment.');
    if (!paymentBackend) return setMessage('The secure payment service is not ready yet. Please refresh and try again.');
    setWorking(true);
    try {
      const current = auth.currentUser;
      if (!current) throw new Error('Authentication required. Please sign in again.');
      await current.reload();
      if (!current.email || !current.emailVerified) {
        throw new Error('Please verify your email address before making a payment.');
      }

      const idToken = await current.getIdToken(true);
      const amount = currency === 'NGN' ? NGN_AMOUNT : USD_AMOUNT;
      const response = await fetch(`${paymentBackend}/paystack/initialize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency,
          paymentCurrency: currency,
          categories: ['Book Learner'],
          country: currency === 'NGN' ? 'NG' : 'INT'
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Payment initialization failed (${response.status}).`);
      if (!data?.authorization_url) throw new Error('Paystack did not return a checkout URL.');

      // Use Paystack's hosted checkout URL. This avoids browser/InlineJS popup
      // errors while keeping the secret key entirely on the payment Worker.
      window.location.assign(data.authorization_url);
    } catch (e: any) {
      setMessage(e?.message === 'Failed to fetch'
        ? 'The secure payment service could not be reached. Please refresh and try again.'
        : e?.message || 'Could not start payment.');
      setWorking(false);
    }
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6"><div className="mx-auto max-w-2xl"><a href={`${BASE}/dashboard/activation/`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold"><ArrowLeft size={16}/> Back to activation</a><section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[.04] p-6 shadow-2xl sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><CreditCard size={23}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-cyan-300">Secure activation</p><h1 className="mt-2 text-3xl font-black">Activate EduWills online</h1><p className="mt-3 text-sm leading-6 text-slate-400">Pay securely with Paystack. International cards can be used when international payments are enabled on the EduWills Paystack account.</p>
<div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={()=>setCurrency('NGN')} className={`rounded-2xl border p-5 text-left ${currency==='NGN'?'border-cyan-400 bg-cyan-400/10':'border-white/10 bg-white/5'}`}><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Nigeria</p><p className="mt-1 text-2xl font-black">₦4,000</p><p className="mt-1 text-xs text-slate-400">Book Learner activation</p></button><button onClick={()=>setCurrency('USD')} className={`rounded-2xl border p-5 text-left ${currency==='USD'?'border-cyan-400 bg-cyan-400/10':'border-white/10 bg-white/5'}`}><p className="text-xs font-bold uppercase tracking-wider text-slate-500">International</p><p className="mt-1 text-2xl font-black">$5</p><p className="mt-1 text-xs text-slate-400">Book Learner activation</p></button></div>
<button disabled={working} onClick={pay} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 px-5 py-4 font-black text-slate-950 disabled:opacity-50">{working?<><Loader2 size={18} className="animate-spin"/> Opening Paystack…</>:`Pay ${currency==='NGN'?'₦4,000':'$5'} securely`}</button>
{message&&<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">{message}</div>}
<div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="flex gap-3 rounded-xl bg-white/5 p-4"><ShieldCheck className="shrink-0 text-emerald-400" size={18}/><p className="text-xs leading-5 text-slate-400">Your Paystack secret key is never sent to the browser. The secure payment backend handles Paystack initialization.</p></div><div className="rounded-xl bg-white/5 p-4"><p className="text-xs leading-5 text-slate-400">Successful payments automatically generate and assign a WilliToken through the verified Paystack webhook.</p></div></div></section></div></main>;
}
