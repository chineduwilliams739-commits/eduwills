'use client';

import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const BASE = '/eduwills';

export default function LandingConversionBar() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || pathname !== `${BASE}/`) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-5 lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-[min(760px,calc(100%-40px))] lg:-translate-x-1/2">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur sm:p-5">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={16} />
        </button>
        <div className="flex flex-col gap-4 pr-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950">Ready to make your study time count?</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Choose your category</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Practice at your pace</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Track your progress</span>
            </div>
          </div>
          <a
            href={`${BASE}/signup/`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-eduBlue px-5 py-3 text-sm font-black text-white shadow-lg transition hover:opacity-90"
          >
            Start learning <ArrowRight size={16} />
          </a>
        </div>
        <p className="mt-2 text-[10px] font-semibold text-slate-400">Create your account first. Activation is available when you are ready.</p>
      </div>
    </div>
  );
}
