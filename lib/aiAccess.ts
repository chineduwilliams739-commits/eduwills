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

async function findActiveToken(uid: string, username: string, now: number): Promise<any | null> {
  const candidates = new Map<string, any>();
  const collect = (snap: any) => snap.docs.forEach((item: any) => candidates.set(item.id, { id: item.id, ...item.data() }));

  collect(await getDocs(query(collection(db, 'williTokens'), where('uid', '==', uid))));
  collect(await getDocs(query(collection(db, 'williTokens'), where('userId', '==', uid))));
  if (username) {
    collect(await getDocs(query(collection(db, 'williTokens'), where('username', '==', username))));
    collect(await getDocs(query(collection(db, 'williTokens'), where('username', '==', `@${username.replace(/^@/, '')}`))));
  }

  const linked = String((await getDoc(doc(db, 'users', uid))).data()?.activeWilliToken || '').trim();
  if (linked && !candidates.has(linked)) {
    const linkedSnap = await getDoc(doc(db, 'williTokens', linked));
    if (linkedSnap.exists()) candidates.set(linked, { id: linkedSnap.id, ...linkedSnap.data() });
  }

  return [...candidates.values()]
    .filter(token => tokenIsValid(token, uid, username, now))
    .sort((a, b) => tokenExpiry(b) - tokenExpiry(a))[0] || null;
}

export async function getAiEntitlement(user: FirebaseUser): Promise<AiEntitlement> {
  const uid = user.uid;
  const now = Date.now();
  const accountSnap = await getDoc(doc(db, 'users', uid));
  if (!accountSnap.exists()) return { allowed: false, uid, username: '', expiresAt: 0, source: 'none', reason: 'account-not-found' };

  const account = accountSnap.data() || {};
  const username = String(account.username || '').trim();
  const accountExpiryMs = accountExpiry(account);

  // A WilliToken is the source of activation entitlement. Account flags are
  // only cached status and must never grant AI access by themselves.
  const token = await findActiveToken(uid, username, now);
  if (token) {
    const expiresAt = tokenExpiry(token);
    return { allowed: true, uid, username, expiresAt, source: 'token', reason: 'active-token' };
  }

  const expired = accountExpiryMs > 0 && accountExpiryMs <= now;
  return {
    allowed: false,
    uid,
    username,
    expiresAt: accountExpiryMs,
    source: 'none',
    reason: expired ? 'activation-expired' : 'no-active-willitoken',
  };
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
