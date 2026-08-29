'use client';

import { useEffect, useState } from 'react';
import { Mail, CheckCircle2, ArrowRight, LogOut } from 'lucide-react';
import { onAuthStateChanged, signOut, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE='/eduwills';
const LEGACY_EMAIL_SUFFIX='@accounts.eduwills.app';

export default function CompleteEmailPage(){
  const [email,setEmail]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [verified,setVerified]=useState(false);

  useEffect(()=>{
    const unsubscribe=onAuthStateChanged(auth,async u=>{
      if(!u){window.location.replace(`${BASE}/login/`);return;}
      try{
        await u.reload();
        const current=auth.currentUser;
        if(!current){window.location.replace(`${BASE}/login/`);return;}
        const currentEmail=String(current.email||'').toLowerCase();
        if(currentEmail && !currentEmail.endsWith(LEGACY_EMAIL_SUFFIX)){
          if(current.emailVerified){
            const snap=await getDoc(doc(db,'users',current.uid));
            const profile=snap.exists()?snap.data():{};
            await setDoc(doc(db,'users',current.uid),{email:current.email,authEmail:current.email,emailVerified:true,emailVerifiedAt:new Date()},{merge:true});
            const phone=String(profile.phoneE164||'');
            if(phone) await setDoc(doc(db,'phoneIndex',phone),{uid:current.uid,authEmail:current.email,username:profile.username||'',phoneE164:phone},{merge:true});
            setVerified(true);
          } else setMessage('Please verify the real email address sent to you before continuing.');
        }
      }catch(e){console.error(e);setMessage('We could not load your account. Please try again.');}
      finally{setLoading(false);}
    });
    return()=>unsubscribe();
  },[]);

  async function sendVerification(){
    setMessage('');
    const normalized=email.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)){setMessage('Enter a valid email address.');return;}
    if(!auth.currentUser){setMessage('Your session has expired. Please sign in again.');return;}
    if(normalized.endsWith(LEGACY_EMAIL_SUFFIX)){setMessage('Please use your real personal email address.');return;}
    setSending(true);
    try{
      await verifyBeforeUpdateEmail(auth.currentUser,normalized);
      setMessage(`Verification email sent to ${normalized}. Open it and click the verification link, then return here and press “I verified my email”.`);
    }catch(e:any){
      const code=e?.code||'';
      if(code==='auth/email-already-in-use')setMessage('That email is already attached to another EDUWILLS account. Please use a different email address.');
      else if(code==='auth/requires-recent-login')setMessage('For security, please sign out and sign in again, then enter your real email address.');
      else setMessage('Could not send the verification email. Please try again.');
    }finally{setSending(false);}
  }

  async function checkVerification(){
    setMessage('');
    if(!auth.currentUser)return;
    try{
      await auth.currentUser.reload();
      const u=auth.currentUser;
      const currentEmail=String(u?.email||'');
      if(!u?.emailVerified || !currentEmail || currentEmail.toLowerCase().endsWith(LEGACY_EMAIL_SUFFIX)){
        setMessage('Your real email is not verified yet. Open the latest verification email and click its link.');
        return;
      }
      const snap=await getDoc(doc(db,'users',u.uid));
      const profile=snap.exists()?snap.data():{};
      await setDoc(doc(db,'users',u.uid),{email:currentEmail,authEmail:currentEmail,emailVerified:true,emailVerifiedAt:new Date()},{merge:true});
      const phone=String(profile.phoneE164||'');
      if(phone)await setDoc(doc(db,'phoneIndex',phone),{uid:u.uid,authEmail:currentEmail,username:profile.username||'',phoneE164:phone},{merge:true});
      setVerified(true);
    }catch(e){console.error(e);setMessage('We could not confirm the verification yet. Please try again.');}
  }

  async function logout(){await signOut(auth);window.location.replace(`${BASE}/`);}

  if(loading)return <main className="min-h-screen bg-paper grid place-items-center px-5"><div className="rounded-2xl bg-white px-6 py-5 text-sm font-bold text-slate-600 shadow-soft">Checking your account…</div></main>;

  return <main className="min-h-screen bg-paper px-5 py-10 sm:px-8"><div className="mx-auto max-w-lg"><div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-50 text-cyan-600"><Mail size={25}/></div><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-eduBlue">Email required</p><h1 className="mt-2 text-3xl font-black tracking-tight text-ink">Add your real email address</h1><p className="mt-3 text-sm leading-6 text-slate-500">Your EDUWILLS account was created with an old internal account identifier. That identifier is not a real email address and must never be treated as a verified email. Enter an email address you actually own so we can verify it.</p>{verified?<div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-3 text-emerald-700"><CheckCircle2 size={22}/><span className="font-black">Email verified successfully.</span></div><p className="mt-2 text-sm leading-6 text-emerald-800">Your real email is now attached to your EDUWILLS account.</p><a href={`${BASE}/dashboard/`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-sm font-black text-white">Continue to EDUWILLS <ArrowRight size={16}/></a></div>:<><label className="mt-7 block text-sm font-bold text-ink">Real email address<input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3.5 outline-none focus:border-eduBlue"/><span className="mt-1 block text-xs font-normal text-slate-400">This must be an email address you can open and verify.</span></label><button type="button" onClick={sendVerification} disabled={sending} className="mt-5 w-full rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white disabled:opacity-60">{sending?'Sending verification…':'Send verification email'}</button><button type="button" onClick={checkVerification} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700">I verified my email</button>{message&&<p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-700">{message}</p>}</>}<button type="button" onClick={logout} className="mt-6 inline-flex w-full items-center justify-center gap-2 text-sm font-bold text-slate-500"><LogOut size={15}/> Sign out</button></div></div></main>;
}
