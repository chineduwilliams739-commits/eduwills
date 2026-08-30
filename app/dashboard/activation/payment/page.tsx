'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

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
  const [activated, setActivated] = useState(false);
  const [paymentBackend, setPaymentBackend] = useState('');
  const [paystackLoaded, setPaystackLoaded] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { window.location.replace(`${BASE}/login/`); return; }
      setUid(u.uid);
    });

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    script.onload = () => setPaystackLoaded(true);
    script.onerror = () => setMessage('Paystack checkout could not be loaded. Please check your internet connection and refresh.');
    document.body.appendChild(script);

    return () => { unsub(); script.remove(); };
  }, []);

  useEffect(() => {
    fetch(PAYMENT_CONFIG_URL, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('PAYMENT_BACKEND_CONFIG_MISSING')))
      .then(data => {
        const url = String(data?.baseUrl || '').replace(/\/$/, '');
        if (!url) throw new Error('PAYMENT_BACKEND_CONFIG_MISSING');
        setPaymentBackend(url);
      })
      .catch(() => setMessage('Payment service is being prepared. Please refresh in a moment.'));
  }, []);

  async function waitForActivation() {
    for (let i = 0; i < 12; i += 1) {
      await new Promise(r => setTimeout(r, 2500));
      const snap = await getDoc(doc(db, 'users', uid));
      const data = snap.data() as any;
      if (data?.activationStatus === 'active' && data?.activationExpiresAt) {
        setActivated(true);
        setMessage('🎉 Congratulations! Your EduWills account has been successfully activated. You can now use your activated learning features.');
        return true;
      }
      if (data?.pendingActivationPaymentStatus === 'success' && data?.pendingActivationCode) {
        setMessage('✅ Payment confirmed. Your activation code has been generated and sent to your email. Redeem the code to activate your EduWills account.');
        return true;
      }
    }
    return false;
  }

  async function pay() {
    setMessage('');
    if (!uid) return setMessage('Your account is still loading. Please wait a moment.');
    if (!paymentBackend) return setMessage('The secure payment service is not ready yet. Please refresh and try again.');
    if (!paystackLoaded || !window.PaystackPop) return setMessage('Paystack checkout is still loading. Please wait a moment and try again.');
    setWorking(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Authentication required. Please sign in again.');
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
      if (!data?.access_code) throw new Error('Paystack did not return a checkout code.');

      const popup = new window.PaystackPop();
      popup.resumeTransaction(data.access_code);

      const success = await waitForActivation();
      if (!success) setMessage('Payment was initiated successfully, but confirmation is still pending. If you completed payment, wait a little and refresh your dashboard.');
    } catch (e: any) {
      setMessage(e?.message || 'Could not start payment.');
    } finally {
      setWorking(false);
    }
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6"><div className="mx-auto max-w-2xl"><a href={`${BASE}/dashboard/activation/`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold"><ArrowLeft size={16}/> Back to activation</a><section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[.04] p-6 shadow-2xl sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><CreditCard size={23}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-cyan-300">Secure activation</p><h1 className="mt-2 text-3xl font-black">Activate EduWills online</h1><p className="mt-3 text-sm leading-6 text-slate-400">Pay securely with Paystack. International cards can be used when international payments are enabled on the EduWills Paystack account.</p>
<div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={()=>setCurrency('NGN')} className={`rounded-2xl border p-5 text-left ${currency==='NGN'?'border-cyan-400 bg-cyan-400/10':'border-white/10 bg-white/5'}`}><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Nigeria</p><p className="mt-1 text-2xl font-black">₦4,000</p><p className="mt-1 text-xs text-slate-400">Book Learner activation</p></button><button onClick={()=>setCurrency('USD')} className={`rounded-2xl border p-5 text-left ${currency==='USD'?'border-cyan-400 bg-cyan-400/10':'border-white/10 bg-white/5'}`}><p className="text-xs font-bold uppercase tracking-wider text-slate-500">International</p><p className="mt-1 text-2xl font-black">$5</p><p className="mt-1 text-xs text-slate-400">Book Learner activation</p></button></div>
<button disabled={working||activated} onClick={pay} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 px-5 py-4 font-black text-slate-950 disabled:opacity-50">{working?<><Loader2 size={18} className="animate-spin"/> Processing…</>:activated?<><CheckCircle2 size={18}/> Activated</>:`Pay ${currency==='NGN'?'₦4,000':'$5'} securely`}</button>
{message&&<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">{message}</div>}
<div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="flex gap-3 rounded-xl bg-white/5 p-4"><ShieldCheck className="shrink-0 text-emerald-400" size={18}/><p className="text-xs leading-5 text-slate-400">Your Paystack secret key is never sent to the browser. The secure payment backend handles Paystack initialization.</p></div><div className="rounded-xl bg-white/5 p-4"><p className="text-xs leading-5 text-slate-400">Successful payments automatically generate and assign a WilliToken through the verified Paystack webhook.</p></div></div></section></div></main>;
}
