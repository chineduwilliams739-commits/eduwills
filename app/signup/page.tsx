'use client';

import { useState } from 'react';
import { ArrowLeft, Check, LockKeyhole, Phone, ShieldCheck } from 'lucide-react';

const BASE = '/eduwills';
const options = [
  { id: 'senior', name: 'Senior Secondary', price: 3000, status: 'Coming soon' },
  { id: 'junior', name: 'Junior Secondary', price: 3000, status: 'Coming soon' },
  { id: 'primary', name: 'Primary', price: 2000, status: 'Coming soon' },
  { id: 'book', name: 'Book Learner', price: 4000, status: 'Available now' },
];

export default function SignUpPage() {
  const [selected, setSelected] = useState<string[]>(['book']);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function toggle(id: string) {
    const item = options.find((x) => x.id === id);
    if (!item || item.status !== 'Available now') return;
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function handlePhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
    setMessage(digits.length > 0 && digits.length !== 10 ? 'Enter exactly 10 digits after +234.' : '');
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const fullName = String(form.get('fullName') || '').trim();
    const username = String(form.get('username') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const confirm = String(form.get('confirmPassword') || '');

    if (phone.length !== 10) { setMessage('Invalid phone number. Enter exactly 10 digits after +234.'); return; }
    if (!fullName || !username || password.length < 6) { setMessage('Please complete your name, username and password. Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setMessage('The passwords do not match.'); return; }
    if (selected.length === 0) { setMessage('Choose the Book Learner category.'); return; }

    const users = JSON.parse(localStorage.getItem('eduwills_users') || '[]');
    if (users.some((u: { username: string }) => u.username === username)) { setMessage('That username is already registered.'); return; }
    if (users.some((u: { phone: string }) => u.phone === phone)) { setMessage('That phone number is already registered.'); return; }

    users.push({ fullName, username, phone, password, categories: selected, activated: false, createdAt: new Date().toISOString() });
    localStorage.setItem('eduwills_users', JSON.stringify(users));
    localStorage.setItem('eduwills_current_user', username);
    window.location.href = `${BASE}/dashboard/`;
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <a href={`${BASE}/`} className="mx-auto flex w-fit items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Back to EDUWILLS</a>
        <div className="mx-auto mt-6 grid w-full max-w-5xl overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-soft sm:mt-8 sm:rounded-[2rem] lg:grid-cols-[.82fr_1.18fr]">
          <aside className="hidden bg-ink p-10 text-white lg:block"><div className="text-2xl font-black">EDUWILLS</div><div className="mt-16 max-w-sm"><div className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Create your learning account</div><h1 className="mt-4 text-4xl font-black leading-tight">Start free. Activate when you're ready.</h1><p className="mt-5 leading-7 text-slate-300">Registration is free. Quiz, History and EDUWILLS AI become available after activation.</p></div><div className="mt-12 space-y-4 text-sm text-slate-300">{['Free account creation','No SMS or paid verification','Activate later with WilliToken'].map((item)=><div key={item} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-cyan-200"><Check size={14}/></span>{item}</div>)}</div></aside>
          <section className="min-w-0 p-5 sm:p-8 md:p-10"><div className="mx-auto w-full max-w-xl"><p className="text-xs font-black uppercase tracking-[.2em] text-eduBlue">Free registration</p><h2 className="mt-2 text-3xl font-black tracking-tight text-ink">Join EDUWILLS</h2><p className="mt-2 text-sm leading-6 text-slate-500">Create your account for free. You can activate it later.</p>
            <form className="mt-7 space-y-5" onSubmit={submit}>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm font-bold text-ink">Full name<input name="fullName" required className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Your full name"/></label><label className="min-w-0 text-sm font-bold text-ink">Username<input name="username" required className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Choose a username"/></label></div>
              <label className="block text-sm font-bold text-ink">Phone number<div className="mt-2 flex w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-paper"><span className="flex shrink-0 items-center border-r border-slate-200 px-3 text-sm font-black text-slate-500">+234</span><div className="relative min-w-0 flex-1"><Phone className="absolute left-3 top-3.5 text-slate-400" size={17}/><input required name="phone" type="tel" inputMode="numeric" value={phone} onChange={(e)=>handlePhone(e.target.value)} maxLength={10} className="block w-full min-w-0 bg-transparent py-3 pl-10 pr-3 outline-none" placeholder="8012345678"/></div></div><span className={`mt-1 block text-xs font-normal ${phone && phone.length !== 10 ? 'text-red-500' : 'text-slate-400'}`}>{phone && phone.length !== 10 ? `Enter ${10-phone.length} more digit${10-phone.length===1?'':'s'}.` : 'Enter exactly 10 digits after +234.'}</span></label>
              <div><div className="mb-3 flex items-center justify-between"><span className="text-sm font-bold text-ink">Choose learning category</span><span className="text-xs font-bold text-slate-400">Available categories</span></div><div className="space-y-2">{options.map((item)=>{const active=selected.includes(item.id);const locked=item.status!=='Available now';return <button type="button" key={item.id} onClick={()=>toggle(item.id)} className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition sm:p-4 ${active?'border-blue-200 bg-blue-50/70':'border-slate-200 bg-white'} ${locked?'cursor-not-allowed opacity-60':'hover:border-blue-200'}`}><span className="flex min-w-0 items-center gap-3"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${active?'border-eduBlue bg-eduBlue text-white':'border-slate-300'}`}>{active&&<Check size={13}/>}</span><span className="min-w-0"><span className="block text-sm font-bold text-ink">{item.name}</span><span className="block text-xs text-slate-400">{locked?<span className="inline-flex items-center gap-1"><LockKeyhole size={11}/> {item.status}</span>:`Activation: ₦${item.price.toLocaleString()}`}</span></span></span><span className="shrink-0 pl-2 text-xs font-bold text-slate-500">{locked?'Locked':'Selected'}</span></button>})}</div></div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm font-bold text-ink">Password<div className="relative mt-2"><input name="password" required minLength={6} type={showPassword?'text':'password'} className="block w-full min-w-0 rounded-xl border border-slate-200 bg-paper px-4 py-3 pr-16 outline-none focus:border-eduBlue" placeholder="Create a password"/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-3 text-xs font-bold text-eduBlue">{showPassword?'Hide':'Show'}</button></div></label><label className="min-w-0 text-sm font-bold text-ink">Confirm password<input name="confirmPassword" required minLength={6} type={showPassword?'text':'password'} className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Repeat password"/></label></div>
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={18}/><p className="text-xs leading-5 text-slate-500">Your account is created for free. Quiz, History and EDUWILLS AI remain locked until activation. Activation and Personal remain accessible.</p></div>
              {message&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-600">{message}</p>}
              <button type="submit" className="w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white shadow-lg shadow-blue-100">Create free account</button>
              <p className="text-center text-sm text-slate-500">Already have an account? <a href={`${BASE}/login/`} className="font-bold text-eduBlue">Log in</a></p>
            </form>
          </div></section>
        </div>
      </div>
    </main>
  );
}
