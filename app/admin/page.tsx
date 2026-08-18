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

type User = {
  id: string;
  uid?: string;
  fullName?: string;
  username?: string;
  phone?: string;
  activated?: boolean;
  activationExpiresAt?: any;
  category?: string;
  categories?: string[];
  educationLevel?: string;
  educationLevels?: string[];
  schoolLevel?: string;
  schoolLevels?: string[];
};
type Slot = { id: string; userId: string; slot: number; title: string; author: string; createdAt?: any };
type Tab = 'users' | 'books' | 'accounts';

const CATEGORY_LABELS: Record<string, string> = {
  primary: 'Primary',
  'primary school': 'Primary',
  pupil: 'Primary',
  pupils: 'Primary',
  junior: 'Junior Secondary',
  'junior secondary': 'Junior Secondary',
  jss: 'Junior Secondary',
  'junior secondary school': 'Junior Secondary',
  senior: 'Senior Secondary',
  'senior secondary': 'Senior Secondary',
  sss: 'Senior Secondary',
  'senior secondary school': 'Senior Secondary',
};

function categoriesFor(user: User): string[] {
  const raw = [
    ...(Array.isArray(user.categories) ? user.categories : []),
    ...(Array.isArray(user.educationLevels) ? user.educationLevels : []),
    user.category || '',
    user.educationLevel || '',
    user.schoolLevel || '',
    ...(Array.isArray(user.schoolLevels) ? user.schoolLevels : []),
  ].map(String).map(v => v.trim()).filter(Boolean);
  const labels = raw.map(v => CATEGORY_LABELS[v.toLowerCase()] || v).filter(Boolean);
  return [...new Set(labels)];
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tab, setTab] = useState<Tab>('users');
  const [userSearch, setUserSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [duration, setDuration] = useState('30 minutes');
  const [generated, setGenerated] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyBookId, setBusyBookId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError('');
    try {
      const [u, s] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'bookSlots')),
      ]);
      setUsers(u.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setSlots(s.docs.map(d => ({ id: d.id, ...d.data() } as Slot)).sort((a, b) => a.slot - b.slot));
    } catch (e: any) {
      setError(e?.code === 'permission-denied'
        ? 'Firebase denied Admin access. Verify this UID exists under admins/.'
        : 'Could not load Admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.replace(`${BASE}/admin/login/`);
      return;
    }
    setAdminEmail(user.email || '');
    try {
      const a = await getDoc(doc(db, 'admins', user.uid));
      if (!a.exists()) {
        await auth.signOut();
        window.location.replace(`${BASE}/admin/login/`);
        return;
      }
      await load();
    } catch (e: any) {
      setError(e?.code === 'permission-denied'
        ? 'Firebase denied Admin access. Verify this UID exists under admins/.'
        : 'Could not load Admin data.');
      setLoading(false);
    }
  }), []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => `${u.fullName || ''} ${u.username || ''} ${u.phone || ''} ${categoriesFor(u).join(' ')}`.toLowerCase().includes(q));
  }, [users, userSearch]);

  const selectedUser = users.find(u => (u.uid || u.id) === selectedUserId) || null;
  const userBooks = (uid: string) => slots.filter(s => s.userId === uid).sort((a, b) => a.slot - b.slot);
  const userName = (uid: string) => {
    const u = users.find(x => (x.uid || x.id) === uid);
    return u?.fullName || (u?.username ? `@${u.username}` : uid);
  };

  const visibleBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    if (!q) return slots;
    return slots.filter(b => `${userName(b.userId)} ${b.title} ${b.author}`.toLowerCase().includes(q));
  }, [slots, users, bookSearch]);

  const groupedBooks = useMemo(() => {
    const map = new Map<string, Slot[]>();
    visibleBooks.forEach(book => map.set(book.userId, [...(map.get(book.userId) || []), book]));
    return [...map.entries()].map(([uid, books]) => [uid, books.sort((a, b) => a.slot - b.slot)] as const);
  }, [visibleBooks]);

  const createToken = async () => {
    const u = selectedUser;
    if (!u) return alert('Select a user first.');
    const ms = durations.find(x => x[0] === duration)?.[1];
    if (!ms) return;
    const t = token();
    try {
      await setDoc(doc(db, 'williTokens', t), {
        token: t,
        userId: u.uid || u.id,
        username: u.username || '',
        duration,
        durationMs: ms,
        createdAt: serverTimestamp(),
        used: false,
      });
      setGenerated(t);
      setCopied(false);
    } catch {
      alert('Could not create the token.');
    }
  };

  const removeBook = async (book: Slot) => {
    const confirmed = window.confirm(
      `Delete “${book.title}” by ${book.author} from ${userName(book.userId)}?\n\nThis permanently removes the saved book and frees slot ${book.slot}.`,
    );
    if (!confirmed) return;
    setBusyBookId(book.id);
    try {
      await deleteDoc(doc(db, 'bookSlots', book.id));
      setSlots(v => v.filter(x => x.id !== book.id));
    } catch (e: any) {
      alert(e?.code === 'permission-denied'
        ? 'Only an authenticated Admin can delete saved books.'
        : 'Could not delete this book.');
    } finally {
      setBusyBookId('');
    }
  };

  const exportUsers = () => {
    const rows = [['Name', 'Username', 'Phone', 'Categories', 'Activated', 'Books']];
    users.forEach(u => rows.push([
      u.fullName || '',
      u.username ? `@${u.username}` : '',
      u.phone || '',
      categoriesFor(u).join(' | ') || 'Not set',
      u.activated ? 'Yes' : 'No',
      String(userBooks(u.uid || u.id).length),
    ]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eduwills-users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    if (generated) {
      await navigator.clipboard?.writeText(generated);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const logout = async () => {
    await signOut(auth);
    sessionStorage.removeItem('eduwills_admin_auth');
    window.location.replace(`${BASE}/admin/login/`);
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading Admin…</main>;

  const nav = [
    { id: 'users' as const, label: 'Users', icon: UsersIcon },
    { id: 'books' as const, label: 'Books', icon: BookOpen },
    { id: 'accounts' as const, label: 'Admin Accounts', icon: ShieldCheck },
  ];

  return (
    <main className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl pb-12">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-300"><ArrowLeft size={17}/> EDUWILLS</a>
          <div className="flex gap-2">
            <button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/> Refresh</button>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold"><LogOut size={16}/> Sign out</button>
          </div>
        </header>

        <div className="mt-6 flex items-center gap-3"><ShieldCheck className="text-cyan-300"/><div><h1 className="text-3xl font-black">EDUWILLS Administration</h1><p className="text-sm text-slate-400">Manage users, books and administrator security from separate sections.</p></div></div>
        {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

        <nav className="mt-7 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
          {nav.map(item => { const Icon = item.icon; const active = tab === item.id; return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black transition ${active ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-white/5'}`}><Icon size={17}/><span className="hidden sm:inline">{item.label}</span></button>; })}
        </nav>

        {tab === 'users' && (
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Users</p><h2 className="mt-1 text-2xl font-black">EDUWILLS Users</h2><p className="mt-1 text-sm text-slate-400">Total registered users: <strong className="text-white">{users.length}</strong></p></div>
              <button onClick={exportUsers} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm font-bold"><Download size={16}/> Export users</button>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4"><Search size={18} className="shrink-0 text-slate-400"/><input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users by name, username, phone or category" className="w-full bg-transparent py-3.5 text-sm outline-none"/></div>

            <div className="mt-4 max-h-[500px] overflow-y-auto rounded-2xl border border-white/10 bg-black/10 p-2">
              <div className="space-y-2">
                {filteredUsers.map(u => {
                  const uid = u.uid || u.id;
                  const count = userBooks(uid).length;
                  const categories = categoriesFor(u);
                  const selected = selectedUserId === uid;
                  return <button key={u.id} onClick={() => { setSelectedUserId(uid); setGenerated(''); }} className={`block w-full rounded-2xl border p-4 text-left transition ${selected ? 'border-cyan-300/60 bg-cyan-400/10' : 'border-white/10 bg-slate-900/70 hover:border-white/20'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0"><p className="font-black">{u.fullName || 'Unnamed user'}</p><p className="text-xs text-slate-400">{u.username ? `@${u.username}` : 'No username'}{u.phone ? ` · ${u.phone}` : ''}</p><div className="mt-2 flex flex-wrap gap-1.5">{(categories.length ? categories : ['Category not set']).map(c => <span key={c} className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] font-black text-violet-200">{c}</span>)}</div></div>
                      <div className="flex items-center gap-2 text-xs font-bold"><span className={`rounded-full px-2.5 py-1 ${u.activated ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{u.activated ? 'Active' : 'Inactive'}</span><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-cyan-300">{count} book{count === 1 ? '' : 's'}</span></div>
                    </div>
                  </button>;
                })}
              </div>
              {!filteredUsers.length && <p className="py-10 text-center text-sm text-slate-500">No users match this search.</p>}
            </div>

            {selectedUser && <div className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-400/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Selected user</p><h3 className="mt-1 text-xl font-black">{selectedUser.fullName || 'Unnamed user'}</h3><p className="text-sm text-slate-400">{selectedUser.username ? `@${selectedUser.username}` : 'No username'}{selectedUser.phone ? ` · ${selectedUser.phone}` : ''}</p><div className="mt-3 flex flex-wrap gap-1.5">{(categoriesFor(selectedUser).length ? categoriesFor(selectedUser) : ['Category not set']).map(c => <span key={c} className="rounded-full bg-violet-400/10 px-2.5 py-1 text-xs font-black text-violet-200">{c}</span>)}</div></div><button onClick={() => setSelectedUserId('')} className="text-xs font-bold text-slate-400">Clear selection</button></div>
              <div className="mt-5 border-t border-white/10 pt-5"><h4 className="flex items-center gap-2 font-black"><KeyRound size={18}/> Generate WilliToken for this user</h4><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold">{durations.map(x => <option key={x[0]} value={x[0]}>{x[0]}</option>)}</select><button onClick={createToken} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950">Generate WilliToken</button></div>{generated && <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-400/10 p-4"><code className="flex-1 break-all font-black tracking-widest">{generated}</code><button onClick={copy} className="rounded-lg border border-white/10 p-2">{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div>}</div>
            </div>}
          </section>
        )}

        {tab === 'books' && (
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Books</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black"><BookOpen size={21}/> Saved Books</h2><p className="mt-1 text-sm text-slate-400">Books are grouped by user. Deleting one permanently frees its occupied slot.</p></div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4"><Search size={18} className="shrink-0 text-slate-400"/><input value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="Search books, authors or users" className="w-full bg-transparent py-3.5 text-sm outline-none"/></div>
            <div className="mt-5 space-y-4">{groupedBooks.map(([uid, books]) => <div key={uid} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-black">{userName(uid)}</p><p className="text-xs text-slate-500">{books.length} matching saved book{books.length === 1 ? '' : 's'}</p></div></div><div className="space-y-2">{books.map(b => <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-cyan-300">Slot {b.slot}</p><p className="truncate font-bold">{b.title}</p><p className="truncate text-sm text-slate-400">{b.author}</p></div><button disabled={busyBookId === b.id} onClick={() => removeBook(b)} title="Delete saved book" className="shrink-0 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-red-300 disabled:opacity-50"><Trash2 size={18}/></button></div>)}</div></div>)}{!groupedBooks.length && <p className="py-10 text-center text-sm text-slate-500">No saved books match this search.</p>}</div>
          </section>
        )}

        {tab === 'accounts' && (
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Security</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black"><ShieldCheck size={21}/> Admin Accounts</h2><p className="mt-1 text-sm text-slate-400">Keep administrator security separate from user and book management.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs font-bold text-slate-500">Signed-in Admin</p><p className="mt-1 break-all font-black">{adminEmail || 'Firebase Admin'}</p></div><div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs font-bold text-slate-500">Authorization</p><p className="mt-1 font-black">Admin UID verified</p></div><div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"><p className="text-xs font-bold text-slate-500">Session</p><p className="mt-1 font-black">Protected Admin session</p></div></div>
            <div className="mt-5 flex flex-wrap gap-3"><a href={`${BASE}/admin/settings/`} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950"><KeyRound size={16}/> Password & Account Settings</a><button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold"><LogOut size={16}/> Sign out all Admin work</button></div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4"><p className="font-black">Admin tools</p><ul className="mt-2 space-y-2 text-sm text-slate-400"><li>• User search and category visibility</li><li>• WilliToken generation from the selected user</li><li>• Saved-book cleanup and slot recovery</li><li>• CSV user export</li><li>• Secure Firebase password management</li></ul></div>
          </section>
        )}
      </div>
    </main>
  );
}
