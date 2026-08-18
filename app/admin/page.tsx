'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Copy, Download, KeyRound, LogOut, RefreshCw, Search, ShieldCheck, Trash2, Users as UsersIcon } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const durations = [
  ['30 minutes', 1800000], ['1 hour', 3600000], ['6 hours', 21600000], ['12 hours', 43200000],
  ['1 day', 86400000], ['7 days', 604800000], ['30 days', 2592000000], ['1 year', 31536000000],
] as const;
const token = () => Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

type User = { id: string; uid?: string; fullName?: string; username?: string; phone?: string; activated?: boolean; activationExpiresAt?: any };
type Slot = { id: string; userId: string; slot: number; title: string; author: string; createdAt?: any };

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [duration, setDuration] = useState('30 minutes');
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyBookId, setBusyBookId] = useState('');

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError('');
    try {
      const [u, s] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'bookSlots'))]);
      setUsers(u.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setSlots(s.docs.map(d => ({ id: d.id, ...d.data() } as Slot)).sort((a, b) => a.slot - b.slot));
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'Firebase denied Admin access. Verify this UID exists under admins/.' : 'Could not load Admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => onAuthStateChanged(auth, async user => {
    if (!user) { window.location.replace(`${BASE}/admin/login/`); return; }
    try {
      const a = await getDoc(doc(db, 'admins', user.uid));
      if (!a.exists()) { await auth.signOut(); window.location.replace(`${BASE}/admin/login/`); return; }
      await load();
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'Firebase denied Admin access. Verify this UID exists under admins/.' : 'Could not load Admin data.');
      setLoading(false);
    }
  }), []);

  const filteredUsers = useMemo(() => users.filter(u => `${u.fullName || ''} ${u.username || ''} ${u.phone || ''}`.toLowerCase().includes(userSearch.toLowerCase())), [users, userSearch]);
  const visibleBooks = useMemo(() => slots.filter(b => {
    const name = users.find(u => (u.uid || u.id) === b.userId)?.fullName || users.find(u => (u.uid || u.id) === b.userId)?.username || b.userId;
    return `${name} ${b.title} ${b.author}`.toLowerCase().includes(bookSearch.toLowerCase());
  }), [slots, users, bookSearch]);
  const groupedBooks = useMemo(() => {
    const map = new Map<string, Slot[]>();
    visibleBooks.forEach(book => map.set(book.userId, [...(map.get(book.userId) || []), book]));
    return [...map.entries()];
  }, [visibleBooks]);

  const userName = (uid: string) => {
    const u = users.find(x => (x.uid || x.id) === uid);
    return u?.fullName || u?.username || uid;
  };

  const createToken = async () => {
    const u = users.find(x => (x.username || '') === selectedUser);
    if (!u) return alert('Select a user first.');
    const ms = durations.find(x => x[0] === duration)?.[1];
    if (!ms) return;
    const t = token();
    try {
      await setDoc(doc(db, 'williTokens', t), { token: t, userId: u.uid || u.id, username: u.username || '', duration, durationMs: ms, createdAt: serverTimestamp(), used: false });
      setGenerated(t); setCopied(false);
    } catch { alert('Could not create the token.'); }
  };

  const removeBook = async (book: Slot) => {
    const confirmed = window.confirm(`Delete “${book.title}” by ${book.author} from ${userName(book.userId)}?\n\nThis will permanently remove the saved book and free slot ${book.slot}.`);
    if (!confirmed) return;
    setBusyBookId(book.id);
    try {
      await deleteDoc(doc(db, 'bookSlots', book.id));
      setSlots(v => v.filter(x => x.id !== book.id));
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can delete saved books.' : 'Could not delete this book.');
    } finally { setBusyBookId(''); }
  };

  const exportUsers = () => {
    const rows = [['Name', 'Username', 'Phone', 'Activated', 'Books']];
    users.forEach(u => rows.push([u.fullName || '', u.username ? `@${u.username}` : '', u.phone || '', u.activated ? 'Yes' : 'No', String(slots.filter(s => s.userId === (u.uid || u.id)).length)]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'eduwills-users.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const copy = async () => { if (generated) { await navigator.clipboard?.writeText(generated); setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const logout = async () => { await signOut(auth); sessionStorage.removeItem('eduwills_admin_auth'); window.location.replace(`${BASE}/admin/login/`); };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading Admin…</main>;

  return <main className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-6 text-white sm:px-6">
    <div className="mx-auto max-w-7xl pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-300"><ArrowLeft size={17}/> EDUWILLS</a>
        <div className="flex gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/> Refresh</button>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold"><LogOut size={16}/> Sign out</button>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3"><ShieldCheck className="text-cyan-300"/><div><h1 className="text-3xl font-black">EDUWILLS Administration</h1><p className="text-sm text-slate-400">User, book, token and administrator management.</p></div></div>
      {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

      {/* USERS — first section */}
      <section className="mt-7 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Users</p><h2 className="mt-1 text-2xl font-black">EDUWILLS Users</h2><p className="mt-1 text-sm text-slate-400">Total registered users: <strong className="text-white">{users.length}</strong></p></div>
          <button onClick={exportUsers} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm font-bold"><Download size={16}/> Export users</button>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4"><Search size={18} className="shrink-0 text-slate-400"/><input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users by name, username or phone" className="w-full bg-transparent py-3.5 text-sm outline-none"/></div>
        <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-white/10 bg-black/10 p-2">
          <div className="space-y-2">{filteredUsers.map(u => { const count = slots.filter(s => s.userId === (u.uid || u.id)).length; return <div key={u.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-black">{u.fullName || 'Unnamed user'}</p><p className="text-xs text-slate-400">{u.username ? `@${u.username}` : 'No username'}{u.phone ? ` · ${u.phone}` : ''}</p></div><div className="flex items-center gap-2 text-xs font-bold"><span className={`rounded-full px-2.5 py-1 ${u.activated ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{u.activated ? 'Active' : 'Inactive'}</span><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-300">{count} book{count === 1 ? '' : 's'}</span></div></div></div> })}</div>
          {!filteredUsers.length && <p className="py-10 text-center text-sm text-slate-500">No users match this search.</p>}
        </div>
      </section>

      {/* BOOKS */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Books</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black"><BookOpen size={21}/> Saved Books</h2><p className="mt-1 text-sm text-slate-400">Search by user, title or author. Delete only when you need to free a user's occupied slot.</p></div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4"><Search size={18} className="shrink-0 text-slate-400"/><input value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="Search books, authors or users" className="w-full bg-transparent py-3.5 text-sm outline-none"/></div>
        <div className="mt-5 space-y-4">{groupedBooks.map(([uid, books]) => <div key={uid} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-black">{userName(uid)}</p><p className="text-xs text-slate-500">{books.length} matching saved book{books.length === 1 ? '' : 's'}</p></div><span className="text-xs font-bold text-slate-500">User books</span></div><div className="space-y-2">{books.map(b => <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-cyan-300">Slot {b.slot}</p><p className="truncate font-bold">{b.title}</p><p className="truncate text-sm text-slate-400">{b.author}</p></div><button disabled={busyBookId === b.id} onClick={() => removeBook(b)} title="Delete saved book" className="shrink-0 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-red-300 disabled:opacity-50"><Trash2 size={18}/></button></div>)}</div></div>)}{!groupedBooks.length && <p className="py-10 text-center text-sm text-slate-500">No saved books match this search.</p>}</div>
      </section>

      {/* TOKENS */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><h2 className="flex items-center gap-2 text-xl font-black"><KeyRound size={20}/> Generate WilliToken</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="block text-sm font-bold">User<select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-3"><option value="">Select a user</option>{filteredUsers.map(u => <option key={u.id} value={u.username || ''}>{u.fullName || u.username} {u.username ? `@${u.username}` : ''}</option>)}</select></label><label className="block text-sm font-bold">Duration<select value={duration} onChange={e => setDuration(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-3">{durations.map(x => <option key={x[0]} value={x[0]}>{x[0]}</option>)}</select></label></div><button onClick={createToken} className="mt-4 w-full rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Generate WilliToken</button>{generated && <div className="mt-4 rounded-2xl bg-emerald-400/10 p-4"><div className="flex items-center gap-2"><code className="flex-1 break-all font-black tracking-widest">{generated}</code><button onClick={copy} className="rounded-lg border border-white/10 p-2">{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div></div>}</section>

      {/* ADMIN ACCOUNTS */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Security</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black"><ShieldCheck size={21}/> Admin Accounts</h2><p className="mt-1 text-sm text-slate-400">Change your Firebase password and manage administrator security settings.</p></div><a href={`${BASE}/admin/settings/`} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950"><KeyRound size={16}/> Open Admin Account Settings</a></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs font-bold text-slate-500">Authorization</p><p className="mt-1 font-black">Firebase Admin UID</p></div><div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs font-bold text-slate-500">Password</p><p className="mt-1 font-black">Change anytime</p></div><div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs font-bold text-slate-500">Session</p><p className="mt-1 font-black">Secure sign out</p></div></div></section>
    </div>
  </main>;
}
