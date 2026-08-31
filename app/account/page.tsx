'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const BASE='/eduwills';

export default function AccountLinkPage(){
  const [state,setState]=useState<'loading'|'found'|'missing'>('loading');
  const [username,setUsername]=useState('');
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('u')||new URLSearchParams(window.location.search).get('account')||'';
    if(!/^EW[A-Za-z0-9]{10}$/.test(id)){setState('missing');return;}
    getDoc(doc(db,'publicUserIndex',id)).then(s=>{
      if(!s.exists()){setState('missing');return;}
      const data=s.data() as {username?:string};
      setUsername(String(data.username||'EduWills learner'));
      setState('found');
    }).catch(()=>setState('missing'));
  },[]);
  if(state==='loading') return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading account…</main>;
  if(state==='missing') return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white"><div><h1 className="text-3xl font-black">Account link not found</h1><a className="mt-5 inline-block rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950" href={`${BASE}/`}>Go to EduWills</a></div></main>;
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">EduWills account</p><h1 className="mt-3 text-3xl font-black">@{username}</h1><p className="mt-3 text-sm text-slate-400">This unique account link identifies this EduWills account independently of its display name.</p><a className="mt-7 inline-block w-full rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950" href={`${BASE}/login/`}>Log in</a></div></main>;
}
