'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Copy, CheckCircle2, UserRound, ArrowRight } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const SESSION_MAX_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
type PublicProfile = { uid?: string; username?: string; publicId?: string; fullName?: string };

export default function AccountLinkPage(){
  const [state,setState]=useState<'checking'|'loading'|'found'|'missing'>('checking');
  const [profile,setProfile]=useState<PublicProfile|null>(null);
  const [copied,setCopied]=useState(false);
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async user=>{
      if(!user){
        localStorage.setItem('eduwills_return_after_login',window.location.href);
        window.location.replace(`${BASE}/login/`);
        return;
      }
      const last=Number(localStorage.getItem('eduwills_last_activity')||0);
      if(last && Date.now()-last>SESSION_MAX_IDLE_MS){
        localStorage.setItem('eduwills_return_after_login',window.location.href);
        await auth.signOut().catch(()=>undefined);
        localStorage.removeItem('eduwills_last_activity');
        window.location.replace(`${BASE}/login/`);
        return;
      }
      localStorage.setItem('eduwills_last_activity',String(Date.now()));
      setState('loading');
      const params=new URLSearchParams(window.location.search);
      const id=(params.get('id')||params.get('u')||params.get('account')||'').trim();
      if(!/^EW[A-Za-z0-9]{10}$/.test(id)){setState('missing');return;}
      try{
        const s=await getDoc(doc(db,'publicUserIndex',id));
        if(!s.exists() || String(s.data()?.uid||'')!==user.uid){setState('missing');return;}
        setProfile({...s.data() as PublicProfile,publicId:id});
        setState('found');
      }catch{setState('missing');}
    });
    return ()=>unsub();
  },[]);
  async function copyLink(){try{await navigator.clipboard.writeText(window.location.href);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{}}
  if(state==='checking'||state==='loading') return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading account…</main>;
  if(state==='missing') return <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white"><div><h1 className="text-3xl font-black">Account link not found</h1><p className="mt-3 text-sm text-slate-400">This unique EduWills link is not associated with the signed-in account.</p><a className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950" href={`${BASE}/dashboard/`}>Go to EduWills <ArrowRight size={16}/></a></div></main>;
  const name=profile?.fullName?.trim()||profile?.username?.trim()||'EduWills learner';
  return <main className="grid min-h-screen place-items-center bg-paper px-5 py-8 text-ink"><div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-soft"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-ink text-white"><BookOpen size={28}/></div><p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-eduBlue">EduWills account</p><div className="mx-auto mt-5 grid h-20 w-20 place-items-center rounded-full bg-cyan-50 text-cyan-700"><UserRound size={34}/></div><h1 className="mt-4 text-3xl font-black">{name}</h1><p className="mt-2 text-sm text-slate-500">Unique account ID: <span className="font-black text-slate-700">{profile?.publicId}</span></p><div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700"><CheckCircle2 size={16}/> Unique EduWills account link</div><button type="button" onClick={copyLink} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700">{copied?<><CheckCircle2 size={16}/> Link copied</>:<><Copy size={16}/> Copy account link</>}</button><a className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-eduBlue px-5 py-3.5 font-black text-white" href={`${BASE}/dashboard/?u=${encodeURIComponent(profile?.publicId||'')}`}>Open dashboard <ArrowRight size={17}/></a></div></main>;
}
