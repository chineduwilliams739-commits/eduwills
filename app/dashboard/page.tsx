'use client';

import { BookOpen, Clock3, LogOut, Menu, UserRound, WalletCards, X, Sparkles, ArrowRight, LockKeyhole, Bot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE='/eduwills';
const nav: {name:string; icon:LucideIcon; href:string}[]=[
  {name:'QUIZ',icon:Sparkles,href:`${BASE}/dashboard/`},
  {name:'HISTORY',icon:Clock3,href:`${BASE}/dashboard/history/`},
  {name:'ACTIVATION',icon:WalletCards,href:`${BASE}/dashboard/activation/`},
  {name:'EDUWILLS AI',icon:Bot,href:`${BASE}/dashboard/ai/`},
  {name:'PERSONAL',icon:UserRound,href:`${BASE}/dashboard/personal/`}
];

export default function DashboardPage(){
 const [mobileOpen,setMobileOpen]=useState(false);
 const [name,setName]=useState('Learner');
 const [activated,setActivated]=useState(false);
 const [loading,setLoading]=useState(true);
 const [expiry,setExpiry]=useState('');

 useEffect(()=>{
   return onAuthStateChanged(auth, async (firebaseUser)=>{
     if(!firebaseUser){ window.location.replace(`${BASE}/login/`); return; }
     try {
       const snap=await getDoc(doc(db,'users',firebaseUser.uid));
       if(!snap.exists()){ setLoading(false); return; }
       const user=snap.data() as {fullName?:string;activated?:boolean;activationExpiresAt?:unknown};
       setName(user.fullName?.split(' ')[0] || 'Learner');
       const active=Boolean(user.activated && user.activationExpiresAt && new Date(String(user.activationExpiresAt)).getTime()>Date.now());
       setActivated(active);
       if(user.activationExpiresAt) setExpiry(new Date(String(user.activationExpiresAt)).toLocaleDateString());
     } finally { setLoading(false); }
   });
 },[]);

 async function logout(){ await signOut(auth); localStorage.removeItem('eduwills_current_user'); localStorage.removeItem('eduwills_current_uid'); window.location.replace(`${BASE}/`); }

 return <main className="min-h-screen bg-paper pb-24 text-ink">
 <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10"><a href={`${BASE}/`} className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><BookOpen size={20}/></div><div><div className="font-black tracking-tight">EDUWILLS</div><div className="hidden text-[9px] font-bold uppercase tracking-[.18em] text-slate-400 sm:block">Book Learner</div></div></a><button className="rounded-xl border border-slate-200 p-2 md:hidden" onClick={()=>setMobileOpen(!mobileOpen)}>{mobileOpen?<X size={20}/>:<Menu size={20}/>}</button><div className="hidden items-center gap-4 md:flex"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${activated?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{activated?'Activated':'Not activated'}</span><div className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-black text-white">{name[0]}</div></div></div></header>
 <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10"><section className="rounded-[2rem] bg-ink p-7 text-white sm:p-10"><div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200"><Sparkles size={12}/> Book Learner</div><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Hello {name}, welcome back.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{loading?'Checking your account…':activated?`Your account is active${expiry?` until ${expiry}`:''}. Your learning tools are unlocked.`:'Your account is registered. Activate it to unlock Quiz, History and EDUWILLS AI.'}</p></div>{!activated&&<a href={`${BASE}/dashboard/activation/`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-ink">Activate account <ArrowRight size={17}/></a>}</div></section>
 <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{nav.map(({name:n,icon:Icon,href})=>{const locked=!activated&&(n==='QUIZ'||n==='HISTORY'||n==='EDUWILLS AI');return <a key={n} href={locked?'#':href} onClick={(e)=>{if(locked){e.preventDefault();alert('Activate your EDUWILLS account with a WilliToken to unlock this section.');}}} className={`rounded-2xl border p-5 shadow-sm transition ${locked?'border-slate-200 bg-white/70 opacity-60':'border-slate-200 bg-white hover:-translate-y-0.5'}`}><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><Icon size={19}/></span>{locked&&<LockKeyhole size={16} className="text-slate-400"/>}</div><p className="mt-4 text-sm font-black">{n}</p><p className="mt-1 text-xs text-slate-400">{locked?'Locked until activation':n==='ACTIVATION'?'Manage your activation':'Open section'}</p></a>})}</div></div>
 <aside className={`${mobileOpen?'fixed inset-x-5 top-20 z-40 block':'hidden'} w-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-soft md:hidden`}><div className="space-y-1">{nav.map(({name:n,icon:Icon,href})=>{const locked=!activated&&(n==='QUIZ'||n==='HISTORY'||n==='EDUWILLS AI');return <a key={n} href={locked?'#':href} onClick={(e)=>{if(locked){e.preventDefault();alert('Activate your EDUWILLS account with a WilliToken to unlock this section.');}setMobileOpen(false)}} className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold text-slate-600"><span className="flex items-center gap-3"><Icon size={18}/>{n}</span>{locked&&<LockKeyhole size={14} className="text-slate-300"/>}</a>})}</div><div className="my-3 border-t border-slate-100"/><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-500"><LogOut size={18}/>Log out</button></aside>
 <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-1 py-2 backdrop-blur md:px-4"><div className="mx-auto flex max-w-3xl items-stretch justify-between">{nav.map(({name:n,icon:Icon,href})=>{const locked=!activated&&(n==='QUIZ'||n==='HISTORY'||n==='EDUWILLS AI');return <a key={n} href={locked?'#':href} onClick={(e)=>{if(locked){e.preventDefault();alert('Activate your EDUWILLS account with a WilliToken to unlock this section.');}}} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[9px] font-black text-slate-500"><span className="relative grid h-7 w-7 place-items-center"><Icon size={19}/>{locked&&<LockKeyhole size={8} className="absolute -right-1 -top-1 rounded-full bg-white text-slate-400"/>}</span><span className="truncate">{n}</span></a>})}</div></nav></main>;
}
