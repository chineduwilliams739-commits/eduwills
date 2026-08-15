'use client';

import { ArrowLeft, KeyRound, Phone, ShieldCheck } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-paper px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <a href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17} /> Back to login</a>
        <div className="mx-auto mt-10 max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-eduBlue"><KeyRound size={21}/></div>
          <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Account recovery</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Reset your password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Enter the phone number on your EDUWILLS account. A verification code will be used to confirm your identity.</p>
          <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
            <label className="block text-sm font-bold text-ink">Phone number<div className="relative mt-2"><Phone className="absolute left-4 top-3.5 text-slate-400" size={17}/><input required type="tel" className="w-full rounded-xl border border-slate-200 bg-paper py-3 pl-11 pr-4 outline-none focus:border-eduBlue" placeholder="0800 000 0000" /></div></label>
            <button type="submit" className="w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white">Send verification code</button>
          </form>
          <div className="mt-6 flex gap-3 rounded-2xl bg-slate-50 p-4"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={18}/><p className="text-xs leading-5 text-slate-500">SMS verification and secure password reset will be connected when the backend services are configured.</p></div>
        </div>
      </div>
    </main>
  );
}
