'use client';

import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const BASE = '/eduwills';

export default function LandingConversionBar() {
  const pathname = usePathname() || '';
  const [dismissed, setDismissed] = useState(false);
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const isLandingPage = normalizedPath === BASE || normalizedPath === `${BASE}/from-chatgpt`;
  if (dismissed || !isLandingPage) return null;

  return (
    <div className="fixed inset-x-2 bottom-2 z-[9999] sm:inset-x-4 sm:bottom-4 lg:inset-x-auto lg:left-1/2 lg:w-[min(820px,calc(100%-32px))] lg:-translate-x-1/2">
      <div className="relative overflow-hidden rounded-2xl border-2 border-blue-300 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.28)] ring-1 ring-blue-100 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-50 via-white to-cyan-50" />
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" className="absolute right-2 top-2 z-20 rounded-lg bg-white p-1.5 text-slate-500 shadow-sm hover:bg-slate-100"><X size={17} /></button>
        <div className="relative flex flex-col gap-4 pr-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-black text-slate-950 sm:text-lg">Ready to make your study time count?</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-slate-600">
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-500" /> AI quizzes</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-500" /> Exam practice</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-500" /> Progress tracking</span>
            </div>
          </div>
          <a href={`${BASE}/signup/`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-eduBlue px-6 py-3.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:opacity-90">Start learning <ArrowRight size={17} /></a>
        </div>
        <p className="relative mt-2 text-[10px] font-semibold text-slate-500">Create your account first — activate when you are ready.</p>
      </div>
    </div>
  );
}
