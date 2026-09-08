'use client';

import { CheckCircle2, Copy, Sparkles } from 'lucide-react';

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
  const categories=success.categories||[];
  const benefits=benefitsFor(categories);
  const redeemed=success.kind==='redeem';
  return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="activation-success-title" onClick={event=>event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-300/30 bg-slate-950 p-5 shadow-2xl sm:p-7">
      <div className="flex items-start gap-3">
        {redeemed?<Sparkles className="mt-1 shrink-0 text-cyan-200" size={27}/>:<CheckCircle2 className="mt-1 shrink-0 text-emerald-200" size={27}/>} 
        <div className="min-w-0 flex-1">
          {redeemed ? <>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">🎉 Congratulations!</p>
            <h3 id="activation-success-title" className="mt-1 text-2xl font-black">Your account is now activated</h3>
            <p className="mt-2 text-sm leading-6 text-cyan-50/85">Your WilliToken has been redeemed successfully. The category you selected and paid for is now assigned to your account and active immediately.</p>
            {categories.length?<div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-200">Active learning categories</p><div className="mt-3 flex flex-wrap gap-2">{categories.map(category=><span key={category} className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white">✓ {category}</span>)}</div></div>:null}
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Activation</p><p className="mt-2 text-sm font-bold text-white">Active for 1 year · expires {formatDate(success.activationExpiresAt)}</p><p className="mt-2 text-xs leading-5 text-slate-400">You can now continue learning in your selected category. This WilliToken cannot be redeemed again.</p></div>
          </> : <>
            <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-200">Payment successful</p>
            <h3 id="activation-success-title" className="mt-1 text-2xl font-black">Your WilliToken is ready</h3>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">Your payment has been confirmed. Keep this unique WilliToken safe and redeem it to activate the learning category you selected.</p>
            {categories.length?<p className="mt-3 text-xs font-bold text-emerald-100">Purchased categories: {categories.join(' · ')}</p>:null}
            <div className="mt-4 rounded-2xl border border-emerald-200/20 bg-slate-950/50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your WilliToken</p>{success.code?<><p className="mt-2 break-all text-2xl font-black tracking-[.16em] text-white sm:text-3xl"><b>{success.code}</b></p><button type="button" onClick={onCopy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950"><Copy size={14}/>{copied?'Copied!':'Copy WilliToken'}</button></>:<p className="mt-2 text-sm font-bold text-slate-300">Check your verified email for the token.</p>}<div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><p>Activation valid until: <b className="text-white">{formatDate(success.activationExpiresAt)}</b></p><p>Email delivery: <b className="text-white">{success.emailSent?'Sent':'Check email shortly'}</b></p></div>{success.emailError&&<p className="mt-3 text-xs font-bold text-amber-200">Email delivery note: {success.emailError}</p>}</div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-200">What your purchase unlocks</p><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-300">{benefits.map(item=><li key={item}>✓ {item}</li>)}</ul></div>
          </>}
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white">{redeemed?'Continue learning':'Close'}</button><a href={`/eduwills/dashboard/?category=${encodeURIComponent(categories[0]||'book-learner')}`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-5 py-3 text-sm font-black text-slate-950">Go to my dashboard</a></div>
        </div>
      </div>
    </div>
  </div>;
}
