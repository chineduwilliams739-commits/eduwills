'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, KeyRound, LogOut, RefreshCw, Search, ShieldCheck, Trash2, Users as UsersIcon } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;
const issueCategories = [...CATEGORIES];
const DURATIONS = [
  ['30 minutes', 1800000], ['1 hour', 3600000], ['6 hours', 21600000], ['12 hours', 43200000],
  ['1 day', 86400000], ['7 days', 604800000], ['30 days', 2592000000], ['1 year', 31536000000],
] as const;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeToken = () => Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

type User = { id: string; uid?: string; fullName?: string; username?: string; phone?: string; activated?: boolean; activationStatus?: string; williTokenActive?: boolean; category?: string; categories?: string[]; educationLevel?: string; educationLevels?: string[]; schoolLevel?: string; schoolLevels?: string[]; activationExpiresAt?: any };
type WilliToken = { id: string; token?: string; userId?: string; uid?: string; username?: string; categories?: string[] | string; duration?: string; durationMs?: number; createdAt?: any; expiresAt?: any; used?: boolean; redeemed?: boolean; revoked?: boolean; cancelled?: boolean };
type Book = { id: string; userId: string; slot?: number; title: string; author: string };
type Tab = 'users' | 'tokens' | 'books' | 'accounts';

const normalizeCategory = (value: string) => {
  const v = value.trim().toLowerCase();
  if (['primary', 'primary school', 'pupil', 'pupils'].includes(v)) return 'Primary';
  if (['junior', 'junior secondary', 'junior secondary school', 'jss'].includes(v)) return 'Junior Secondary';
  if (['senior', 'senior secondary', 'senior secondary school', 'sss'].includes(v)) return 'Senior Secondary';
  if (['book learner', 'book learner school', 'booklearner', 'book'].includes(v)) return 'Book Learner';
  return value.trim();
};

function getCategories(user: User): string[] {
  const values = [
    ...(Array.isArray(user.categories) ? user.categories : []),
    ...(Array.isArray(user.educationLevels) ? user.educationLevels : []),
    ...(Array.isArray(user.schoolLevels) ? user.schoolLevels : []),
    user.category || '', user.educationLevel || '', user.schoolLevel || '',
  ].map(String).map(normalizeCategory).filter(Boolean);
  return [...new Set(values)];
}

function getTokenCategories(token: WilliToken): string[] {
  const value = token.categories;
  if (Array.isArray(value)) return [...new Set(value.map(String).map(normalizeCategory).filter(Boolean))];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return [...new Set(parsed.map(String).map(normalizeCategory).filter(Boolean))];
    } catch {}
    return [...new Set(value.split(',').map(String).map(normalizeCategory).filter(Boolean))];
  }
  return [];
}

function expiryDate(token?: WilliToken): Date | null {
  if (!token) return null;
  const explicit = token.expiresAt?.toDate?.();
  if (explicit instanceof Date) return explicit;
  const created = token.createdAt?.toDate?.();
  if (created instanceof Date && typeof token.durationMs === 'number') return new Date(created.getTime() + token.durationMs);
  return null;
}

function activationExpiry(user: User): Date | null {
  const v = user.activationExpiresAt;
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v?.seconds) return new Date(Number(v.seconds) * 1000);
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

function isUserActive(user: User, tokens: WilliToken[]): boolean {
  const uid = user.uid || user.id;
  const explicitlyInactive = user.activated === false || user.activationStatus === 'inactive' || user.williTokenActive === false;
  if (explicitlyInactive) return false;
  const hasValidToken = tokens.some(token => {
    const owner = token.userId || token.uid;
    const expiry = expiryDate(token);
    return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > Date.now();
  });
  if (hasValidToken) return true;
  const explicitActive = user.activated === true || user.activationStatus === 'active' || user.williTokenActive === true;
  const userExpiry = activationExpiry(user);
  return explicitActive && !!userExpiry && userExpiry.getTime() > Date.now();
}

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Not recorded';
}

function remaining(date: Date | null) {
  if (!date) return 'No expiry';
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return days ? `${days}d ${hours}h remaining` : hours ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tokens, setTokens] = useState<WilliToken[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState('');
  const [duration, setDuration] = useState('30 days');
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [savingCategories, setSavingCategories] = useState(false);

  // NOTE: preserve the remainder of the existing AdminPage implementation below.
