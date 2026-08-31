'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Copy, CheckCircle2, UserRound, ArrowRight } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const BASE = '/eduwills';
type PublicProfile = { uid?: string; username?: string; publicId?: string; fullName?: string };

export default function AccountLinkPage(){
  const [state,setState]=useState<'loading'|'found'|'missing'>('loading');
  const [profile,setProfile]=useState<PublicProfile|null>(null);
  const [copied,setCopied]=useState(false);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const id=(params.get('id')||params.get('u')||params.get('account')||'').trim();
    if(!/^EW[A-Za-z0-9]{10}$/.test(id)){setState('missing');return;}
    getDoc(doc(db,'publicUserIndex',id)).then(s=>{
      if(!s.exists()){setState('missing');return;}
      setProfile({...s.data() as PublicProfile,publicId:id});
      setState('found');
    }).catch(()=>setState('missing'));
  },[]);
  async function copyLink(){try{await navigator.clipboard.writeText(window.location.href);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{}}
  if(state==='loading') return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading account…</main>;
  if(state==='missing') return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white"><div><h1 className="text-3xl font-black">Account link not found</h1><p className="mt-3 text-sm text-slate-400">The unique EduWills account ID is invalid or does not exist.</p><a className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950" href={`${BASE}/`}>Go to EduWills <ArrowRight size={16}/></a></div></main>;
  const name=profile?.fullName?.trim()||profile?.username?.trim()||'EduWills learner';
  return <main className="grid min-h-screen place-items-center bg-paper px-5 py-8 text-ink"><div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-soft"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-ink text-white"><BookOpen size={28}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-eduBlue">EduWills account</p><div className="mx-auto mt-5 grid h-20 w-20 place-items-center rounded-full bg-cyan-50 text-cyan-700"><UserRound size={34}/></div><h1 className="mt-4 text-3xl font-black">{name}</h1><p className="mt-2 text-sm text-slate-500">Unique account ID: <span className="font-black text-slate-700">{profile?.publicId}</span></p><div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700"><CheckCircle2 size={16}/> Unique EduWills account link</div><button type="button" onClick={copyLink} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">{copied?<><CheckCircle2 size={16}/> Link copied</>:<><Copy size={16}/> Copy account link</>}</button><a className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white" href={`${BASE}/login/`}>Log in to EduWills <ArrowRight size={17}/></a></div></main>;
}
