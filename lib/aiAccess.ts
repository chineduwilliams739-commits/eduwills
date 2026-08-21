'use client';

import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

export type AiEntitlement = {
  allowed: boolean;
  uid: string;
  username: string;
  expiresAt: number;
  source: 'account' | 'token' | 'none';
  reason: string;
};

function ms(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && typeof (value as any).toMillis === 'function') return Number((value as any).toMillis());
  if (typeof value === 'object' && value !== null && 'seconds' in (value as any)) return Number((value as any).seconds) * 1000;
  if (typeof value === 'number') return value > 2000000000000 ? value : value * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function tokenExpiry(token: any): number {
  const direct = ms(token?.activationExpiresAt);
  if (direct) return direct;
  const expires = ms(token?.expiresAt || token?.expiry);
  if (expires) return expires;
  const usedAt = ms(token?.usedAt);
  const duration = Number(token?.durationMs || 0);
  return usedAt && duration > 0 ? usedAt + duration : 0;
}

export async function getAiEntitlement(user: FirebaseUser): Promise<AiEntitlement> {
  const uid = user.uid;
  const now = Date.now();
  const accountSnap = await getDoc(doc(db, 'users', uid));
  if (!accountSnap.exists()) return { allowed: false, uid, username: '', expiresAt: 0, source: 'none', reason: 'account-not-found' };

  const account = accountSnap.data() || {};
  const username = String(account.username || '').trim();
  const active = account.activated === true || account.activationStatus === 'active' || account.activationActive === true || account.williTokenActive === true;
  const accountExpiry = ms(account.activationExpiresAt);

  if (active && (!accountExpiry || accountExpiry > now)) {
    return { allowed: true, uid, username, expiresAt: accountExpiry, source: 'account', reason: 'active-account' };
  }

  const linked = String(account.activeWilliToken || '').trim().toUpperCase();
  if (!linked) return { allowed: false, uid, username, expiresAt: accountExpiry, source: 'none', reason: accountExpiry && accountExpiry <= now ? 'activation-expired' : 'not-activated' };

  const tokenSnap = await getDoc(doc(db, 'williTokens', linked));
  if (!tokenSnap.exists()) return { allowed: false, uid, username, expiresAt: 0, source: 'none', reason: 'linked-token-not-found' };

  const token = tokenSnap.data() || {};
  const expiry = tokenExpiry(token);
  const tokenUid = String(token.userId || token.uid || '').trim();
  const tokenUsername = String(token.username || '').trim().toLowerCase();
  const belongs = tokenUid === uid || (!!username && tokenUsername === username.toLowerCase());
  const valid = token.used === true && token.active !== false && token.revoked !== true && token.cancelled !== true && belongs && expiry > now;

  if (valid) return { allowed: true, uid, username, expiresAt: expiry, source: 'token', reason: 'active-linked-token' };
  return { allowed: false, uid, username, expiresAt: expiry, source: 'token', reason: expiry && expiry <= now ? 'token-expired' : 'token-invalid' };
}

export function watchAiEntitlement(callback: (state: { user: FirebaseUser | null; entitlement: AiEntitlement | null; error?: string }) => void) {
  return onAuthStateChanged(auth, async user => {
    if (!user) return callback({ user: null, entitlement: null });
    try {
      callback({ user, entitlement: await getAiEntitlement(user) });
    } catch (error) {
      console.error('EDUWILLS AI entitlement error', error);
      callback({ user, entitlement: null, error: 'Unable to read activation.' });
    }
  });
}
