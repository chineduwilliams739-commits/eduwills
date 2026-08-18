'use client';

import { useState } from 'react';
import { ArrowLeft, LockKeyhole, ShieldCheck, KeyRound } from 'lucide-react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const OWNER_ADMIN_UID = 'A45uD8Cu27dI0y0iSWla4CZJBhn1';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const adminRef = doc(db, 'admins', credential.user.uid);
      const admin = await getDoc(adminRef);

      if (!admin.exists() && credential.user.uid === OWNER_ADMIN_UID) {
        await setDoc(adminRef, {
          uid: credential.user.uid,
          email: credential.user.email || email.trim(),
          displayName: credential.user.displayName || '',
          createdAt: serverTimestamp(),
          role: 'owner',
        }, { merge: true });
      } else if (!admin.exists()) {
        await auth.signOut();
        setError(`Firebase Authentication succeeded, but this account (UID ${credential.user.uid}) is not authorized as an EDUWILLS administrator.`);
        setLoading(false);
        return;
      }

      sessionStorage.setItem('eduwills_admin_auth', 'true');
      window.location.replace(`${BASE}/admin/`);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('invalid-login-credentials')) {
        setError('Firebase rejected the email/password. Check that this exact email is an enabled Firebase Authentication account and that the password is correct.');
      } else if (code.includes('user-not-found')) {
        setError('No Firebase Authentication account exists for this email. Create/enable the Admin account in Firebase Authentication first.');
      } else if (code.includes('invalid-email')) {
        setError('Enter a valid Firebase Authentication email address.');
      } else if (code.includes('user-disabled')) {
        setError('This Firebase Authentication account is disabled. Enable it in Firebase Authentication before logging in.');
      } else if (code.includes('too-many-requests')) {
        setError('Firebase temporarily blocked sign-in attempts. Wait a little while and try again.');
      } else if (code.includes('operation-not-allowed')) {
        setError('Email/password sign-in is disabled in Firebase Authentication. Enable the Email/Password provider for EDUWILLS.');
      } else {
        setError(`Admin login failed${code ? ` (${code})` : ''}. Check the Firebase Authentication account and browser console for details.`);
      }
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError('');
    setNotice('');
    const address = email.trim();
    if (!address) {
      setError('Enter your Admin email first, then choose Reset password.');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, address);
      setNotice('Password reset email sent. Check that Admin email inbox and follow the Firebase reset link.');
    } catch (err: any) {
      const code = String(err?.code || '');
      setError(code.includes('user-not-found')
        ? 'No Firebase Authentication account exists for this email, so Firebase cannot send a reset email.'
        : 'Firebase could not send the reset email. Verify the email address and Firebase Authentication settings.');
    } finally {
      setResetting(false);
    }
  }

  return <main className="min-h-screen bg-slate-950 px-5 py-8 text-white"><div className="mx-auto max-w-md"><a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-300"><ArrowLeft size={17}/> Back to EDUWILLS</a><div className="mt-12 rounded-[2rem] border border-white/10 bg-white/5 p-7 shadow-2xl sm:p-9"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><LockKeyhole size={22}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-cyan-200">Secure administration</p><h1 className="mt-2 text-3xl font-black">Admin login</h1><p className="mt-3 text-sm leading-6 text-slate-400">Use the Firebase Authentication email and password belonging to your authorized EDUWILLS Admin account.</p><form onSubmit={login} className="mt-8 space-y-5"><label className="block text-sm font-bold">Admin email<input autoFocus required value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="username" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300" placeholder="admin@example.com"/></label><label className="block text-sm font-bold">Admin password<input required value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300" placeholder="Your Firebase password"/></label>{error&&<p className="rounded-xl bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-200">{error}</p>}{notice&&<p className="rounded-xl bg-emerald-500/10 p-3 text-xs font-bold leading-5 text-emerald-200">{notice}</p>}<button disabled={loading} className="w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-black text-slate-950 disabled:opacity-60">{loading?'Signing in…':'Enter Admin'}</button><button type="button" onClick={resetPassword} disabled={resetting} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-slate-200 disabled:opacity-60"><KeyRound size={16}/>{resetting?'Sending reset email…':'Reset Admin password'}</button></form><div className="mt-6 flex gap-3 rounded-xl bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200"><ShieldCheck size={16} className="shrink-0"/><span>Admin access is checked against the Firebase <strong>admins/{'{UID}'}</strong> document and the protected owner UID.</span></div><p className="mt-5 text-xs leading-5 text-slate-500">The old browser-only <strong>admin</strong> password is not used to authorize Firestore operations.</p></div></div></main>;
}
