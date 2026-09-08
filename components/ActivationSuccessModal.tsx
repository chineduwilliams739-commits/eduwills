'use client';

import { CheckCircle2, Copy } from 'lucide-react';

type Success = {
  code: string;
  emailSent: boolean;
  activationExpiresAt?: string;
  categories?: string[];
  emailError?: string;
  kind: 'payment' | 'redeem';
  alreadyActive?: boolean;
};

const BENEFITS: Record<string,string[]> = {
  Primary:['Primary-level practice quizzes','Book-based learning support','Progress tracking','Learning resources'],
  'Junior Secondary':['BECE-focused practice','Book-based learning support','Progress tracking','Learning resources'],
  'Senior Secondary':['Senior-school practice','JAMB-style preparation support','Progress tracking','Learning resources'],
  'Book Learner':['AI-powered book quizzes','Author and book discovery','Progress tracking','Book-focused study tools']
};

const benefitsFor=(categories:string[])=>Array.from(new Set(categories.flatMap(category=>BENEFITS[category]||[])));
const formatDate=(value?:string)=>{if(!value)return '1 year from activation';const d=new Date(value);return Number.isNaN(d.getTime())?'1 year from activation':d.toLocaleDateString('en-NG',{year:'numeric',month:'long',day:'numeric'})};

export default function ActivationSuccessModal({success,copied,onCopy,onClose}:{success:Success;copied:boolean;onCopy:()=>void;onClose:()=>void}){
  const benefits=benefitsFor(success.categories||[]);
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="activation-success-title" onClick={event=>event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-300/30 bg-slate-950 p-5 shadow-2xl sm:p-7">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-1 shrink-0 text-emerald-200" size={25}/>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-200">{success.kind==='redeem'?'Activation successful':'Congratulations!'}</p>
          <h3 id="activation-success-title" className="mt-1 text-2xl font-black">{success.alreadyActive?'Your EduWills access is already active':'Your EduWills activation is ready'}</h3>
          <p className="mt-2 text-sm leading-6 text-emerald-50/80">{success.kind==='redeem'?(success.alreadyActive?'This WilliToken was already activated on your account. Your access is confirmed.':'Your WilliToken has been redeemed successfully. Here is what you can now access.'):'Payment confirmed. Your unique WilliToken is shown below.'}</p>
          {success.categories?.length?<p className="mt-3 text-xs font-bold text-emerald-100">Active categories: {success.categories.join(' · ')}</p>:null}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-200">What you have access to</p>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-300">{benefits.map(item=><li key={item}>✓ {item}</li>)}</ul>
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-200/20 bg-slate-950/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your WilliToken</p>
            {success.code?<><p className="mt-2 break-all text-2xl font-black tracking-[.16em] text-white sm:text-3xl"><b>{success.code}</b></p><button type="button" onClick={onCopy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950"><Copy size={14}/>{copied?'Copied!':'Copy WilliToken'}</button></>:<p className="mt-2 text-sm font-bold text-slate-300">Check your verified email for the token.</p>}
            <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><p>Activation valid until: <b className="text-white">{formatDate(success.activationExpiresAt)}</b></p><p>Email delivery: <b className="text-white">{success.emailSent?'Sent':'Check email shortly'}</b></p></div>
            {success.emailError&&<p className="mt-3 text-xs font-bold text-amber-200">Email delivery note: {success.emailError}</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white">Close</button><a href="/eduwills/dashboard/" className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-5 py-3 text-sm font-black text-slate-950">Go to my dashboard</a></div>
        </div>
      </div>
    </div>
  </div>;
}
