'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { createPublicId } from '@/lib/publicIdentity';

const BASE = '/eduwills';
const SESSION_MAX_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

export default function AccountSessionBridge() {
  useEffect(() => {
    const run = async (user: NonNullable<typeof auth.currentUser>) => {
      const now = Date.now();
      const last = Number(localStorage.getItem('eduwills_last_activity') || 0);
      if (last && now - last > SESSION_MAX_IDLE_MS) {
        await signOut(auth).catch(() => undefined);
        localStorage.removeItem('eduwills_last_activity');
        window.location.replace(`${BASE}/login/`);
        return;
      }
      localStorage.setItem('eduwills_last_activity', String(now));

      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data() as { publicId?: string; username?: string; fullName?: string; email?: string };
        let publicId = String(data.publicId || '').trim();
        if (!/^EW[A-Za-z0-9]{10}$/.test(publicId)) {
          publicId = createPublicId();
          await setDoc(ref, { publicId, publicIdVersion: 1 }, { merge: true });
        }
        await setDoc(doc(db, 'publicUserIndex', publicId), {
          uid: user.uid,
          username: data.username || '',
          fullName: data.fullName || '',
          email: data.email || user.email || '',
          publicId,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        localStorage.setItem('eduwills_public_id', publicId);
        const currentPath = window.location.pathname;
        const currentUrl = `${currentPath}${window.location.search}`;
        if (currentPath === `${BASE}/dashboard/` && !new URLSearchParams(window.location.search).get('u')) {
          const target = `${BASE}/dashboard/?u=${encodeURIComponent(publicId)}`;
          window.history.replaceState({}, document.title, target);
        }
        localStorage.setItem('eduwills_account_url', `${window.location.origin}${BASE}/account/?id=${encodeURIComponent(publicId)}`);
        void currentUrl;
      } catch (error) {
        console.warn('Account identity bootstrap could not complete:', error);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        if (window.location.pathname.startsWith(`${BASE}/dashboard`)) window.location.replace(`${BASE}/login/`);
        return;
      }
      void run(user);
    });

    const touch = () => localStorage.setItem('eduwills_last_activity', String(Date.now()));
    window.addEventListener('click', touch, { passive: true });
    window.addEventListener('keydown', touch, { passive: true });
    window.addEventListener('touchstart', touch, { passive: true });
    return () => {
      unsubscribe();
      window.removeEventListener('click', touch);
      window.removeEventListener('keydown', touch);
      window.removeEventListener('touchstart', touch);
    };
  }, []);

  return null;
}
