'use client';

import { useState } from 'react';
import { ArrowLeft, Check, LockKeyhole, Phone, ShieldCheck, MessageSquareText } from 'lucide-react';

const BASE = '/eduwills';
const options = [
  { id: 'senior', name: 'Senior Secondary', price: 3000, status: 'Coming soon' },
  { id: 'junior', name: 'Junior Secondary', price: 3000, status: 'Coming soon' },
  { id: 'primary', name: 'Primary', price: 2000, status: 'Coming soon' },
  { id: 'book', name: 'Book Learner', price: 4000, status: 'Available now' },
];

export default function SignUpPage() {
  const [selected, setSelected] = useState<string[]>(['book']);
  const [showPassword, setShowPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  function toggle(id: string) {
    const item = options.find((x) => x.id === id);
    if (!item || item.status !== 'Available now') return;
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function handlePhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    setCodeSent(false);
    setVerified(false);
    setMessage(digits.length > 0 && digits.length !== 10 ? 'Enter exactly 10 digits after +234.' : '');
  }

  function sendCode() {
    if (phone.length !== 10) {
      setMessage('Invalid Nigerian phone number. Enter exactly 10 digits after +234.');
      return;
    }
    setCodeSent(true);
    setMessage('Verification code requested. Real SMS delivery will be connected when a backend is added.');
  }

  function verifyCode() {
    if (code.length === 6) {
      setVerified(true);
      setMessage('Phone verified for this preview.');
    } else setMessage('Enter the 6-digit verification code.');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length !== 10) { setMessage('Please enter exactly 10 digits after +234.'); return; }
    if (!verified) { setMessage('Please verify your phone number before registering.'); return; }
    setMessage('Registration is ready for the secure account backend.');
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-6 sm:px-8"><div className="mx-auto max-w-6xl"><a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Back to EDUWILLS</a><div className="mt-8 grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft lg:grid-cols-[.85fr_1.15fr]"><aside className="hidden bg-ink p-10 text-white lg:block"><div className="text-2xl font-black">EDUWILLS</div><div className="mt-16 max-w-sm"><div className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Create your learning account</div><h1 className="mt-4 text-4xl font-black leading-tight">Start free. Activate when you're ready.</h1><p className="mt-5 leading-7 text-slate-300">Registration is free. Quiz and History become available after activation.</p></div><div className="mt-12 space-y-4 text-sm text-slate-300">{['Free account creation','Phone verification before registration','Activate later with WilliToken'].map((item)=><div key={item} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-cyan-200"><Check size={14}/></span>{item}</div>)}</div></aside><section className="p-6 sm:p-10"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">Free registration</p><h2 className="mt-2 text-3xl font-black tracking-tight text-ink">Join EDUWILLS</h2><p className="mt-2 text-sm text-slate-500">Create your account without paying an activation fee. Verify your phone first.</p><form className="mt-8 space-y-5" onSubmit={submit}><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-ink">Full name<input required className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Your full name"/></label><label className="text-sm font-bold text-ink">Username<input required className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Choose a username"/></label></div><label className="block text-sm font-bold text-ink">Phone number<div className="mt-2 flex gap-2"><div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-paper"><span className="flex items-center border-r border-slate-200 px-3 text-sm font-black text-slate-500">+234</span><div className="relative flex-1"><Phone className="absolute left-3 top-3.5 text-slate-400" size={17}/><input required type="tel" inputMode="numeric" value={phone} onChange={(e)=>handlePhone(e.target.value)} maxLength={10} className="w-full bg-transparent py-3 pl-10 pr-3 outline-none focus:border-eduBlue" placeholder="8012345678"/></div></div><button type="button" onClick={sendCode} className="shrink-0 rounded-xl bg-ink px-4 text-xs font-black text-white">{codeSent?'Resend code':'Send code'}</button></div><span className={`mt-1 block text-xs font-normal ${phone && phone.length !== 10 ? 'text-red-500' : 'text-slate-400'}`}>{phone && phone.length !== 10 ? `Enter ${10-phone.length} more digit${10-phone.length===1?'':'s'}.` : 'Enter your 10-digit Nigerian number after +234.'}</span></label><div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div className="flex items-center gap-2 text-sm font-black text-ink"><MessageSquareText size={17} className="text-eduBlue"/> Verify your phone</div><div className="mt-3 flex gap-2"><input value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" maxLength={6} disabled={!codeSent} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center tracking-[.35em] outline-none focus:border-eduBlue" placeholder="000000"/><button type="button" disabled={!codeSent} onClick={verifyCode} className="rounded-xl bg-eduBlue px-4 text-xs font-black text-white disabled:opacity-40">Verify</button></div>{message&&<p className={`mt-2 text-xs ${verified?'text-emerald-600':'text-slate-500'}`}>{message}</p>}</div><div><div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-ink">Choose learning category</span><span className="text-xs font-bold text-slate-400">Available categories</span></div><div className="space-y-2">{options.map((item)=>{const active=selected.includes(item.id);const locked=item.status!=='Available now';return <button type="button" key={item.id} onClick={()=>toggle(item.id)} className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${active?'border-blue-200 bg-blue-50/70':'border-slate-200 bg-white'} ${locked?'cursor-not-allowed opacity-60':'hover:border-blue-200'}`}><span className="flex items-center gap-3"><span className={`grid h-5 w-5 place-items-center rounded-md border ${active?'border-eduBlue bg-eduBlue text-white':'border-slate-300'}`}>{active&&<Check size={13}/>}</span><span><span className="block text-sm font-bold text-ink">{item.name}</span><span className="block text-xs text-slate-400">{locked?<span className="inline-flex items-center gap-1"><LockKeyhole size={11}/> {item.status}</span>:`Activation: ₦${item.price.toLocaleString()}`}</span></span></span><span className="text-xs font-bold text-slate-500">{locked?'Locked':'Selected'}</span></button>})}</div></div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold text-ink">Password<div className="relative mt-2"><input required type={showPassword?'text':'password'} className="w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 pr-20 outline-none focus:border-eduBlue" placeholder="Create a password"/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-3 text-xs font-bold text-eduBlue">{showPassword?'Hide':'Show'}</button></div></label><label className="text-sm font-bold text-ink">Confirm password<input required type={showPassword?'text':'password'} className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Repeat password"/></label></div><div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><ShieldCheck className="mt-0.5 text-emerald-600" size={18}/><p className="text-xs leading-5 text-slate-500">After registration, Quiz and History remain locked until activation. Activation and Personal remain accessible.</p></div><button type="submit" disabled={!verified} className="w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white shadow-lg shadow-blue-100 disabled:cursor-not-allowed disabled:opacity-50">{verified?'Create free account':'Verify phone to register'}</button><p className="text-center text-sm text-slate-500">Already have an account? <a href={`${BASE}/login/`} className="font-bold text-eduBlue">Log in</a></p></form></section></div></div></main>
  );
}
