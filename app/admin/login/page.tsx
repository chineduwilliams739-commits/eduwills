'use client';

import { useState } from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';

const BASE = '/eduwills';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = localStorage.getItem('eduwills_admin_password') || 'admin';
    if (password === saved) {
      sessionStorage.setItem('eduwills_admin_auth', 'true');
      window.location.href = `${BASE}/admin/`;
    } else setError('Incorrect admin password.');
  };

  return <main className="min-h-screen bg-slate-950 px-5 py-8 text-white"><div className="mx-auto max-w-md"><a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-300"><ArrowLeft size={17}/> Back to EDUWILLS</a><div className="mt-12 rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-2xl sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><LockKeyhole size={22}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-cyan-200">Restricted area</p><h1 className="mt-2 text-3xl font-black">Admin login</h1><p className="mt-3 text-sm leading-6 text-slate-400">This page is separate from the normal EDUWILLS login.</p><form onSubmit={login} className="mt-8"><label className="text-sm font-bold">Admin password<input autoFocus value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300" placeholder="Enter admin password"/></label>{error && <p className="mt-3 text-xs font-bold text-red-300">{error}</p>}<button className="mt-5 w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-black text-slate-950">Enter Admin</button></form><p className="mt-5 rounded-xl bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">Temporary password: <strong>admin</strong>. Change it from Admin Settings after signing in.</p></div></div></main>;
}
