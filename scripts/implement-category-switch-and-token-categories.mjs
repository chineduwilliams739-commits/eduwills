import fs from 'node:fs';

const personalPath = 'app/dashboard/personal/page.tsx';
const adminPath = 'app/admin/page.tsx';

const personal = fs.readFileSync(personalPath, 'utf8');
if (!personal.includes('activeCategory')) throw new Error('Personal active category implementation missing');
if (!personal.includes('switchCategory')) throw new Error('Personal category switch handler missing');
if (!personal.includes('Switch EDUWILLS category')) throw new Error('Personal category switch UI missing');

let admin = fs.readFileSync(adminPath, 'utf8');

admin = admin.replace("const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary'] as const;", "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;");
admin = admin.replace("  'senior secondary school': 'Senior Secondary',\n};", "  'senior secondary school': 'Senior Secondary',\n  book: 'Book Learner', books: 'Book Learner', 'book learner': 'Book Learner',\n};");
admin = admin.replace("  activationExpiresAt?: any; category?: string; categories?: string[]; educationLevel?: string;", "  activationExpiresAt?: any; category?: string; categories?: string[]; activeCategory?: string; educationLevel?: string;");
admin = admin.replace("const [savingPolicy, setSavingPolicy] = useState(false);", "const [savingPolicy, setSavingPolicy] = useState(false);\n  const [tokenCategories, setTokenCategories] = useState<string[]>([]);\n  const [assignedCategories, setAssignedCategories] = useState<string[]>([]);\n  const [savingAssignment, setSavingAssignment] = useState(false);");
admin = admin.replace("const selectedUser = users.find(u => (u.uid || u.id) === selectedUserId) || null;", "const selectedUser = users.find(u => (u.uid || u.id) === selectedUserId) || null;\n  useEffect(() => { const c = selectedUser ? categoriesFor(selectedUser) : []; setTokenCategories(c); setAssignedCategories(c); }, [selectedUserId, users]);");

const oldCreate = "  const createToken = async () => {\n    const u = selectedUser;\n    if (!u) return alert('Select a user first.');\n    const chosen = effectiveDurationFor(u);\n    const ms = durations.find(x => x[0] === chosen)?.[1];\n    if (!ms) return alert('No valid WilliToken duration is configured for this user.');\n    const t = token();\n    const expiresAt = new Date(Date.now() + ms);\n    try {\n      await setDoc(doc(db, 'williTokens', t), { token: t, userId: u.uid || u.id, username: u.username || '', categories: categoriesFor(u), duration: chosen, durationMs: ms, createdAt: serverTimestamp(), expiresAt, used: false });\n      setGenerated(t); setCopied(false); await load();\n    } catch { alert('Could not create the token.'); }\n  };";
const newCreate = "  const createToken = async () => {\n    const u = selectedUser;\n    if (!u) return alert('Select a user first.');\n    const issueCategories = tokenCategories.length ? tokenCategories : categoriesFor(u);\n    if (!issueCategories.length) return alert('Select at least one EDUWILLS category for this WilliToken.');\n    const chosen = effectiveDurationFor(u);\n    const ms = durations.find(x => x[0] === chosen)?.[1];\n    if (!ms) return alert('No valid WilliToken duration is configured for this user.');\n    const t = token();\n    const expiresAt = new Date(Date.now() + ms);\n    try {\n      await setDoc(doc(db, 'williTokens', t), { token: t, userId: u.uid || u.id, username: u.username || '', categories: issueCategories, activeCategory: issueCategories[0], duration: chosen, durationMs: ms, createdAt: serverTimestamp(), expiresAt, used: false });\n      setGenerated(t); setCopied(false); await load();\n    } catch { alert('Could not create the token.'); }\n  };";
if (admin.includes(oldCreate)) admin = admin.replace(oldCreate, newCreate);
else if (!admin.includes('categories: issueCategories')) throw new Error('Admin token generator block not found');

if (!admin.includes('const saveCategoryAssignment = async')) {
  const marker = "  const removeBook = async (book: Slot) => {";
  const helper = `  const saveCategoryAssignment = async () => {\n    const u = selectedUser;\n    if (!u) return alert('Select a user first.');\n    if (!assignedCategories.length) return alert('Select at least one EDUWILLS category for this account.');\n    setSavingAssignment(true);\n    try {\n      const uid = u.uid || u.id;\n      const nextActive = assignedCategories.includes(u.activeCategory || '') ? u.activeCategory : assignedCategories[0];\n      await setDoc(doc(db, 'users', uid), { categories: assignedCategories, category: assignedCategories[0], activeCategory: nextActive, educationLevels: assignedCategories }, { merge: true });\n      setUsers(v => v.map(x => (x.uid || x.id) === uid ? { ...x, categories: assignedCategories, category: assignedCategories[0], activeCategory: assignedCategories.includes(x.activeCategory || '') ? x.activeCategory : assignedCategories[0], educationLevels: assignedCategories } : x));\n      setTokenCategories(assignedCategories);\n      alert('Account categories assigned successfully.');\n    } catch (e: any) {\n      alert(e?.code === 'permission-denied' ? 'Firebase denied this admin category assignment.' : 'Could not assign categories to this account.');\n    } finally { setSavingAssignment(false); }\n  };\n\n`;
  if (!admin.includes(marker)) throw new Error('Admin removeBook marker not found');
  admin = admin.replace(marker, helper + marker);
}

if (!admin.includes('Account category assignment')) {
  const marker = '      <div className="mt-4 max-h-[540px] overflow-y-auto';
  const ui = `      <div className="mt-5 rounded-3xl border border-violet-300/20 bg-slate-950/70 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">Account category assignment</p><h3 className="mt-1 text-lg font-black">Assign EDUWILLS categories</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Admins control which EDUWILLS sections an account can use. A user may have more than one category and can switch between assigned categories from Personal.</p></div><span className="rounded-full bg-violet-400/10 px-3 py-1.5 text-xs font-black text-violet-200">Admin controlled</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm font-bold text-white outline-none"><option value="">Select an account…</option>{users.map(u => <option key={u.uid || u.id} value={u.uid || u.id}>{u.fullName || u.username || u.uid || u.id}</option>)}</select><button type="button" onClick={saveCategoryAssignment} disabled={!selectedUserId || savingAssignment} className="rounded-xl bg-violet-400 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{savingAssignment ? 'Saving…' : 'Save assignment'}</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CATEGORIES.map(c => <button type="button" key={c} onClick={() => setAssignedCategories(v => v.includes(c) ? v.filter(x => x !== c) : [...v, c])} className={assignedCategories.includes(c) ? 'rounded-2xl border border-violet-300 bg-violet-400 px-4 py-3 text-left text-xs font-black text-slate-950' : 'rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-left text-xs font-black text-slate-300 hover:bg-white/5'}>{assignedCategories.includes(c) ? '✓ ' : ''}{c}</button>)}</div>{selectedUser && <p className="mt-3 text-xs font-bold text-slate-500">Current: {assignedCategories.join(' · ') || 'None selected'}</p>}</div>\n`;
  if (!admin.includes(marker)) throw new Error('Admin users list insertion point not found');
  admin = admin.replace(marker, ui + marker);
}

if (!admin.includes('Token categories')) {
  const marker = '<h4 className="flex items-center gap-2 font-black"><KeyRound size={18}/> WilliToken</h4>';
  const ui = marker + "<p className=\"mt-2 text-xs font-bold text-slate-400\">Token categories determine which EDUWILLS category this token can activate. Select one or more.</p><div className=\"mt-3 flex flex-wrap gap-2\">{CATEGORIES.map(c => <button type=\"button\" key={c} onClick={() => setTokenCategories(v => v.includes(c) ? v.filter(x => x !== c) : [...v, c])} className={tokenCategories.includes(c) ? 'rounded-full border border-cyan-300 bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950' : 'rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-xs font-black text-slate-300'}>{tokenCategories.includes(c) ? '✓ ' : ''}{c}</button>)}</div>";
  if (admin.includes(marker)) admin = admin.replace(marker, ui);
}

fs.writeFileSync(adminPath, admin);
console.log('EDUWILLS category switching, admin account assignment and category-aware WilliToken generation applied.');
