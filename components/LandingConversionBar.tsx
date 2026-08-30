'use client';

import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const BASE = '/eduwills';

export default function LandingConversionBar() {
  const pathname = usePathname() || '';
  const [dismissed, setDismissed] = useState(false);

  const isLandingPage = pathname === BASE || pathname === `${BASE}/` || pathname.replace(/\/+$/, '') === BASE;
  if (dismissed || !isLandingPage) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] sm:inset-x-5 lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-[min(760px,calc(100%-40px))] lg:-translate-x-1/2">
      <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl ring-1 ring-slate-900/5 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-50/80 via-white to-cyan-50/70" />
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" className="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>
        <div className="relative flex flex-col gap-4 pr-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950">Ready to make your study time count?</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Choose your category</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Practice at your pace</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Track your progress</span>
            </div>
          </div>
          <a href={`${BASE}/signup/`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-eduBlue px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:opacity-90">Start learning <ArrowRight size={16} /></a>
        </div>
        <p className="relative mt-2 text-[10px] font-semibold text-slate-400">Create your account first. Activation is available when you are ready.</p>
      </div>
    </div>
  );
}
