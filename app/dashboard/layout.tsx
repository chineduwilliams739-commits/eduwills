'use client';

import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import AccountSessionBridge from '@/components/AccountSessionBridge';

const BASE = '/eduwills';
type Profile = { fullName?: string; username?: string; email?: string; authEmail?: string; phone?: string; phoneE164?: string };

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
          console.error('EDUWILLS profile missing for authenticated UID:', user.uid);
          setReady(true);
          return;
        }
        const data = snap.data() as Profile;
        const identity = String(data.fullName || data.username || user.displayName || '').trim();
        if (!identity) console.warn('EDUWILLS profile has no display identity; preserving session.');
        setReady(true);
      } catch (error) {
        console.error('EDUWILLS session profile check failed; preserving auth session:', error);
        setReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!ready) {
    return <main className="grid min-h-screen place-items-center bg-paper p-6"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" /><p className="mt-4 text-sm font-bold text-slate-500">Checking your EDUWILLS account…</p></div></main>;
  }

  return <><AccountSessionBridge />{children}</>;
}
