'use client';
import { BookOpen, Clock3, LogOut, Menu, UserRound, WalletCards, X, Sparkles, ArrowRight, LockKeyhole, Bot, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE='/eduwills';
const nav=[
 {name:'QUIZ',icon:Sparkles,href:`${BASE}/dashboard/quiz/`},
 {name:'HISTORY',icon:Clock3,href:`${BASE}/dashboard/history/`},
 {name:'ACTIVATION',icon:WalletCards,href:`${BASE}/dashboard/activation/`},
 {name:'EDUWILLS AI',icon:Bot,href:`${BASE}/dashboard/ai/`},
 {name:'PERSONAL',icon:UserRound,href:`${BASE}/dashboard/personal/`}
];
function expiryMs(v:any){if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return v.seconds*1000;const n=Date.parse(String(v));return Number.isFinite(n)?n:0;}

export default function DashboardPage(){
 const [mobileOpen,setMobileOpen]=useState(false),[name,setName]=useState('Learner'),[activated,setActivated]=useState(false),[loading,setLoading]=useState(true),[expiry,setExpiry]=useState(''),[lockedSection,setLockedSection]=useState('');
 useEffect(()=>onAuthStateChanged(auth,async u=>{if(!u){window.location.replace(`${BASE}/login/`);return;}try{const s=await getDoc(doc(db,'users',u.uid));if(!s.exists())return;const d=s.data();setName(d.fullName?.split(' ')[0]||'Learner');const ms=expiryMs(d.activationExpiresAt);setActivated(d.activated===true&&ms>Date.now());if(ms)setExpiry(new Date(ms).toLocaleDateString());}catch(e){console.error(e)}finally{setLoading(false)}}),[]);
 async function logout(){await signOut(auth);window.location.replace(`${BASE}/`)}
 const locked=(n:string)=>!activated&&(n==='QUIZ'||n==='HISTORY'||n==='EDUWILLS AI');
 const go=(href:string,n:string)=>{if(locked(n)){setMobileOpen(false);setLockedSection(n);return;}setMobileOpen(false);window.location.assign(href);};
 const lockedCopy=lockedSection==='QUIZ'?{title:'Your Quiz Studio is locked',text:'Activate your EDUWILLS account with a WilliToken to create personalized quizzes from your books.'}:lockedSection==='HISTORY'?{title:'Your learning history is locked',text:'Activate your EDUWILLS account to save, review and revisit your quiz results.'}:{title:'EDUWILLS AI is locked',text:'Activate your account to unlock your personal study assistant and AI learning tools.'};
 return <main className="min-h-screen bg-paper pb-24 text-ink">
  <header className="sticky top-0 z-[100] border-b border-slate-200/80 bg-white/95 backdrop-blur">
   <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
    <a href={`${BASE}/`} className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><BookOpen size={20}/></div><div><div className="font-black">EDUWILLS</div><div className="hidden text-[9px] font-bold uppercase tracking-[.18em] text-slate-400 sm:block">Book Learner</div></div></a>
    <div className="flex items-center gap-3">
     <span className={`hidden rounded-full px-3 py-1.5 text-xs font-bold md:block ${activated?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{activated?'Activated':'Not activated'}</span>
     <button type="button" aria-label={mobileOpen?'Close menu':'Open menu'} aria-expanded={mobileOpen} className="relative z-[110] grid h-11 w-11 place-items-center rounded-xl border-2 border-slate-200 bg-white text-ink shadow-sm md:hidden" onClick={()=>setMobileOpen(v=>!v)}>{mobileOpen?<X size={22}/>:<Menu size={22}/>}</button>
    </div>
   </div>
   {mobileOpen&&<div className="absolute left-0 right-0 top-full z-[105] border-b border-slate-200 bg-white px-5 py-4 shadow-2xl md:hidden">
    <div className="mx-auto max-w-7xl space-y-1">
     {nav.map(({name:n,icon:Icon,href})=>{const l=locked(n);return <button type="button" key={n} onClick={()=>go(href,n)} className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left font-black active:bg-slate-100"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100"><Icon size={18}/></span>{n}</span>{l?<LockKeyhole size={16}/>:<ArrowRight size={16}/>}</button>})}
     <button type="button" onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-xl border-t border-slate-100 px-4 py-4 pt-5 text-left font-black text-red-600"><LogOut size={18}/> Logout</button>
    </div>
   </div>}
  </header>
  <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
   <section className="rounded-[2rem] bg-ink p-7 text-white sm:p-10"><div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200"><Sparkles size={12}/> Book Learner</div><h1 className="mt-4 text-3xl font-black sm:text-4xl">Hello {name}, welcome back.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{loading?'Checking your account…':activated?`Your account is active${expiry?` until ${expiry}`:''}. Your learning tools are unlocked.`:'Your account is registered. Activate it to unlock Quiz, History and EDUWILLS AI.'}</p></div>{!activated&&<a href={`${BASE}/dashboard/activation/`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-ink">Activate account <ArrowRight size={17}/></a>}</div></section>
   <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{nav.map(({name:n,icon:Icon,href})=>{const l=locked(n);return <button type="button" key={n} onClick={()=>go(href,n)} className={`rounded-2xl border p-5 text-left shadow-sm transition ${l?'border-slate-200 bg-white/70 opacity-60':'border-slate-200 bg-white hover:-translate-y-0.5'}`}><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><Icon size={19}/></span>{l?<LockKeyhole size={16}/>:<CheckCircle2 size={16} className="text-emerald-500"/>}</div><p className="mt-4 text-sm font-black">{n}</p><p className="mt-1 text-xs text-slate-400">{l?'Locked until activation':n==='QUIZ'?'Create a personalized quiz':n==='HISTORY'?'Review your results':n==='EDUWILLS AI'?'Chat with your study assistant':'Open section'}</p></button>})}</div>
  </div>
  <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-1 py-2 backdrop-blur"><div className="mx-auto flex max-w-3xl justify-between">{nav.map(({name:n,icon:Icon,href})=>{const l=locked(n);return <button type="button" key={n} onClick={()=>go(href,n)} className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5 text-[9px] font-black text-slate-500"><span className="relative"><Icon size={19}/>{l&&<LockKeyhole size={8} className="absolute -right-2 -top-1 rounded-full bg-white"/>}</span><span>{n}</span></button>})}</div></nav>
  {lockedSection&&<div className="fixed inset-0 z-[300] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="locked-title" onClick={()=>setLockedSection('')}>
   <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl" onClick={e=>e.stopPropagation()}>
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 px-6 pb-7 pt-7 text-white">
     <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl"/><div className="absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-indigo-400/20 blur-2xl"/>
     <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-lg"><LockKeyhole size={25}/></div>
     <p className="relative mt-5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">EDUWILLS • Members only</p>
     <h2 id="locked-title" className="relative mt-2 text-2xl font-black">{lockedCopy.title}</h2>
     <p className="relative mt-2 text-sm leading-6 text-slate-300">{lockedCopy.text}</p>
    </div>
    <div className="p-6">
     <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck size={20}/></div><p className="text-xs font-bold leading-5 text-slate-600">Unlock your learning tools with a valid WilliToken. Your books and account remain safely saved.</p></div>
     <div className="mt-5 grid gap-2 sm:grid-cols-2"><a href={`${BASE}/dashboard/activation/`} onClick={()=>setLockedSection('')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3.5 text-sm font-black text-white shadow-lg">Activate now <ArrowRight size={17}/></a><button type="button" onClick={()=>setLockedSection('')} className="rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-700">Maybe later</button></div>
    </div>
   </div>
  </div>}
 </main>
}
