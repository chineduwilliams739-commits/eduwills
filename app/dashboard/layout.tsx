'use client';

import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace(`${BASE}/login/`);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          await signOut(auth);
          window.location.replace(`${BASE}/login/`);
          return;
        }

        const data = snap.data() as { fullName?: string; username?: string };
        const identity = String(data.fullName || data.username || user.displayName || '').trim();
        if (!identity) {
          await signOut(auth);
          window.location.replace(`${BASE}/login/`);
          return;
        }

        setReady(true);
      } catch (error) {
        console.error('EDUWILLS session validation failed:', error);
        await signOut(auth).catch(() => undefined);
        window.location.replace(`${BASE}/login/`);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          <p className="mt-4 text-sm font-bold text-slate-500">Checking your EDUWILLS account…</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
