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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tokenCategories, setTokenCategories] = useState<string[]>([]);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const [u, t, b] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'williTokens')),
        getDocs(collection(db, 'bookSlots')),
      ]);
      const loadedTokens = t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken));
      const now = Date.now();
      const expiredTokens = loadedTokens.filter(token => {
        const expiry = expiryDate(token);
        return !!expiry && expiry.getTime() <= now;
      });
      if (expiredTokens.length) {
        await Promise.all(expiredTokens.map(token => deleteDoc(doc(db, 'williTokens', token.id))));
      }
      const liveTokens = loadedTokens.filter(token => !expiredTokens.some(expired => expired.id === token.id));
      setUsers(u.docs.map(x => ({ id: x.id, ...x.data() } as User)));
      setTokens(liveTokens);
      setBooks(b.docs.map(x => ({ id: x.id, ...x.data() } as Book)));
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'Firebase denied Admin access. Check the admins/{UID} record and Firestore rules.' : 'Could not load Admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => onAuthStateChanged(auth, async user => {
    if (!user) { window.location.replace(`${BASE}/admin/login/`); return; }
    setAdminEmail(user.email || '');
    try {
      const admin = await getDoc(doc(db, 'admins', user.uid));
      if (!admin.exists()) { await signOut(auth); window.location.replace(`${BASE}/admin/login/`); return; }
      await load();
    } catch {
      setError('Could not verify Admin access.');
      setLoading(false);
    }
  }), []);

  useEffect(() => {
    const selected = users.find(u => (u.uid || u.id) === selectedUid);
    const assigned = selected ? getCategories(selected) : [];
    setSelectedCategories(assigned);
    setTokenCategories(assigned);
    setGenerated('');
  }, [selectedUid, users]);

  const selectedUser = users.find(u => (u.uid || u.id) === selectedUid) || null;
  const userName = (uid: string) => {
    const u = users.find(x => (x.uid || x.id) === uid);
    return u?.fullName || (u?.username ? `@${u.username}` : uid);
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => `${u.fullName || ''} ${u.username || ''} ${u.phone || ''} ${getCategories(u).join(' ')}`.toLowerCase().includes(q));
  }, [users, search]);

  const filteredTokens = useMemo(() => {
    const q = tokenSearch.trim().toLowerCase();
    const source = tokens.filter(t => !selectedUid || (t.userId || t.uid) === selectedUid);
    if (!q) return source;
    return source.filter(t => {
      const owner = userName(t.userId || t.uid || '');
      const text = `${t.token || t.id} ${t.username || ''} ${owner} ${getTokenCategories(t).join(' ')} ${t.duration || ''} ${t.redeemed || t.used ? 'redeemed' : 'not redeemed'}`;
      return text.toLowerCase().includes(q);
    });
  }, [tokens, tokenSearch, selectedUid, users]);

  const groupedBooks = useMemo(() => {
    const groups = new Map<string, Book[]>();
    books.forEach(book => {
      const key = book.userId || 'unknown';
      const current = groups.get(key) || [];
      current.push(book);
      groups.set(key, current);
    });
    return [...groups.entries()].sort((a, b) => userName(a[0]).localeCompare(userName(b[0])));
  }, [books, users]);

  const userTokens = (uid: string) => tokens.filter(t => (t.userId || t.uid) === uid).sort((a, b) => (expiryDate(b)?.getTime() || 0) - (expiryDate(a)?.getTime() || 0));

  const createToken = async () => {
    if (!selectedUser) return alert('Select a user first.');
    if (!tokenCategories.length) return alert('Select at least one category for this WilliToken.');
    const ms = DURATIONS.find(x => x[0] === duration)?.[1];
    if (!ms) return alert('Select a valid duration.');
    const value = makeToken();
    const expiresAt = new Date(Date.now() + ms);
    const categories = [...new Set(tokenCategories.map(normalizeCategory).filter(category => issueCategories.includes(category as typeof issueCategories[number])))];
    if (!categories.length) return alert('Select at least one valid EDUWILLS category.');
    try {
      await setDoc(doc(db, 'williTokens', value), {
        token: value,
        userId: selectedUser.uid || selectedUser.id,
        uid: selectedUser.uid || selectedUser.id,
        username: selectedUser.username || '',
        categories,
        duration,
        durationMs: ms,
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
        redeemed: false,
        revoked: false,
      });
      setGenerated(value);
      await load();
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can generate WilliTokens.' : 'Could not generate WilliToken.');
    }
  };

  const revokeToken = async (t: WilliToken) => {
    if (!window.confirm(`Revoke WilliToken ${t.token || t.id}? It will immediately stop granting access.`)) return;
    try {
      const uid = t.userId || t.uid || '';
      if (!uid) throw new Error('Token has no owner');

      await deleteDoc(doc(db, 'williTokens', t.id));

      const remainingSnapshot = await getDocs(collection(db, 'williTokens'));
      const now = Date.now();
      const remainingTokens = remainingSnapshot.docs
        .map(x => ({ id: x.id, ...x.data() } as WilliToken))
        .filter(token => {
          const owner = token.userId || token.uid;
          const expiry = expiryDate(token);
          return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > now;
        });

      if (remainingTokens.length) {
        const latestExpiry = remainingTokens.reduce((latest, token) => {
          const expiry = expiryDate(token);
          return expiry && (!latest || expiry.getTime() > latest.getTime()) ? expiry : latest;
        }, null as Date | null);
        await updateDoc(doc(db, 'users', uid), {
          activated: true,
          activationStatus: 'active',
          activationActive: true,
          williTokenActive: true,
          activationExpiresAt: latestExpiry,
        });
      } else {
        await updateDoc(doc(db, 'users', uid), {
          activated: false,
          activationStatus: 'inactive',
          activationActive: false,
          williTokenActive: false,
          activationExpiresAt: null,
        });
      }

      await load();
    } catch { alert('Could not revoke this WilliToken.'); }
  };

  const deleteExpiredToken = async (t: WilliToken) => {
    if (!window.confirm('Delete this expired WilliToken permanently?')) return;
    try { await deleteDoc(doc(db, 'williTokens', t.id)); await load(); } catch { alert('Could not delete the expired WilliToken.'); }
  };

  const saveCategories = async () => {
    if (!selectedUser) return;
    setSavingCategories(true);
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), {
        categories: selectedCategories,
        category: selectedCategories[0] || '',
        educationLevels: selectedCategories,
        schoolLevels: selectedCategories,
      });
      setTokenCategories(selectedCategories);
      await load();
      alert('User category assignment saved.');
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can assign categories.' : 'Could not save category assignment.');
    } finally { setSavingCategories(false); }
  };

  const exportUsers = () => {
    const rows = [['Name', 'Username', 'Phone', 'Categories', 'Status', 'WilliToken expiry']];
    users.forEach(u => {
      const latest = userTokens(u.uid || u.id).find(t => !t.revoked && !t.cancelled && (expiryDate(t)?.getTime() || 0) > Date.now());
      rows.push([u.fullName || '', u.username || '', u.phone || '', getCategories(u).join(' | '), isUserActive(u, tokens) ? 'Active' : 'Inactive', formatDate(expiryDate(latest))]);
    });
    const csv = rows.map(r => r.map(v => `\"${String(v).replace(/\"/g, '\"\"')}\"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'eduwills-users.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const copy = async () => { if (!generated) return; await navigator.clipboard?.writeText(generated); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const logout = async () => { await signOut(auth); sessionStorage.removeItem('eduwills_admin_auth'); window.location.replace(`${BASE}/admin/login/`); };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading Admin…</main>;

  const tabs = [
    ['users', 'Users', UsersIcon],
    ['tokens', 'WilliTokens', KeyRound],
    ['books', 'Books', Download],
    ['accounts', 'Admin Accounts', ShieldCheck],
  ] as const;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl pb-12">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-black text-slate-300"><ArrowLeft size={17} /> EDUWILLS</a>
          <div className="flex gap-2">
            <button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black"><LogOut size={16} /> Sign out</button>
          </div>
        </header>

        <div className="mt-7 flex items-center gap-3"><ShieldCheck className="text-cyan-300" /><div><h1 className="text-3xl font-black">EDUWILLS Administration</h1><p className="text-sm text-slate-400">Users, category assignment, WilliToken security and saved books.</p></div></div>
        {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

        <nav className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 sm:grid-cols-4">
          {tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition ${tab === id ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-white/10'}`}><Icon size={17} /> {label}</button>)}
        </nav>

        {tab === 'users' && (
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Users</p><h2 className="mt-1 text-2xl font-black">User management</h2><p className="mt-1 text-sm text-slate-400">{users.length} registered users</p></div><button onClick={exportUsers} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black"><Download size={16} /> Export</button></div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4"><Search size={18} className="text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, username, phone or category" className="w-full bg-transparent py-3.5 text-sm outline-none" /></div>
            <div className="mt-4 max-h-[520px] space-y-2">{filteredUsers.map(u => { const uid = u.uid || u.id; const cats = getCategories(u); const active = isUserActive(u, tokens); return <button key={u.id} onClick={() => setSelectedUid(uid)} className={`block w-full rounded-2xl border p-4 text-left ${selectedUid === uid ? 'border-cyan-300/60 bg-cyan-400/10' : 'border-white/10 bg-slate-900/70'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{u.fullName || 'Unnamed user'}</p><p className="text-xs text-slate-400">{u.username ? `@${u.username}` : uid}</p></div><div className="flex flex-wrap justify-end gap-1">{cats.map(c => <span key={c} className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold text-cyan-200">{c}</span>)}<span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${active ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/20' : 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/20'}`}>{active ? 'ACTIVE' : 'INACTIVE'}</span></div></div></button>; })}</div>
          </section>
        )}

        {tab === 'tokens' && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.25fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">WilliToken issuance</p>
              <h2 className="mt-1 text-2xl font-black">Generate a category-aware token</h2>
              <p className="mt-2 text-sm text-slate-400">Select the learner first, then choose the category or categories this token may activate.</p>
              <label className="mt-5 block text-xs font-black uppercase text-slate-400">User</label>
              <select value={selectedUid} onChange={e => setSelectedUid(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold"><option value="">Select user…</option>{users.map(u => <option key={u.id} value={u.uid || u.id}>{u.fullName || u.username || u.id}</option>)}</select>
              <label className="mt-4 block text-xs font-black uppercase text-slate-400">Token categories</label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">{issueCategories.map(category => <label key={category} className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold"><input type="checkbox" checked={tokenCategories.includes(category)} onChange={e => setTokenCategories(prev => e.target.checked ? [...new Set([...prev, category])] : prev.filter(x => x !== category))} />{category}</label>)}</div>
              <label className="mt-4 block text-xs font-black uppercase text-slate-400">Duration</label>
              <select value={duration} onChange={e => setDuration(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold">{DURATIONS.map(([label]) => <option key={label}>{label}</option>)}</select>
              <button onClick={createToken} className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950">Generate WilliToken</button>
              {generated && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><p className="text-xs font-black uppercase text-emerald-300">Generated token</p><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-slate-950 px-3 py-2 font-black text-white">{generated}</code><button onClick={copy} className="rounded-lg bg-white/10 p-2" title="Copy">{copied ? <Check size={17}/> : <Copy size={17}/>}</button></div></div>}
              {selectedUser && <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs font-black uppercase text-slate-400">Assigned account categories</p><div className="mt-2 flex flex-wrap gap-2">{issueCategories.map(category => <button key={category} onClick={() => setSelectedCategories(prev => prev.includes(category) ? prev.filter(x => x !== category) : [...prev, category])} className={`rounded-full px-3 py-1.5 text-xs font-black ${selectedCategories.includes(category) ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-slate-300'}`}>{category}</button>)}</div><button onClick={saveCategories} disabled={savingCategories} className="mt-3 rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-black text-cyan-200">{savingCategories ? 'Saving…' : 'Save account assignment'}</button></div>}
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Token records</p><h2 className="mt-1 text-2xl font-black">Redeemed, active and expired</h2></div><button onClick={() => load(true)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm font-black">Refresh</button></div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4"><Search size={18} className="text-slate-400" /><input value={tokenSearch} onChange={e => setTokenSearch(e.target.value)} placeholder="Search token, user, category or status" className="w-full bg-transparent py-3.5 text-sm outline-none" /></div>
              <div className="mt-4 space-y-3">{filteredTokens.map(t => { const exp = expiryDate(t); const expired = !!exp && exp.getTime() <= Date.now(); const categories = getTokenCategories(t); return <div key={t.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><code className="font-black text-cyan-200">{t.token || t.id}</code><p className="mt-1 text-xs text-slate-400">{userName(t.userId || t.uid || '')} · {categories.join(', ') || 'No category recorded'}</p></div><div className="text-right text-xs font-bold"><p className={t.revoked ? 'text-red-300' : expired ? 'text-slate-400' : 'text-emerald-300'}>{t.revoked ? 'Revoked' : expired ? 'Expired' : 'Active'}</p><p className="text-slate-500">{t.redeemed || t.used ? 'Redeemed' : 'Not redeemed'}</p></div></div><p className="mt-2 text-xs text-slate-500">Expires: {formatDate(exp)} · {remaining(exp)}</p><div className="mt-3 flex flex-wrap gap-2">{!expired && !t.revoked && <button onClick={() => revokeToken(t)} className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200"><Trash2 size={14}/> Revoke</button>}{expired && <button onClick={() => deleteExpiredToken(t)} className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200"><Trash2 size={14}/> Delete expired</button>}</div></div>})}</div>
              {!filteredTokens.length && <p className="mt-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-center text-sm text-slate-500">No WilliTokens match your search.</p>}
            </div>
          </section>
        )}

        {tab === 'books' && (
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Books</p><h2 className="text-2xl font-black">Saved books by user</h2><p className="mt-1 text-sm text-slate-400">Each user has one box containing all books they have saved.</p></div><span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-slate-300">{books.length} saved book{books.length === 1 ? '' : 's'}</span></div>
            <div className="mt-4 space-y-4">
              {groupedBooks.map(([uid, userBooks]) => (
                <div key={uid} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div><p className="font-black text-white">{userName(uid)}</p><p className="text-xs text-slate-500">{userBooks.length} saved book{userBooks.length === 1 ? '' : 's'}</p></div>
                    <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] font-black text-cyan-200">User books</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {userBooks.sort((a, b) => (a.slot || 0) - (b.slot || 0)).map(b => (
                      <div key={b.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                        <p className="font-black">{b.title}</p>
                        <p className="text-sm text-slate-400">{b.author}</p>
                        {typeof b.slot === 'number' && <p className="mt-1 text-[11px] text-slate-600">Slot {b.slot}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!groupedBooks.length && <p className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-center text-sm text-slate-500">No saved books found.</p>}
            </div>
          </section>
        )}

        {tab === 'accounts' && <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><h2 className="text-2xl font-black">Admin Accounts</h2><p className="mt-2 text-sm text-slate-400">Signed in as {adminEmail || 'Admin'}.</p><p className="mt-3 text-sm text-slate-300">Additional admin management remains protected by the existing Firebase admin records.</p></section>}
      </div>
    </main>
  );
}
