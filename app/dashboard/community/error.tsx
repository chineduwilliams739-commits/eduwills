'use client';

import { useEffect } from 'react';

export default function CommunityError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('EDUWILLS Community error:', error); }, [error]);
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 text-ink">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
        <h1 className="text-2xl font-black">Community could not be opened</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">The community page hit an unexpected client error. Your account has not been changed.</p>
        {error?.message && <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-slate-50 p-3 text-left text-[11px] text-slate-500">{error.message}</pre>}
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={() => reset()} className="rounded-xl bg-ink px-5 py-3 text-sm font-black text-white">Try again</button>
          <a href="/eduwills/dashboard/" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-black">Dashboard</a>
        </div>
      </section>
    </main>
  );
}
