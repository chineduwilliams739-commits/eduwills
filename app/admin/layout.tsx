'use client';

import { BarChart3 } from 'lucide-react';
import { usePathname } from 'next/navigation';

const BASE = '/eduwills';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideAnalyticsLink = pathname === `${BASE}/admin/login/` || pathname === `${BASE}/admin/analytics/`;

  return (
    <>
      {children}
      {!hideAnalyticsLink && (
        <a
          href={`${BASE}/admin/analytics/`}
          aria-label="Open EduWills Analytics"
          className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 shadow-2xl transition hover:scale-[1.02] hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          <BarChart3 size={18} />
          Analytics
        </a>
      )}
    </>
  );
}
