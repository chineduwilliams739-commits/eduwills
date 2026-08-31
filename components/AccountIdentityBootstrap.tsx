'use client';
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { createPublicId, usernameFromEmail } from '@/lib/publicIdentity';

export default function AccountIdentityBootstrap() {
  useEffect(() => {
    return onAuthStateChanged(auth, async user => {
      if (!user) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const raw = snap.exists() ? snap.data() : {} as Record<string, unknown>;
        let profile: Record<string, any> = { ...raw };

        if (!snap.exists()) {
          const email = String(user.email || '').trim().toLowerCase();
          let indexed: Record<string, any> = {};
          if (email) {
            const emailSnap = await getDoc(doc(db, 'emailIndex', email));
            if (emailSnap.exists()) indexed = emailSnap.data();
          }
          if (!indexed.uid && user.phoneNumber) {
            const phoneSnap = await getDoc(doc(db, 'phoneIndex', user.phoneNumber));
            if (phoneSnap.exists()) indexed = phoneSnap.data();
          }
          profile = {
            uid: user.uid,
            fullName: String(user.displayName || indexed.fullName || '').trim(),
            username: String(indexed.username || '').trim() || usernameFromEmail(email),
            email,
            authEmail: email,
            phone: String(indexed.phoneE164 || user.phoneNumber || '').replace(/^\+/, ''),
            phoneE164: String(indexed.phoneE164 || user.phoneNumber || ''),
            categories: Array.isArray(indexed.categories) ? indexed.categories : ['book'],
            activated: false,
            activationStatus: 'inactive',
          };
        }

        const publicId = String(profile.publicId || '').trim() || createPublicId();
        const email = String(profile.email || profile.authEmail || user.email || '').trim().toLowerCase();
        const username = String(profile.username || '').trim() || usernameFromEmail(email);
        const fullName = String(profile.fullName || user.displayName || username || '').trim();
        const patch: Record<string, any> = { uid: user.uid, publicId, publicIdVersion: 1 };
        if (!profile.username) patch.username = username;
        if (!profile.email && email) patch.email = email;
        if (!profile.authEmail && email) patch.authEmail = email;
        if (!profile.fullName && fullName) patch.fullName = fullName;
        if (!profile.phone && profile.phoneE164) patch.phone = String(profile.phoneE164).replace(/^\+/, '');
        if (!profile.phoneE164 && profile.phone) patch.phoneE164 = profile.phone;
        await setDoc(userRef, { ...profile, ...patch }, { merge: true });

        await setDoc(doc(db, 'publicUserIndex', publicId), {
          uid: user.uid,
          username,
          publicId,
        }, { merge: true });
        if (email) await setDoc(doc(db, 'emailIndex', email), { uid: user.uid, username, publicId }, { merge: true });
        if (profile.phoneE164) await setDoc(doc(db, 'phoneIndex', profile.phoneE164), { uid: user.uid, username, publicId, phoneE164: profile.phoneE164 }, { merge: true });
        localStorage.setItem('eduwills_current_uid', user.uid);
        localStorage.setItem('eduwills_current_user', username);
        localStorage.setItem('eduwills_public_id', publicId);
      } catch (error) {
        console.warn('EDUWILLS identity bootstrap deferred:', error);
      }
    });
  }, []);
  return null;
}
