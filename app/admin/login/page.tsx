'use client';

import { useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const admin = await getDoc(doc(db, 'admins', credential.user.uid));
      if (!admin.exists()) { await auth.signOut(); setError('This Firebase account is not authorized as an EDUWILLS administrator.'); setLoading(false); return; }
      sessionStorage.setItem('eduwills_admin_auth', 'true');
      window.location.replace(`${BASE}/admin/`);
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : '';
      setError(text.includes('invalid-credential') || text.includes('invalid-email') ? 'Admin email or password is incorrect.' : 'Admin login failed. Check the Firebase Authentication account.');
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-slate-950 px-5 py-8 text-white"><div className="mx-auto max-w-md"><a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-300"><ArrowLeft size={17}/> Back to EDUWILLS</a><div className="mt-12 rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-2xl sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><LockKeyhole size={22}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-cyan-200">Secure administration</p><h1 className="mt-2 text-3xl font-black">Admin login</h1><p className="mt-3 text-sm leading-6 text-slate-400">Use the Firebase Authentication email and password belonging to your authorized EDUWILLS Admin account.</p><form onSubmit={login} className="mt-8 space-y-5"><label className="block text-sm font-bold">Admin email<input autoFocus required value={email} onChange={e=>setEmail(e.target.value)} type="email" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300" placeholder="admin@example.com"/></label><label className="block text-sm font-bold">Admin password<input required value={password} onChange={e=>setPassword(e.target.value)} type="password" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300" placeholder="Your Firebase password"/></label>{error&&<p className="rounded-xl bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-200">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-black text-slate-950 disabled:opacity-60">{loading?'Signing in…':'Enter Admin'}</button></form><div className="mt-6 flex gap-3 rounded-xl bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200"><ShieldCheck size={16} className="shrink-0"/><span>Admin access is checked against the Firebase <strong>admins/{'{UID}'}</strong> document.</span></div><p className="mt-5 text-xs leading-5 text-slate-500">The old browser-only <strong>admin</strong> password is no longer used to authorize Firestore operations.</p></div></div></main>;
}
