'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Copy, Download, KeyRound, LogOut, RefreshCw, Search, ShieldCheck, Trash2, Users as UsersIcon, Settings2 } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const ADMIN_UID = 'A45uD8Cu27dI0y0iSWla4CZJBhn1';
const ADMIN_IDLE_MS = 15 * 60 * 1000;
const durations = [
  ['30 minutes', 1800000], ['1 hour', 3600000], ['6 hours', 21600000], ['12 hours', 43200000],
  ['1 day', 86400000], ['7 days', 604800000], ['30 days', 2592000000], ['1 year', 31536000000],
] as const;
const token = () => Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary'] as const;

type User = {
  id: string; uid?: string; fullName?: string; username?: string; phone?: string;
  category?: string; categories?: string[]; educationLevel?: string; educationLevels?: string[];
  schoolLevel?: string; schoolLevels?: string[];
};
type Slot = { id: string; userId: string; slot: number; title: string; author: string; createdAt?: any };
type WilliToken = { id: string; token?: string; userId?: string; username?: string; categories?: string[]; duration?: string; durationMs?: number; createdAt?: any; expiresAt?: any; used?: boolean };
type Tab = 'users' | 'books' | 'accounts';

const CATEGORY_LABELS: Record<string, string> = {
  primary: 'Primary', 'primary school': 'Primary', pupil: 'Primary', pupils: 'Primary',
  junior: 'Junior Secondary', 'junior secondary': 'Junior Secondary', jss: 'Junior Secondary',
  'junior secondary school': 'Junior Secondary', senior: 'Senior Secondary',
  'senior secondary': 'Senior Secondary', sss: 'Senior Secondary', 'senior secondary school': 'Senior Secondary',
};

function categoriesFor(user: User): string[] {
  const raw = [
    ...(Array.isArray(user.categories) ? user.categories : []),
    ...(Array.isArray(user.educationLevels) ? user.educationLevels : []),
    user.category || '', user.educationLevel || '', user.schoolLevel || '',
    ...(Array.isArray(user.schoolLevels) ? user.schoolLevels : []),
  ].map(String).map(v => v.trim()).filter(Boolean);
  return [...new Set(raw.map(v => CATEGORY_LABELS[v.toLowerCase()] || v).filter(Boolean))];
}

function tokenExpiry(t?: WilliToken): Date | null {
  if (!t) return null;
  const explicit = t.expiresAt?.toDate?.();
  if (explicit instanceof Date) return explicit;
  const created = t.createdAt?.toDate?.();
  if (created instanceof Date && typeof t.durationMs === 'number') return new Date(created.getTime() + t.durationMs);
  return null;
}

function formatExpiry(date: Date | null) {
  if (!date) return 'Expiry not recorded';
  return new Intl.DateTimeFormat('en-NG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date);
}

function remaining(date: Date | null, now = Date.now()) {
  if (!date) return '';
  const ms = date.getTime() - now;
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days) return `${days}d ${hours}h remaining`;
  if (hours) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tokens, setTokens] = useState<WilliToken[]>([]);
  const [tab, setTab] = useState<Tab>('users');
  const [userSearch, setUserSearch] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [duration, setDuration] = useState('30 days');
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyBookId, setBusyBookId] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [policy, setPolicy] = useState<Record<string, string>>({ Primary: '', 'Junior Secondary': '', 'Senior Secondary': '' });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError('');
    try {
      const [u, s, t, p] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'bookSlots')),
        getDocs(collection(db, 'williTokens')),
        getDoc(doc(db, 'settings', 'williTokenPolicies')),
      ]);
      setUsers(u.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setSlots(s.docs.map(d => ({ id: d.id, ...d.data() } as Slot)).sort((a, b) => a.slot - b.slot));
      setTokens(t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken)));
      if (p.exists()) setPolicy({ Primary: p.data().Primary || '', 'Junior Secondary': p.data()['Junior Secondary'] || '', 'Senior Secondary': p.data()['Senior Secondary'] || '' });
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'Firebase denied Admin access. Verify the authenticated UID is authorized.' : 'Could not load Admin data.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  const logout = async () => { await signOut(auth); sessionStorage.removeItem('eduwills_admin_auth'); window.location.replace(`${BASE}/admin/login/`); };

  useEffect(() => onAuthStateChanged(auth, async user => {
    if (!user) { window.location.replace(`${BASE}/admin/login/`); return; }
    setAdminEmail(user.email || '');
    try {
      const a = await getDoc(doc(db, 'admins', user.uid));
      if (!a.exists() && user.uid === ADMIN_UID) {
        await setDoc(doc(db, 'admins', user.uid), { uid: user.uid, email: user.email || '', displayName: user.displayName || '', createdAt: serverTimestamp(), role: 'owner' }, { merge: true });
      } else if (!a.exists()) {
        await signOut(auth); window.location.replace(`${BASE}/admin/login/`); return;
      }
      await load();
    } catch (e: any) {
      setError(e?.code === 'permission-denied' ? 'Firebase denied Admin access. The Admin UID is not authorized by the current rules.' : 'Could not load Admin data.');
      setLoading(false);
    }
  }), []);

  useEffect(() => {
    if (!auth.currentUser) return;
    let timer: ReturnType<typeof setTimeout>;
    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (auth.currentUser) {
          alert('Your EDUWILLS Admin session was signed out after 15 minutes of inactivity.');
          await logout();
        }
      }, ADMIN_IDLE_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(event => window.addEventListener(event, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => { clearTimeout(timer); events.forEach(event => window.removeEventListener(event, resetIdleTimer)); };
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => `${u.fullName || ''} ${u.username || ''} ${u.phone || ''} ${categoriesFor(u).join(' ')}`.toLowerCase().includes(q));
  }, [users, userSearch]);

  const userBooks = (uid: string) => slots.filter(s => s.userId === uid).sort((a, b) => a.slot - b.slot);
  const userName = (uid: string) => { const u = users.find(x => (x.uid || x.id) === uid); return u?.fullName || (u?.username ? `@${u.username}` : uid); };
  const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && !t.used).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));
  const activeToken = (uid: string) => userTokens(uid).find(t => { const exp = tokenExpiry(t); return !!exp && exp.getTime() > now; });

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

  const effectiveDurationFor = (u: User) => {
    const configured = categoriesFor(u).map(c => policy[c]).filter(Boolean);
    if (!configured.length) return duration;
    const sorted = configured.sort((a, b) => (durations.find(x => x[0] === a)?.[1] || 0) - (durations.find(x => x[0] === b)?.[1] || 0));
    return sorted[0] || duration;
  };

  const categoryExpiryText = (u: User) => {
    const cats = categoriesFor(u);
    const configured = cats.map(c => `${c}: ${policy[c] || 'manual duration'}`);
    return configured.length ? configured.join(' • ') : 'No category set';
  };

  const createTokenForUser = async (u: User) => {
    const uid = u.uid || u.id;
    const chosen = effectiveDurationFor(u);
    const ms = durations.find(x => x[0] === chosen)?.[1];
    if (!ms) return alert('No valid WilliToken duration is configured for this user.');
    const t = token();
    const expiresAt = new Date(Date.now() + ms);
    setBusyUserId(uid);
    try {
      await setDoc(doc(db, 'williTokens', t), { token: t, userId: uid, username: u.username || '', categories: categoriesFor(u), duration: chosen, durationMs: ms, createdAt: serverTimestamp(), expiresAt, used: false });
      setGenerated(v => ({ ...v, [uid]: t }));
      await load();
    } catch { alert('Could not create the token.'); }
    finally { setBusyUserId(''); }
  };

  const copyGenerated = async (uid: string) => {
    const value = generated[uid];
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setCopied(uid);
    setTimeout(() => setCopied(''), 1500);
  };

  const removeBook = async (book: Slot) => {
    if (!window.confirm(`Delete “${book.title}” by ${book.author} from ${userName(book.userId)}?\n\nThis permanently removes the saved book and frees slot ${book.slot}.`)) return;
    setBusyBookId(book.id);
    try { await deleteDoc(doc(db, 'bookSlots', book.id)); setSlots(v => v.filter(x => x.id !== book.id)); }
    catch (e: any) { alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can delete saved books.' : 'Could not delete this book.'); }
    finally { setBusyBookId(''); }
  };

  const savePolicies = async () => {
    setSavingPolicy(true);
    try { await setDoc(doc(db, 'settings', 'williTokenPolicies'), policy, { merge: true }); alert('Category-based WilliToken expiry policies saved.'); }
    catch (e: any) { alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can change token policies.' : 'Could not save token policies.'); }
    finally { setSavingPolicy(false); }
  };

  const exportUsers = () => {
    const rows = [['Name', 'Username', 'Phone', 'Categories', 'Category expiry policy', 'Status', 'Books', 'WilliToken expiry']];
    users.forEach(u => {
      const uid = u.uid || u.id;
      const active = activeToken(uid);
      rows.push([u.fullName || '', u.username ? `@${u.username}` : '', u.phone || '', categoriesFor(u).join(' | ') || 'Not set', categoryExpiryText(u), active ? 'Active' : 'Inactive', String(userBooks(uid).length), formatExpiry(tokenExpiry(active))]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'eduwills-users.csv'; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Loading Admin…</main>;

  const nav = [
    { id: 'users' as const, label: 'Users', icon: UsersIcon },
    { id: 'books' as const, label: 'Books', icon: BookOpen },
    { id: 'accounts' as const, label: 'Admin Accounts', icon: ShieldCheck },
  ];

  return <main className="min-h-screen overflow-y-auto bg-slate-950 px-4 py-6 text-white sm:px-6"><div className="mx-auto max-w-7xl pb-12">
    <header className="flex flex-wrap items-center justify-between gap-3"><a href={`${BASE}/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-300"><ArrowLeft size={17}/> EDUWILLS</a><div className="flex gap-2"><button onClick={() => load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/> Refresh</button><button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold"><LogOut size={16}/> Sign out</button></div></header>
    <div className="mt-6 flex items-center gap-3"><ShieldCheck className="text-cyan-300"/><div><h1 className="text-3xl font-black">EDUWILLS Administration</h1><p className="text-sm text-slate-400">Admin-only controls for users, books and WilliToken security.</p></div></div>
    {error && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    <nav className="mt-7 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">{nav.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black ${tab === item.id ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-white/5'}`}><Icon size={17}/><span>{item.label}</span></button>; })}</nav>

    {tab === 'users' && <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Users</p><h2 className="mt-1 text-2xl font-black">All EDUWILLS Users</h2><p className="mt-1 text-sm text-slate-400">Total users: <strong className="text-white">{users.length}</strong></p></div><button onClick={exportUsers} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm font-bold"><Download size={16}/> Export users</button></div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4"><Search size={18} className="shrink-0 text-slate-400"/><input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search name, username, phone or category" className="w-full bg-transparent py-3.5 text-sm outline-none"/></div>
      <div className="mt-4 max-h-[620px] overflow-y-auto rounded-2xl border border-white/10 p-2"><div className="space-y-2">{filteredUsers.map(u => {
        const uid = u.uid || u.id;
        const cats = categoriesFor(u);
        const active = activeToken(uid);
        const exp = tokenExpiry(active);
        return <div key={u.id} className={`w-full rounded-2xl border p-4 ${active ? 'border-emerald-300/30 bg-emerald-400/5' : 'border-white/10 bg-slate-900/70'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-black">{u.fullName || 'Unnamed user'}</p>{active ? <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-300">Active</span> : <span className="rounded-full bg-slate-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-400">Inactive</span>}</div>
              <p className="text-xs text-slate-400">{u.username ? `@${u.username}` : 'No username'}{u.phone ? ` · ${u.phone}` : ''}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{(cats.length ? cats : ['Category not set']).map(c => <span key={c} className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] font-black text-violet-200">{c}</span>)}</div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">Category token policy: {categoryExpiryText(u)}</p>
              {active && exp && <div className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-400/5 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-emerald-300">WilliToken expires</p><p className="mt-1 text-sm font-black text-white">{formatExpiry(exp)}</p><p className="mt-0.5 text-xs text-emerald-300">{remaining(exp, now)}</p></div>}
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end sm:justify-start">
              <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-300">{userBooks(uid).length} books</span>
              <button onClick={() => createTokenForUser(u)} disabled={busyUserId === uid} className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50">{busyUserId === uid ? 'Generating…' : active ? 'Renew WilliToken' : 'Generate WilliToken'}</button>
            </div>
          </div>
          {generated[uid] && <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-400/5 p-3"><code className="min-w-0 flex-1 break-all text-xs font-black tracking-widest">{generated[uid]}</code><button onClick={() => copyGenerated(uid)} className="rounded-lg border border-white/10 p-2" aria-label="Copy WilliToken">{copied === uid ? <Check size={15}/> : <Copy size={15}/>}</button></div>}
        </div>;
      })}</div>{!filteredUsers.length && <p className="py-10 text-center text-sm text-slate-500">No users match this search.</p>}</div>
    </section>}

    {tab === 'books' && <section className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Books</p><h2 className="mt-1 text-2xl font-black">Saved books</h2><div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4"><Search size={18} className="text-slate-400"/><input value={bookSearch} onChange={e => setBookSearch(e.target.value)} placeholder="Search by user, book title or author" className="w-full bg-transparent py-3.5 text-sm outline-none"/></div><div className="mt-5 space-y-4">{groupedBooks.map(([uid, books]) => <div key={uid} className="rounded-3xl border border-white/10 bg-slate-900/70 p-4"><div className="flex items-center justify-between"><div><h3 className="font-black">{userName(uid)}</h3><p className="text-xs text-slate-500">{books.length} saved</p></div></div><div className="mt-3 space-y-2">{books.map(book => <div key={book.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-cyan-300">Slot {book.slot}</p><p className="truncate font-bold">{book.title}</p><p className="truncate text-sm text-slate-400">{book.author}</p></div><button onClick={() => removeBook(book)} disabled={busyBookId === book.id} className="shrink-0 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-red-300 disabled:opacity-50"><Trash2 size={18}/></button></div>)}</div></div>)}{!groupedBooks.length && <p className="py-12 text-center text-sm text-slate-500">No saved books match this search.</p>}</div></section>}

    {tab === 'accounts' && <section className="mt-5 space-y-5"><div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><div className="flex items-center gap-3"><ShieldCheck className="text-cyan-300"/><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Admin Accounts</p><h2 className="mt-1 text-2xl font-black">Administrator security</h2></div></div><p className="mt-3 text-sm text-slate-400">Signed in as {adminEmail || 'Admin'}. Password changes continue through Firebase Authentication rather than storing passwords in EDUWILLS. Admin sessions automatically sign out after 15 minutes without activity.</p><a href={`${BASE}/admin/settings/`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950"><KeyRound size={16}/> Open password & account settings</a></div><div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"><div className="flex items-center gap-3"><Settings2 className="text-cyan-300"/><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">WilliToken policies</p><h2 className="mt-1 text-2xl font-black">Category-based expiry</h2></div></div><p className="mt-2 text-sm text-slate-400">Set an expiry policy for each category. Users with multiple categories use the shortest configured policy. Leave a category on “Use manual duration” to use the duration selected in Users.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{CATEGORIES.map(c => <label key={c} className="rounded-2xl border border-white/10 bg-slate-900 p-4"><span className="text-sm font-black">{c}</span><select value={policy[c]} onChange={e => setPolicy(v => ({ ...v, [c]: e.target.value }))} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm font-bold"><option value="">Use manual duration</option>{durations.map(([label]) => <option key={label} value={label}>{label}</option>)}</select></label>)}</div><button onClick={savePolicies} disabled={savingPolicy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950"><Check size={16}/>{savingPolicy ? 'Saving…' : 'Save category expiry policies'}</button></div></section>}
  </div></main>;
}
