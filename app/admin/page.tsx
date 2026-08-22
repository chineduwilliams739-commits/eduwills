'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, KeyRound, LogOut, RefreshCw, Search, ShieldCheck, Trash2, Users as UsersIcon } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;
const DURATIONS = [
  ['30 minutes', 1800000], ['1 hour', 3600000], ['6 hours', 21600000], ['12 hours', 43200000],
  ['1 day', 86400000], ['7 days', 604800000], ['30 days', 2592000000], ['1 year', 31536000000],
] as const;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeToken = () => Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

type User = { id: string; uid?: string; fullName?: string; username?: string; phone?: string; activated?: boolean; category?: string; categories?: string[]; educationLevel?: string; educationLevels?: string[]; schoolLevel?: string; schoolLevels?: string[]; activationExpiresAt?: any };
type WilliToken = { id: string; token?: string; userId?: string; uid?: string; username?: string; categories?: string[]; duration?: string; durationMs?: number; createdAt?: any; expiresAt?: any; used?: boolean; redeemed?: boolean; revoked?: boolean };
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

function expiryDate(token?: WilliToken): Date | null {
  if (!token) return null;
  const explicit = token.expiresAt?.toDate?.();
  if (explicit instanceof Date) return explicit;
  const created = token.createdAt?.toDate?.();
  if (created instanceof Date && typeof token.durationMs === 'number') return new Date(created.getTime() + token.durationMs);
  return null;
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
      setUsers(u.docs.map(x => ({ id: x.id, ...x.data() } as User)));
      setTokens(t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));
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

  const userTokens = (uid: string) => tokens.filter(t => (t.userId || t.uid) === uid).sort((a, b) => (expiryDate(b)?.getTime() || 0) - (expiryDate(a)?.getTime() || 0));

  const createToken = async () => {
    if (!selectedUser) return alert('Select a user first.');
    if (!tokenCategories.length) return alert('Select at least one category for this WilliToken.');
    const ms = DURATIONS.find(x => x[0] === duration)?.[1];
    if (!ms) return alert('Select a valid duration.');
    const value = makeToken();
    const expiresAt = new Date(Date.now() + ms);
    try {
      await setDoc(doc(db, 'williTokens', value), {
        token: value,
        userId: selectedUser.uid || selectedUser.id,
        uid: selectedUser.uid || selectedUser.id,
        username: selectedUser.username || '',
        categories: [...new Set(tokenCategories.map(normalizeCategory))],
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
      await updateDoc(doc(db, 'williTokens', t.id), { revoked: true, active: false, revokedAt: serverTimestamp() });
      await load();
    } catch { alert('Could not revoke this WilliToken.'); }
  };

  const deleteExpiredToken = async (t: WilliToken) => {
    if (!window.confirm('Delete this expired WilliToken permanently?')) return;
    try { await deleteDoc(doc(db, 'williTokens', t.id)); await load(); } catch { alert('Could not delete the token.'); }
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
    const rows = [['Name', 'Username', 'Phone', 'Categories', 'Activated', 'WilliToken expiry']];
    users.forEach(u => {
      const latest = userTokens(u.uid || u.id).find(t => !t.revoked && (expiryDate(t)?.getTime() || 0) > Date.now());
      rows.push([u.fullName || '', u.username || '', u.phone || '', getCategories(u).join(' | '), u.activated ? 'Yes' : 'No', formatDate(expiryDate(latest))]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
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
            <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">{filteredUsers.map(u => { const uid = u.uid || u.id; const cats = getCategories(u); const live = userTokens(uid).find(t => !t.revoked && !t.redeemed && t.used !== true && (expiryDate(t)?.getTime() || 0) > Date.now()); return <button key={u.id} onClick={() => setSelectedUid(uid)} className={`block w-full rounded-2xl border p-4 text-left ${selectedUid === uid ? 'border-cyan-300/60 bg-cyan-400/10' : 'border-white/10 bg-slate-900/70'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">{u.fullName || 'Unnamed user'}</p><p className="text-xs text-slate-400">{u.username ? `@${u.username}` : 'No username'}{u.phone ? ` · ${u.phone}` : ''}</p><div className="mt-2 flex flex-wrap gap-1.5">{(cats.length ? cats : ['Category not assigned']).map(c => <span key={c} className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] font-black text-violet-200">{c}</span>)}</div></div><div className="text-right text-xs"><p className={live ? 'text-emerald-300' : 'text-slate-500'}>{live ? `Active · ${remaining(expiryDate(live))}` : 'No live token'}</p></div></div></button>; })}</div>
            {selectedUser && <div className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-400/5 p-5">
              <h3 className="text-xl font-black">{selectedUser.fullName || 'Selected user'}</h3><p className="mt-1 text-sm text-slate-400">{selectedUser.username ? `@${selectedUser.username}` : selectedUser.uid || selectedUser.id}</p>
              <div className="mt-5 border-t border-white/10 pt-5"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Category assignment</p><p className="mt-1 text-sm text-slate-400">Admins assign one or more learning categories. Users can later switch between categories that have been assigned to them.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CATEGORIES.map(c => <label key={c} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-slate-900 p-3"><input type="checkbox" checked={selectedCategories.includes(c)} onChange={e => setSelectedCategories(v => e.target.checked ? [...new Set([...v, c])] : v.filter(x => x !== c))} /><span className="text-sm font-black">{c}</span></label>)}</div><button onClick={saveCategories} disabled={savingCategories} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950"><Check size={16} /> {savingCategories ? 'Saving…' : 'Save category assignment'}</button></div>
              <div className="mt-5 border-t border-white/10 pt-5"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Generate WilliToken</p><p className="mt-1 text-xs text-slate-400">Choose exactly which assigned categories this token grants. The token keeps these categories until it expires.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CATEGORIES.map(c => <label key={c} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-slate-900 p-3"><input type="checkbox" checked={tokenCategories.includes(c)} onChange={e => setTokenCategories(v => e.target.checked ? [...new Set([...v, c])] : v.filter(x => x !== c))} /><span className="text-sm font-black">{c}</span></label>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-black">{DURATIONS.map(([label]) => <option key={label} value={label}>{label}</option>)}</select><button onClick={createToken} disabled={!tokenCategories.length} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Generate WilliToken</button></div>{generated && <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-400/10 p-4"><code className="flex-1 break-all font-black tracking-widest">{generated}</code><button onClick={copy} className="rounded-lg border border-white/10 p-2">{copied ? <Check size={16} /> : <Copy size={16} />}</button></div>}</div>
            </div>}
          </section>
        )}

        {tab === 'tokens' && <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">WilliToken security</p><h2 className="mt-1 text-2xl font-black">Redeemed, active, revoked and expired tokens</h2><p className="mt-2 text-sm text-slate-400">Expired tokens are normally removed by the lifecycle repair. This page also provides an explicit cleanup action if an old record remains.</p><div className="mt-5 space-y-3">{tokens.sort((a,b) => (expiryDate(b)?.getTime() || 0) - (expiryDate(a)?.getTime() || 0)).map(t => { const exp = expiryDate(t); const expired = !!exp && exp.getTime() <= Date.now(); const redeemed = t.used === true || t.redeemed === true; return <div key={t.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><code className="font-black tracking-wider">{t.token || t.id}</code><p className="mt-1 text-sm text-slate-300">{userName(t.userId || t.uid || '')}</p><p className="mt-1 text-xs text-slate-500">Categories: {(t.categories || []).join(', ') || 'Not recorded'} · Duration: {t.duration || 'Not recorded'}</p></div><div className="text-right text-xs"><p className={t.revoked ? 'text-red-300' : expired ? 'text-red-300' : redeemed ? 'text-amber-300' : 'text-emerald-300'}>{t.revoked ? 'Revoked' : expired ? 'Expired' : redeemed ? 'Redeemed' : 'Unused / live'}</p><p className="mt-1 text-slate-500">{formatDate(exp)}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{!expired && !t.revoked && <button onClick={() => revokeToken(t)} className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-black text-red-200">Revoke</button>}{expired && <button onClick={() => deleteExpiredToken(t)} className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-black text-red-200"><Trash2 size={14} className="mr-1 inline" /> Delete expired</button>}</div></div>; })}{!tokens.length && <p className="py-10 text-center text-sm text-slate-500">No WilliTokens found.</p>}</div></section>}

        {tab === 'books' && <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Saved books</p><h2 className="mt-1 text-2xl font-black">Book slots</h2><div className="mt-5 space-y-2">{books.map(b => <div key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4"><div className="min-w-0"><p className="font-black">{b.title}</p><p className="text-sm text-slate-400">{b.author} · {userName(b.userId)}</p></div><button onClick={async () => { if (!confirm('Delete this saved book?')) return; await deleteDoc(doc(db, 'bookSlots', b.id)); await load(); }} className="rounded-xl bg-red-500/10 p-3 text-red-300"><Trash2 size={17} /></button></div>)}{!books.length && <p className="py-10 text-center text-sm text-slate-500">No saved books.</p>}</div></section>}

        {tab === 'accounts' && <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Admin Accounts</p><h2 className="mt-1 text-2xl font-black">Administrator security</h2><p className="mt-3 text-sm text-slate-400">Signed in as {adminEmail || 'Admin'}. Firebase Authentication remains responsible for passwords.</p><a href={`${BASE}/admin/settings/`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950"><KeyRound size={16} /> Account settings</a></section>}
      </div>
    </main>
  );
}
