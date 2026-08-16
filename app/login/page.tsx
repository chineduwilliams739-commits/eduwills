'use client';

import { useState } from 'react';
import { ArrowLeft, LockKeyhole, Phone } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    const password = String(new FormData(e.currentTarget).get('password') || '');
    if (phone.length !== 10) { setMessage('Enter exactly 10 digits after +234.'); return; }
    setLoading(true);
    try {
      let authEmail = '';
      let username = '';
      let expectedUid = '';

      // Current accounts: public phone index maps the phone to Firebase Auth.
      const indexSnap = await getDoc(doc(db, 'phoneIndex', phone));
      if (indexSnap.exists()) {
        const index = indexSnap.data() as { uid?: string; authEmail?: string; username?: string };
        authEmail = index.authEmail || '';
        username = index.username || '';
        expectedUid = index.uid || '';
      }

      // Legacy accounts created before phoneIndex existed can still be logged into
      // on the same device because registration stored the username locally. This
      // preserves the original phone + password login experience without exposing
      // the entire users collection to unauthenticated visitors.
      if (!authEmail) {
        const legacyUsername = localStorage.getItem('eduwills_current_user') || '';
        if (legacyUsername) {
          authEmail = `${legacyUsername}@accounts.eduwills.app`;
          username = legacyUsername;
        }
      }

      if (!authEmail) {
        setMessage('No EDUWILLS account was found for that phone number. If this is an older account, open EDUWILLS on the device where you registered once so we can migrate its login record.');
        setLoading(false);
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, authEmail, password);
      if (expectedUid && credential.user.uid !== expectedUid) {
        await auth.signOut();
        setMessage('This phone number is not linked to that account.');
        setLoading(false);
        return;
      }

      // Repair/migrate the phone index after a successful legacy login.
      if (!indexSnap.exists()) {
        await import('firebase/firestore').then(({ setDoc }) => setDoc(doc(db, 'phoneIndex', phone), {
          uid: credential.user.uid,
          authEmail,
          username,
          migratedAt: new Date().toISOString(),
        }, { merge: true })).catch(() => {
          // Authentication succeeded; a temporary rules/index issue must not log the user out.
        });
      }

      localStorage.setItem('eduwills_current_user', username);
      localStorage.setItem('eduwills_current_uid', credential.user.uid);
      window.location.href = `${BASE}/dashboard/`;
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) setMessage('Phone number or password is incorrect.');
      else if (code.includes('permission-denied')) setMessage('Login is temporarily unavailable because the Firebase phone lookup is not readable. Publish the latest Firestore rules.');
      else setMessage('Unable to log in. Please check your details and try again.');
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-paper px-5 py-6 sm:px-8"><div className="mx-auto max-w-5xl"><a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Back to EDUWILLS</a><div className="mx-auto mt-10 max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><LockKeyhole size={21}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Welcome back</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Log in to EDUWILLS</h1><p className="mt-2 text-sm leading-6 text-slate-500">Use your registered phone number and password to continue.</p><form className="mt-8 space-y-5" onSubmit={submit}><label className="block text-sm font-bold text-ink">Phone number<div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200 bg-paper"><span className="flex items-center border-r border-slate-200 px-3 text-sm font-black text-slate-500">+234</span><div className="relative flex-1"><Phone className="absolute left-3 top-3.5 text-slate-400" size={17}/><input required type="tel" inputMode="numeric" value={phone} onChange={(e)=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} maxLength={10} className="w-full bg-transparent py-3 pl-10 pr-3 outline-none" placeholder="8012345678"/></div></div><span className="mt-1 block text-xs font-normal text-slate-400">Enter exactly 10 digits after +234.</span></label><label className="block text-sm font-bold text-ink">Password<input name="password" required type="password" className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Your password"/></label><div className="text-right"><a href={`${BASE}/forgot-password/`} className="text-xs font-bold text-eduBlue">Forgot password?</a></div>{message&&<p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{message}</p>}<button disabled={loading} type="submit" className="w-full rounded-xl bg-ink px-5 py-3.5 font-black text-white disabled:opacity-60">{loading?'Logging in…':'Log in'}</button></form><p className="mt-6 text-center text-sm text-slate-500">New to EDUWILLS? <a href={`${BASE}/signup/`} className="font-bold text-eduBlue">Create an account</a></p></div></div></main>;
}
