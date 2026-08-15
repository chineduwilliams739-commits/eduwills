'use client';

import { useState } from 'react';
import { ArrowLeft, LockKeyhole, Phone } from 'lucide-react';
const BASE = '/eduwills';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') || '');
    if (phone.length !== 10) { setMessage('Enter exactly 10 digits after +234.'); return; }
    const users = JSON.parse(localStorage.getItem('eduwills_users') || '[]');
    const user = users.find((u: { phone: string; password: string }) => u.phone === phone && u.password === password);
    if (!user) { setMessage('Phone number or password is incorrect.'); return; }
    localStorage.setItem('eduwills_current_user', user.username);
    window.location.href = `${BASE}/dashboard/`;
  }

  return <main className="min-h-screen bg-paper px-5 py-6 sm:px-8"><div className="mx-auto max-w-5xl"><a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Back to EDUWILLS</a><div className="mx-auto mt-10 max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><LockKeyhole size={21}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Welcome back</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Log in to EDUWILLS</h1><p className="mt-2 text-sm leading-6 text-slate-500">Use your registered phone number and password to continue.</p><form className="mt-8 space-y-5" onSubmit={submit}><label className="block text-sm font-bold text-ink">Phone number<div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200 bg-paper"><span className="flex items-center border-r border-slate-200 px-3 text-sm font-black text-slate-500">+234</span><div className="relative flex-1"><Phone className="absolute left-3 top-3.5 text-slate-400" size={17}/><input required type="tel" inputMode="numeric" value={phone} onChange={(e)=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} maxLength={10} className="w-full bg-transparent py-3 pl-10 pr-3 outline-none" placeholder="8012345678"/></div></div><span className="mt-1 block text-xs font-normal text-slate-400">Enter exactly 10 digits after +234.</span></label><label className="block text-sm font-bold text-ink">Password<input name="password" required type="password" className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Your password"/></label><div className="text-right"><a href={`${BASE}/forgot-password/`} className="text-xs font-bold text-eduBlue">Forgot password?</a></div>{message&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{message}</p>}<button type="submit" className="w-full rounded-xl bg-ink px-5 py-3.5 font-black text-white">Log in</button></form><p className="mt-6 text-center text-sm text-slate-500">New to EDUWILLS? <a href={`${BASE}/signup/`} className="font-bold text-eduBlue">Create an account</a></p></div></div></main>;
}
