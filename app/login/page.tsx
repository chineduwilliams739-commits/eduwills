'use client';

import { useState } from 'react';
import { ArrowLeft, LockKeyhole, Mail, Phone } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const LEGACY_EMAIL_SUFFIX = '@accounts.eduwills.app';

export default function LoginPage() {
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState<string | undefined>('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function completeLogin(uid: string, authEmail: string) {
    const profileSnap = await getDoc(doc(db, 'users', uid));
    if (!profileSnap.exists()) {
      await signOut(auth);
      setMessage('Your Firebase login exists, but your EDUWILLS profile is missing. Please contact the administrator.');
      return false;
    }

    const profile = profileSnap.data() as {
      phone?: string;
      phoneE164?: string;
      username?: string;
      authEmail?: string;
      email?: string;
    };

    const realEmail = String(authEmail || profile.authEmail || profile.email || '').toLowerCase();
    const profilePhone = profile.phoneE164 || (profile.phone ? `+${profile.phone}` : '');

    if (realEmail && !realEmail.endsWith(LEGACY_EMAIL_SUFFIX) && profilePhone) {
      await setDoc(doc(db, 'phoneIndex', profilePhone), {
        uid,
        authEmail: realEmail,
        username: profile.username || '',
        phoneE164: profilePhone,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    localStorage.setItem('eduwills_current_user', profile.username || '');
    localStorage.setItem('eduwills_current_uid', uid);
    window.location.href = `${BASE}/dashboard/`;
    return true;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    const password = String(new FormData(e.currentTarget).get('password') || '');

    if (mode === 'email') {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setMessage('Enter a valid email address.');
        return;
      }
      setLoading(true);
      try {
        const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        if (String(credential.user.email || '').toLowerCase().endsWith(LEGACY_EMAIL_SUFFIX)) {
          await signOut(auth);
          setMessage('This account still uses an old internal email identifier. Please add and verify your real email first.');
          return;
        }
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user).catch(() => undefined);
          await signOut(auth);
          setMessage('Please verify your email before logging in. A fresh verification link has been sent.');
          return;
        }
        await completeLogin(credential.user.uid, credential.user.email || normalizedEmail);
      } catch (error: unknown) {
        const code = error instanceof Error ? error.message : '';
        if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) setMessage('Email or password is incorrect.');
        else if (code.includes('permission-denied')) setMessage('Login is temporarily unavailable because Firebase rules are blocking the required account lookup.');
        else setMessage('Unable to log in. Please check your details and try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!phone || !isValidPhoneNumber(phone)) {
      setMessage('Enter a valid phone number and select the correct country code.');
      return;
    }

    setLoading(true);
    try {
      let authEmail = '';
      let username = '';
      let expectedUid = '';
      let indexed = false;
      const legacyKey = phone.replace(/^\+/, '');
      let indexSnap = await getDoc(doc(db, 'phoneIndex', phone));
      if (!indexSnap.exists()) indexSnap = await getDoc(doc(db, 'phoneIndex', legacyKey));

      if (indexSnap.exists()) {
        indexed = true;
        const index = indexSnap.data() as { uid?: string; authEmail?: string; username?: string };
        authEmail = index.authEmail || '';
        username = index.username || '';
        expectedUid = index.uid || '';
      }

      if (!authEmail) {
        setMessage('No EDUWILLS account was found for that phone number.');
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, authEmail, password);
      const profileSnap = await getDoc(doc(db, 'users', credential.user.uid));
      if (!profileSnap.exists()) {
        await signOut(auth);
        setMessage('Your Firebase login exists, but your EDUWILLS profile is missing. Please contact the administrator.');
        return;
      }

      const profile = profileSnap.data() as { phone?: string; phoneE164?: string; username?: string; authEmail?: string; email?: string };
      const profilePhone = profile.phoneE164 || (profile.phone ? `+${profile.phone}` : '');
      if (profilePhone && profilePhone !== phone && profile.phone !== legacyKey) {
        await signOut(auth);
        setMessage('That phone number is not linked to this account.');
        return;
      }
      if (expectedUid && credential.user.uid !== expectedUid) {
        await signOut(auth);
        setMessage('This phone number is not linked to that account.');
        return;
      }

      const currentAuthEmail = String(credential.user.email || authEmail).toLowerCase();
      if (currentAuthEmail.endsWith(LEGACY_EMAIL_SUFFIX)) {
        await signOut(auth);
        setMessage('This account needs a real verified email before phone login can continue. Use “Sign in with email” after verifying your email.');
        return;
      }

      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user).catch(() => undefined);
        await signOut(auth);
        setMessage('Please verify your email before logging in. A fresh verification link has been sent to your email.');
        return;
      }

      username = profile.username || username;
      await setDoc(doc(db, 'phoneIndex', phone), {
        uid: credential.user.uid,
        authEmail: currentAuthEmail,
        username,
        phoneE164: phone,
        migratedAt: new Date().toISOString()
      }, { merge: true });
      localStorage.setItem('eduwills_current_user', username);
      localStorage.setItem('eduwills_current_uid', credential.user.uid);
      window.location.href = `${BASE}/dashboard/`;
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message : '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) setMessage('Phone number or password is incorrect.');
      else if (code.includes('permission-denied')) setMessage('Login is temporarily unavailable because Firebase rules are blocking the required account lookup.');
      else setMessage('Unable to log in. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="min-h-screen bg-paper px-5 py-6 sm:px-8">
    <style>{`.eduwills-phone .PhoneInput{display:flex;align-items:center;width:100%;min-height:54px}.eduwills-phone .PhoneInputCountry{position:relative;display:flex;align-items:center;gap:7px;padding:0 12px;border-right:1px solid #cbd5e1;min-height:54px;background:#f8fafc;flex:0 0 auto}.eduwills-phone .PhoneInputCountrySelect{position:absolute;inset:0;width:100%;height:100%;cursor:pointer;opacity:0}.eduwills-phone .PhoneInputCountrySelectArrow{margin-left:3px;width:8px;height:8px;border-right:2px solid #475569;border-bottom:2px solid #475569;transform:rotate(45deg) translateY(-2px)}.eduwills-phone .PhoneInputInput{min-width:0;flex:1;border:0;background:transparent;padding:15px 14px;outline:0;font-size:.95rem;color:#0f172a}.eduwills-phone .PhoneInputInput::placeholder{color:#94a3b8}.eduwills-phone .PhoneInputCountryIcon{width:24px;height:18px;overflow:hidden}`}</style>
    <div className="mx-auto max-w-5xl">
      <a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Back to EDUWILLS</a>
      <div className="mx-auto mt-10 max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><LockKeyhole size={21}/></div>
        <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Welcome back</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Log in to EDUWILLS</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Use your phone number or your verified email address and password.</p>
        <div className="mt-7 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => { setMode('phone'); setMessage(''); }} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black ${mode === 'phone' ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}><Phone size={14}/> Phone</button>
          <button type="button" onClick={() => { setMode('email'); setMessage(''); }} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-black ${mode === 'email' ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}><Mail size={14}/> Email</button>
        </div>
        <form className="mt-6 space-y-5" onSubmit={submit}>
          {mode === 'phone' ? <label className="block text-sm font-bold text-ink">Phone number<div className="eduwills-phone mt-2 overflow-hidden rounded-xl border border-slate-200 bg-paper shadow-sm"><PhoneInput international defaultCountry="NG" countryCallingCodeEditable={false} value={phone} onChange={setPhone} placeholder="Enter your phone number"/></div><span className="mt-1 block text-xs font-normal text-slate-400">Select your country code from the country selector.</span></label> : <label className="block text-sm font-bold text-ink">Verified email address<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue"/><span className="mt-1 block text-xs font-normal text-slate-400">Use the real email address you verified on this account.</span></label>}
          <label className="block text-sm font-bold text-ink">Password<input name="password" required type="password" autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="Your password"/></label>
          <div className="text-right"><a href={`${BASE}/forgot-password/`} className="text-xs font-bold text-eduBlue">Forgot password?</a></div>
          {message && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-600">{message}</p>}
          <button disabled={loading} type="submit" className="w-full rounded-xl bg-ink px-5 py-3.5 font-black text-white disabled:opacity-60">{loading ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">New to EDUWILLS? <a href={`${BASE}/signup/`} className="font-bold text-eduBlue">Create an account</a></p>
      </div>
    </div>
  </main>;
}
