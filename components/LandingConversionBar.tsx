'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { usePathname } from 'next/navigation';

const BASE = '/eduwills';

export default function LandingConversionBar() {
  const pathname = usePathname() || '';
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const isLandingPage = normalizedPath === BASE || normalizedPath === `${BASE}/from-chatgpt`;
  if (!isLandingPage) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2147483647] px-2 pb-2 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-5xl rounded-2xl border-2 border-blue-400 bg-white p-3 shadow-[0_20px_70px_rgba(15,23,42,0.35)] ring-2 ring-white sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-950 sm:text-base">Ready to make your study time count?</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-slate-600 sm:text-xs">
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> AI quizzes</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Exam practice</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500" /> Progress tracking</span>
            </div>
          </div>
          <a href={`${BASE}/signup/`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-eduBlue px-5 py-3 text-sm font-black text-white shadow-lg hover:opacity-90 sm:px-6">Start learning <ArrowRight size={17} /></a>
        </div>
      </div>
    </div>
  );
}
