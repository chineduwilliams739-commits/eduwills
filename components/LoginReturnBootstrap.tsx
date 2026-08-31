'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const BASE = '/eduwills';

export default function LoginReturnBootstrap() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user || !window.location.pathname.startsWith(`${BASE}/login`)) return;
      const target = localStorage.getItem('eduwills_return_after_login');
      if (!target || !user.emailVerified) return;
      localStorage.removeItem('eduwills_return_after_login');
      window.location.replace(target);
    });
    return () => unsub();
  }, []);
  return null;
}
