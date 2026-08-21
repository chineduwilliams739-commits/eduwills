'use client';

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
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
  const usedAt = ms(token?.usedAt || token?.redeemedAt || token?.activatedAt);
  const duration = Number(token?.durationMs || 0);
  return usedAt && duration > 0 ? usedAt + duration : 0;
}

function accountExpiry(account: any): number {
  return ms(account?.activationExpiresAt || account?.williTokenExpiresAt || account?.tokenExpiresAt);
}

function accountIsActive(account: any, now: number): boolean {
  const expiry = accountExpiry(account);
  if (expiry && expiry <= now) return false;
  return account?.activated === true || account?.activationStatus === 'active' || account?.activationActive === true || account?.williTokenActive === true;
}

function cleanUsername(value: unknown): string {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

function belongs(token: any, uid: string, username: string): boolean {
  const tokenUid = String(token?.userId || token?.uid || '').trim();
  const tokenUsername = cleanUsername(token?.username);
  return tokenUid === uid || (!!username && tokenUsername === cleanUsername(username));
}

function tokenIsValid(token: any, uid: string, username: string, now: number): boolean {
  const expiry = tokenExpiry(token);
  return token?.used === true && token?.active !== false && token?.revoked !== true && token?.cancelled !== true && belongs(token, uid, username) && expiry > now;
}

export async function getAiEntitlement(user: FirebaseUser): Promise<AiEntitlement> {
  const uid = user.uid;
  const now = Date.now();
  const accountSnap = await getDoc(doc(db, 'users', uid));
  if (!accountSnap.exists()) return { allowed: false, uid, username: '', expiresAt: 0, source: 'none', reason: 'account-not-found' };

  const account = accountSnap.data() || {};
  const username = String(account.username || '').trim();
  const expiry = accountExpiry(account);

  // The user activation record is authoritative. A valid activation must never
  // be locked merely because a token query has a different shape.
  if (accountIsActive(account, now)) {
    return { allowed: true, uid, username, expiresAt: expiry, source: 'account', reason: 'active-account' };
  }

  // If the account record is stale, resolve a redeemed live token by UID/userId
  // or username. This is only a fallback and never overrides a valid account activation.
  const candidates = new Map<string, any>();
  const collect = (snap: any) => snap.docs.forEach((item: any) => candidates.set(item.id, { id: item.id, ...item.data() }));
  collect(await getDocs(query(collection(db, 'williTokens'), where('uid', '==', uid))));
  collect(await getDocs(query(collection(db, 'williTokens'), where('userId', '==', uid))));
  if (username) {
    collect(await getDocs(query(collection(db, 'williTokens'), where('username', '==', username))));
    collect(await getDocs(query(collection(db, 'williTokens'), where('username', '==', `@${username.replace(/^@/, '')}`))));
  }

  const linked = String(account.activeWilliToken || '').trim().toUpperCase();
  if (linked && !candidates.has(linked)) {
    const linkedSnap = await getDoc(doc(db, 'williTokens', linked));
    if (linkedSnap.exists()) candidates.set(linked, { id: linkedSnap.id, ...linkedSnap.data() });
  }

  let best: AiEntitlement = { allowed: false, uid, username, expiresAt: expiry, source: 'none', reason: expiry && expiry <= now ? 'activation-expired' : 'not-activated' };
  for (const token of candidates.values()) {
    const tokenExp = tokenExpiry(token);
    if (tokenIsValid(token, uid, username, now) && tokenExp > best.expiresAt) {
      best = { allowed: true, uid, username, expiresAt: tokenExp, source: 'token', reason: 'active-token', };
    }
  }
  return best;
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
