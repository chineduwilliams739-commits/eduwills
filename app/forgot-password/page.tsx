'use client';

import { useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const BASE = '/eduwills';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    setError('');
    const value = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(value)) { setError('Enter the email address you used to register.'); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, value);
      setMessage('If an EDUWILLS account exists for that email, a password reset link has been sent. Check your inbox and spam folder.');
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : '';
      if (code.includes('invalid-email')) setError('Enter a valid email address.');
      else setError('We could not send the reset email right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-paper px-5 py-6 sm:px-8"><div className="mx-auto max-w-5xl"><a href={`${BASE}/login/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Back to login</a><div className="mx-auto mt-10 max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-eduBlue"><KeyRound size={21}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Account recovery</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Reset your password</h1><p className="mt-2 text-sm leading-6 text-slate-500">We'll send a secure password-reset link to your registered email address. No SMS service is required.</p><form className="mt-8 space-y-5" onSubmit={submit}><label className="block text-sm font-bold text-ink">Email address<input required type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="you@example.com"/></label>{message&&<p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-700">{message}</p>}{error&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-600">{error}</p>}<button disabled={loading} type="submit" className="w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white disabled:opacity-60">{loading?'Sending…':'Send reset link'}</button></form></div></div></main>;
}
