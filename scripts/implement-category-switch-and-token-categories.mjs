import fs from 'node:fs';

const personalPath = 'app/dashboard/personal/page.tsx';
const adminPath = 'app/admin/page.tsx';

// Rebuild the Personal page without nested template literals so this repair
// script itself remains valid JavaScript when run by CI.
const personal = `
'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, UserRound, Phone, AtSign, ShieldCheck, BookOpen, LogOut, ArrowRight, Check } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const CATEGORY_LABELS: Record<string, string> = {
  primary: 'Primary', 'primary school': 'Primary', pupil: 'Primary', pupils: 'Primary',
  junior: 'Junior Secondary', 'junior secondary': 'Junior Secondary', jss: 'Junior Secondary',
  'junior secondary school': 'Junior Secondary', senior: 'Senior Secondary',
  'senior secondary': 'Senior Secondary', sss: 'Senior Secondary', 'senior secondary school': 'Senior Secondary',
  book: 'Book Learner', 'book learner': 'Book Learner', books: 'Book Learner'
};

function expiryMs(v: any) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v.seconds) return Number(v.seconds) * 1000;
  const n = Date.parse(String(v));
  return Number.isFinite(n) ? n : 0;
}

function categoriesFor(d: any): string[] {
  const raw = [
    ...(Array.isArray(d?.categories) ? d.categories : []),
    ...(Array.isArray(d?.educationLevels) ? d.educationLevels : []),
    ...(Array.isArray(d?.schoolLevels) ? d.schoolLevels : []),
    d?.category || '', d?.educationLevel || '', d?.schoolLevel || ''
  ].map(String).map(v => v.trim()).filter(Boolean);
  return [...new Set(raw.map(v => CATEGORY_LABELS[v.toLowerCase()] || v))];
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">{icon}{label}</div>
    <div className="mt-2 break-words text-base font-black text-ink">{value}</div>
  </div>;
}

export default function PersonalPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async u => {
    if (!u) { window.location.replace(BASE + '/login/'); return; }
    try {
      const s = await getDoc(doc(db, 'users', u.uid));
      if (!s.exists()) { setError('Your EDUWILLS profile could not be found.'); return; }
      const d = s.data();
      setUser({ ...d, uid: u.uid });
      setActive(d.activated === true && (!d.activationExpiresAt || expiryMs(d.activationExpiresAt) > Date.now()));
    } catch (e) {
      console.error(e);
      setError('Could not load your profile. Please try again.');
    } finally { setLoading(false); }
  }), []);

  const availableCategories = useMemo(() => {
    const c = categoriesFor(user);
    return c.length ? c : ['Book Learner'];
  }, [user]);
  const currentCategory = String(user?.activeCategory || availableCategories[0] || 'Book Learner');
  const firstName = user?.fullName?.split(' ')[0] || 'Learner';

  async function switchCategory(category: string) {
    if (!user?.uid || category === currentCategory) return;
    setSwitching(true); setError('');
    try {
      await setDoc(doc(db, 'users', user.uid), { activeCategory: category }, { merge: true });
      setUser((v: any) => ({ ...v, activeCategory: category }));
      sessionStorage.setItem('eduwills_active_category', category);
    } catch (e) {
      console.error(e);
      setError('Could not switch category. Please try again.');
    } finally { setSwitching(false); }
  }

  async function logout() {
    await signOut(auth);
    window.location.replace(BASE + '/');
  }

  return <main className="min-h-screen bg-paper px-4 py-5 pb-10 sm:px-8">
    <div className="mx-auto max-w-4xl">
      <a href={BASE + '/dashboard/'} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm"><ArrowLeft size={17}/> Dashboard</a>
      <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft">
        <div className="bg-ink p-7 text-white sm:p-10">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><UserRound size={25}/></div>
          <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-cyan-200">PERSONAL</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Hello {firstName}.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{loading ? 'Loading your profile…' : 'Manage your account, learning category and activation status.'}</p>
        </div>
        {error ? <div className="p-8 text-center text-sm font-bold text-red-600">{error}</div> : <>
          <div className="border-b border-slate-100 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Learning category</p><h2 className="mt-1 text-xl font-black text-ink">Switch your EDUWILLS experience</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Choose another category available on your account. Your selection is saved and can be used by the dashboard and learning tools.</p></div>
              <BookOpen className="text-cyan-600" size={24}/>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableCategories.map(c => <button key={c} type="button" disabled={switching} onClick={() => switchCategory(c)} className={currentCategory === c ? 'rounded-2xl border border-cyan-500 bg-cyan-50 px-4 py-4 text-left text-cyan-900 shadow-sm' : 'rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-slate-700 hover:border-cyan-300 hover:bg-slate-50'}>
                <div className="flex items-center justify-between"><span className="text-sm font-black">{c}</span>{currentCategory === c && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-600 px-2 py-1 text-[10px] font-black text-white"><Check size={11}/> CURRENT</span>}</div>
              </button>)}
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-600">Current category: <span className="text-ink">{currentCategory}</span>{switching ? ' · Saving…' : ''}</div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <InfoCard icon={<UserRound size={15}/>} label="Full name" value={user?.fullName || 'Loading…'}/>
            <InfoCard icon={<AtSign size={15}/>} label="Username" value={user?.username || 'Loading…'}/>
            <InfoCard icon={<Phone size={15}/>} label="Phone" value={user?.phone ? '+234 ' + String(user.phone).replace(/^\\+234\\s*/, '') : 'Not available'}/>
            <InfoCard icon={<BookOpen size={15}/>} label="Learning category" value={currentCategory}/>
          </div>
          <div className="border-t border-slate-100 p-6 sm:p-8">
            <div className={active ? 'flex items-start gap-3 rounded-2xl bg-emerald-50 p-5' : 'flex items-start gap-3 rounded-2xl bg-blue-50 p-5'}>
              <ShieldCheck className={active ? 'mt-0.5 shrink-0 text-emerald-600' : 'mt-0.5 shrink-0 text-eduBlue'} size={19}/>
              <div><div className="text-sm font-black text-ink">Account status</div><p className="mt-1 text-xs leading-5 text-slate-500">{active ? 'Your account is active and your learning features are unlocked.' : 'Your account is registered but not activated yet.'}</p></div>
            </div>
            {!active && <a href={BASE + '/dashboard/activation/'} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg">Activate my account <ArrowRight size={16}/></a>}
            <button onClick={logout} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-600"><LogOut size={16}/> Log out</button>
          </div>
        </>}
      </div>
    </div>
  </main>;
}
`;
fs.writeFileSync(personalPath, personal.trimStart());

let admin = fs.readFileSync(adminPath, 'utf8');

// Make the token generator category-aware, including Book Learner.
admin = admin.replace(
  "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary'] as const;",
  "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;"
);
admin = admin.replace(
  "  'senior secondary school': 'Senior Secondary',\n};",
  "  'senior secondary school': 'Senior Secondary',\n  book: 'Book Learner', 'book learner': 'Book Learner', books: 'Book Learner',\n};"
);
admin = admin.replace(
  "  const [savingPolicy, setSavingPolicy] = useState(false);",
  "  const [savingPolicy, setSavingPolicy] = useState(false);\n  const [tokenCategories, setTokenCategories] = useState<string[]>([]);"
);
admin = admin.replace(
  "  const selectedUser = users.find(u => (u.uid || u.id) === selectedUserId) || null;",
  "  const selectedUser = users.find(u => (u.uid || u.id) === selectedUserId) || null;\n  useEffect(() => { setTokenCategories(selectedUser ? categoriesFor(selectedUser) : []); }, [selectedUserId, users]);"
);

const oldCreate = /  const createToken = async \(\) => \{[\s\S]*?\n  \};\n\n  const removeBook/;
const newCreate = `  const createToken = async () => {
    const u = selectedUser;
    if (!u) return alert('Select a user first.');
    const issueCategories = tokenCategories.length ? tokenCategories : categoriesFor(u);
    if (!issueCategories.length) return alert('Select at least one EDUWILLS category for this WilliToken.');
    const configured = issueCategories.map(c => policy[c]).filter(Boolean);
    const chosen = configured.length
      ? configured.sort((a, b) => (durations.find(x => x[0] === a)?.[1] || 0) - (durations.find(x => x[0] === b)?.[1] || 0))[0]
      : duration;
    const ms = durations.find(x => x[0] === chosen)?.[1];
    if (!ms) return alert('No valid WilliToken duration is configured for the selected category.');
    const t = token();
    const expiresAt = new Date(Date.now() + ms);
    try {
      await setDoc(doc(db, 'williTokens', t), {
        token: t, userId: u.uid || u.id, username: u.username || '',
        categories: issueCategories, activeCategory: issueCategories[0],
        duration: chosen, durationMs: ms, createdAt: serverTimestamp(), expiresAt, used: false
      });
      setGenerated(t); setCopied(false); await load();
    } catch { alert('Could not create the token.'); }
  };

  const removeBook`;
if (!oldCreate.test(admin)) throw new Error('createToken block not found');
admin = admin.replace(oldCreate, newCreate);

const tokenHeader = '<h4 className="flex items-center gap-2 font-black"><KeyRound size={18}/> WilliToken</h4>';
if (admin.includes(tokenHeader) && !admin.includes('Token categories')) {
  const categoryUi = `<h4 className="flex items-center gap-2 font-black"><KeyRound size={18}/> WilliToken</h4><p className="mt-2 text-xs font-bold text-slate-400">Token categories determine which EDUWILLS experience this token can activate. You can select more than one.</p><div className="mt-3 flex flex-wrap gap-2">{CATEGORIES.map(c => <button type="button" key={c} onClick={() => setTokenCategories(v => v.includes(c) ? v.filter(x => x !== c) : [...v, c])} className={tokenCategories.includes(c) ? 'rounded-full border border-cyan-300 bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950' : 'rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-xs font-black text-slate-300'}>{tokenCategories.includes(c) ? '✓ ' : ''}{c}</button>)}</div>`;
  admin = admin.replace(tokenHeader, categoryUi);
}

fs.writeFileSync(adminPath, admin);
console.log('EDUWILLS category switching and category-aware WilliToken generation repaired.');
`;
