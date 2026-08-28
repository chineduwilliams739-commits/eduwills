'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, MailCheck, RefreshCw } from 'lucide-react';
import { reload, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const BASE = '/eduwills';

export default function VerifyEmailPage() {
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      window.location.href = `${BASE}/signup/`;
      return;
    }
    setEmail(user.email || '');
    setVerified(user.emailVerified);
  }, []);

  async function checkVerification() {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    setMessage('');
    try {
      await reload(user);
      const current = auth.currentUser;
      if (current?.emailVerified) {
        setVerified(true);
        setMessage('Email verified successfully.');
        setTimeout(() => { window.location.href = `${BASE}/dashboard/`; }, 800);
      } else {
        setMessage('Your email is not verified yet. Open the link in your email, then try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    setMessage('');
    try {
      await sendEmailVerification(user);
      setMessage('A new verification link has been sent.');
    } catch {
      setMessage('We could not send another email right now. Please wait a moment and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function leave() {
    await signOut(auth);
    window.location.href = `${BASE}/login/`;
  }

  return <main className="min-h-screen bg-paper px-5 py-8 sm:px-8"><div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-eduBlue">{verified?<CheckCircle2 size={25}/>:<MailCheck size={25}/>}</div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Account verification</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">{verified?'Email verified':'Check your email'}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{verified?'Your email address has been verified.':'We sent a verification link to your registered email address.'}</p>{email&&<p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 break-all">{email}</p>}{message&&<p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-700">{message}</p>}{!verified&&<div className="mt-6 space-y-3"><button disabled={loading} onClick={checkVerification} className="flex w-full items-center justify-center gap-2 rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white disabled:opacity-60"><RefreshCw size={17}/>{loading?'Checking…':'I verified my email'}</button><button disabled={loading} onClick={resend} className="w-full rounded-xl border border-slate-200 px-5 py-3.5 font-black text-ink disabled:opacity-60">Resend verification email</button></div>}{verified&&<button onClick={()=>window.location.href=`${BASE}/dashboard/`} className="mt-6 w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white">Continue to EDUWILLS</button>}<button onClick={leave} className="mt-4 w-full text-sm font-bold text-slate-500">Use a different account</button></div></main>;
}
