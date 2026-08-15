'use client';

import { useState } from 'react';
import { ArrowLeft, KeyRound } from 'lucide-react';
const BASE = '/eduwills';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  function findAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phone.length !== 10) { setMessage('Enter exactly 10 digits after +234.'); return; }
    const users = JSON.parse(localStorage.getItem('eduwills_users') || '[]');
    if (!users.some((u: { phone: string }) => u.phone === phone)) { setMessage('No EDUWILLS account was found with that phone number.'); return; }
    setMessage('Account found. Set a new password below.');
    setStep(2);
  }

  function resetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirm') || '');
    if (password.length < 6) { setMessage('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setMessage('The passwords do not match.'); return; }
    const users = JSON.parse(localStorage.getItem('eduwills_users') || '[]');
    const updated = users.map((u: { phone: string; password: string }) => u.phone === phone ? { ...u, password } : u);
    localStorage.setItem('eduwills_users', JSON.stringify(updated));
    window.location.href = `${BASE}/login/?recovered=1`;
  }

  return <main className="min-h-screen bg-paper px-5 py-6 sm:px-8"><div className="mx-auto max-w-5xl"><a href={`${BASE}/login/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Back to login</a><div className="mx-auto mt-10 max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-eduBlue"><KeyRound size={21}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Account recovery</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Reset your password</h1><p className="mt-2 text-sm leading-6 text-slate-500">No SMS service is required. Recover this preview account using your registered phone number.</p>{step===1?<form className="mt-8 space-y-5" onSubmit={findAccount}><label className="block text-sm font-bold text-ink">Phone number<div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200 bg-paper"><span className="flex items-center border-r border-slate-200 px-3 text-sm font-black text-slate-500">+234</span><input required type="tel" inputMode="numeric" value={phone} onChange={(e)=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} maxLength={10} className="w-full bg-transparent px-4 py-3 outline-none" placeholder="8012345678"/></div><span className="mt-1 block text-xs text-slate-400">Enter exactly 10 digits after +234.</span></label>{message&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{message}</p>}<button type="submit" className="w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white">Find my account</button></form>:<form className="mt-8 space-y-5" onSubmit={resetPassword}><div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div><label className="block text-sm font-bold text-ink">New password<input name="password" required minLength={6} type="password" className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none" placeholder="At least 6 characters"/></label><label className="block text-sm font-bold text-ink">Confirm password<input name="confirm" required minLength={6} type="password" className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none" placeholder="Repeat password"/></label><button type="submit" className="w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white">Save new password</button></form>}</div></div></main>;
}
