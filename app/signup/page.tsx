'use client';

import { useState } from 'react';
import { ArrowLeft, Check, LockKeyhole, Phone, ShieldCheck } from 'lucide-react';

const options = [
  { id: 'senior', name: 'Senior Secondary', price: 3000, status: 'Coming soon' },
  { id: 'junior', name: 'Junior Secondary', price: 3000, status: 'Coming soon' },
  { id: 'primary', name: 'Primary', price: 2000, status: 'Coming soon' },
  { id: 'book', name: 'Book Learner', price: 4000, status: 'Available now' },
];

export default function SignUpPage() {
  const [selected, setSelected] = useState<string[]>(['book']);
  const [showPassword, setShowPassword] = useState(false);

  const toggle = (id: string) => {
    const item = options.find((x) => x.id === id);
    if (!item || item.status !== 'Available now') return;
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  };

  return (
    <main className="min-h-screen bg-paper px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17} /> Back to EDUWILLS</a>
        <div className="mt-8 grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft lg:grid-cols-[.85fr_1.15fr]">
          <aside className="hidden bg-ink p-10 text-white lg:block">
            <div className="text-2xl font-black">EDUWILLS</div>
            <div className="mt-16 max-w-sm"><div className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Create your learning account</div><h1 className="mt-4 text-4xl font-black leading-tight">Start free. Activate when you're ready.</h1><p className="mt-5 leading-7 text-slate-300">Registration is free. Your learning features remain locked until your account is activated with a valid WilliToken.</p></div>
            <div className="mt-12 space-y-4 text-sm text-slate-300">{['Free account creation', 'Activate later with WilliToken', 'Personal account always available'].map((x) => <div key={x} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-cyan-200"><Check size={14} /></span>{x}</div>)}</div>
          </aside>
          <section className="p-6 sm:p-10">
            <div className="max-w-xl"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">Free registration</p><h2 className="mt-2 text-3xl font-black tracking-tight text-ink">Join EDUWILLS</h2><p className="mt-2 text-sm text-slate-500">Create your account without paying an activation fee. You can activate later from the Activation page.</p></div>
            <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-ink">Full name<input required className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Your full name" /></label><label className="text-sm font-bold text-ink">Username<input required className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Choose a username" /></label></div>
              <label className="block text-sm font-bold text-ink">Phone number<div className="relative mt-2"><Phone className="absolute left-4 top-3.5 text-slate-400" size={17}/><input required type="tel" className="w-full rounded-xl border border-slate-200 bg-paper py-3 pl-11 pr-4 outline-none focus:border-eduBlue" placeholder="0800 000 0000" /></div><span className="mt-1 block text-xs font-normal text-slate-400">WhatsApp access is required for activation proof notifications.</span></label>
              <div><div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-ink">Choose learning category</span><span className="text-xs font-bold text-slate-400">You can select available categories</span></div><div className="space-y-2">{options.map((item) => { const active = selected.includes(item.id); const locked = item.status !== 'Available now'; return <button type="button" key={item.id} onClick={() => toggle(item.id)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${active ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white'} ${locked ? 'cursor-not-allowed opacity-60' : 'hover:border-blue-200'}`}><span className="flex items-center gap-3"><span className={`grid h-5 w-5 place-items-center rounded-md border ${active ? 'border-eduBlue bg-eduBlue text-white' : 'border-slate-300'}`}>{active && <Check size={13}/>}</span><span><span className="block text-sm font-bold text-ink">{item.name}</span><span className="block text-xs text-slate-400">{locked ? <span className="inline-flex items-center gap-1"><LockKeyhole size={11}/> {item.status}</span> : '₦4,000 activation when available'}</span></span><span className="text-sm font-black text-ink">{locked ? 'Locked' : 'Selected'}</span></button> })}</div></div>
              <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-ink">Password<div className="relative mt-2"><input required type={showPassword ? 'text' : 'password'} className="w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 pr-20 outline-none focus:border-eduBlue" placeholder="Create a password"/><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-xs font-bold text-eduBlue">{showPassword ? 'Hide' : 'Show'}</button></div></label><label className="text-sm font-bold text-ink">Confirm password<input required type={showPassword ? 'text' : 'password'} className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Repeat password" /></label></div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><ShieldCheck className="mt-0.5 text-emerald-600" size={18}/><p className="text-xs leading-5 text-slate-500">After registration, Quiz, History and other learning features remain locked until activation. Activation and Personal remain accessible.</p></div>
              <button type="submit" className="w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white shadow-lg shadow-blue-100">Create free account</button>
              <p className="text-center text-sm text-slate-500">Already have an account? <a href="/login" className="font-bold text-eduBlue">Log in</a></p>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
