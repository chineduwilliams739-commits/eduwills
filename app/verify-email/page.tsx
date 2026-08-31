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
    if (!user) { window.location.replace(`${BASE}/signup/`); return; }
    setEmail(user.email || '');
    setVerified(user.emailVerified);
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      const user = auth.currentUser;
      if (!user || verified) return;
      try {
        await reload(user);
        if (auth.currentUser?.emailVerified) {
          setVerified(true);
          await signOut(auth);
          window.location.replace(`${BASE}/login/`);
        }
      } catch {}
    }, 2500);
    return () => clearInterval(timer);
  }, [verified]);

  async function checkVerification() {
    const user = auth.currentUser;
    if (!user) { window.location.replace(`${BASE}/signup/`); return; }
    setLoading(true); setMessage('');
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        setVerified(true);
        setMessage('Email verified successfully. Taking you to the login page…');
        await signOut(auth);
        window.setTimeout(() => window.location.replace(`${BASE}/login/`), 500);
      } else {
        setMessage('It is not verified yet. Open the verification link in your email and return here.');
      }
    } catch {
      setMessage('We could not check the verification status yet. Please try again.');
    } finally { setLoading(false); }
  }

  async function resend() {
    const user = auth.currentUser;
    if (!user) { window.location.replace(`${BASE}/signup/`); return; }
    setLoading(true); setMessage('');
    try {
      await sendEmailVerification(user);
      setMessage('A new verification email has been sent. Check your Inbox, Spam/Junk, Promotions and other email folders.');
    } catch {
      setMessage('We could not send another email right now. Please wait a moment and try again.');
    } finally { setLoading(false); }
  }

  async function leave() { await signOut(auth); window.location.replace(`${BASE}/login/`); }

  return <main className="min-h-screen bg-paper px-5 py-8 sm:px-8"><div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-eduBlue"><MailCheck size={25}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Account verification</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Check your email</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your account has been created and a verification email has been sent. You must verify your email before logging in.</p>{email&&<p className="mt-4 break-all rounded-xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">{email}</p>}<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left"><p className="text-sm font-black text-amber-900">Can’t find it?</p><p className="mt-1 text-xs leading-5 text-amber-800">Check your <b>Inbox</b>, <b>Spam/Junk</b>, <b>Promotions</b> and other email folders. Search for “EduWills” or “verify”.</p></div>{message&&<p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-700">{message}</p>}<div className="mt-6 space-y-3"><button disabled={loading} onClick={checkVerification} className="flex w-full items-center justify-center gap-2 rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white disabled:opacity-60"><RefreshCw size={17}/>{loading?'Checking…':'I verified my email'}</button><button disabled={loading} onClick={resend} className="w-full rounded-xl border border-slate-200 px-5 py-3.5 font-black text-ink disabled:opacity-60">Resend verification email</button></div><p className="mt-5 text-center text-xs leading-5 text-slate-400">After verification is detected, EduWills automatically signs you out and sends you to the login page.</p><button onClick={leave} className="mt-4 w-full text-sm font-bold text-slate-500">Use a different account</button></div></main>;
}
