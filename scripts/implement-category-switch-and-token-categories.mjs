import fs from 'node:fs';

const personalPath = 'app/dashboard/personal/page.tsx';
const adminPath = 'app/admin/page.tsx';

// Personal is now implemented directly in the page. Do not overwrite it with a generated template.
const personal = fs.readFileSync(personalPath, 'utf8');
if (!personal.includes('activeCategory')) throw new Error('Personal active category implementation missing');
if (!personal.includes('switchCategory')) throw new Error('Personal category switch handler missing');
if (!personal.includes('Switch EDUWILLS category')) throw new Error('Personal category switch UI missing');

let admin = fs.readFileSync(adminPath, 'utf8');

admin = admin.replace("const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary'] as const;", "const CATEGORIES = ['Primary', 'Junior Secondary', 'Senior Secondary', 'Book Learner'] as const;");
admin = admin.replace("  'senior secondary school': 'Senior Secondary',\n};", "  'senior secondary school': 'Senior Secondary',\n  book: 'Book Learner', books: 'Book Learner', 'book learner': 'Book Learner',\n};");
admin = admin.replace("const [savingPolicy, setSavingPolicy] = useState(false);", "const [savingPolicy, setSavingPolicy] = useState(false);\n  const [tokenCategories, setTokenCategories] = useState<string[]>([]);");
admin = admin.replace("const selectedUser = users.find(u => (u.uid || u.id) === selectedUserId) || null;", "const selectedUser = users.find(u => (u.uid || u.id) === selectedUserId) || null;\n  useEffect(() => { setTokenCategories(selectedUser ? categoriesFor(selectedUser) : []); }, [selectedUserId, users]);");

const oldCreate = "  const createToken = async () => {\n    const u = selectedUser;\n    if (!u) return alert('Select a user first.');\n    const chosen = effectiveDurationFor(u);\n    const ms = durations.find(x => x[0] === chosen)?.[1];\n    if (!ms) return alert('No valid WilliToken duration is configured for this user.');\n    const t = token();\n    const expiresAt = new Date(Date.now() + ms);\n    try {\n      await setDoc(doc(db, 'williTokens', t), { token: t, userId: u.uid || u.id, username: u.username || '', categories: categoriesFor(u), duration: chosen, durationMs: ms, createdAt: serverTimestamp(), expiresAt, used: false });\n      setGenerated(t); setCopied(false); await load();\n    } catch { alert('Could not create the token.'); }\n  };";
const newCreate = "  const createToken = async () => {\n    const u = selectedUser;\n    if (!u) return alert('Select a user first.');\n    const issueCategories = tokenCategories.length ? tokenCategories : categoriesFor(u);\n    if (!issueCategories.length) return alert('Select at least one EDUWILLS category for this WilliToken.');\n    const chosen = effectiveDurationFor(u);\n    const ms = durations.find(x => x[0] === chosen)?.[1];\n    if (!ms) return alert('No valid WilliToken duration is configured for this user.');\n    const t = token();\n    const expiresAt = new Date(Date.now() + ms);\n    try {\n      await setDoc(doc(db, 'williTokens', t), { token: t, userId: u.uid || u.id, username: u.username || '', categories: issueCategories, activeCategory: issueCategories[0], duration: chosen, durationMs: ms, createdAt: serverTimestamp(), expiresAt, used: false });\n      setGenerated(t); setCopied(false); await load();\n    } catch { alert('Could not create the token.'); }\n  };";
if (admin.includes(oldCreate)) admin = admin.replace(oldCreate, newCreate);
else if (!admin.includes('categories: issueCategories')) throw new Error('Admin token generator block not found');

if (!admin.includes('Token categories')) {
  const marker = '<h4 className="flex items-center gap-2 font-black"><KeyRound size={18}/> WilliToken</h4>';
  const ui = marker + "<p className=\"mt-2 text-xs font-bold text-slate-400\">Token categories determine which EDUWILLS category this token can activate. Select one or more.</p><div className=\"mt-3 flex flex-wrap gap-2\">{CATEGORIES.map(c => <button type=\"button\" key={c} onClick={() => setTokenCategories(v => v.includes(c) ? v.filter(x => x !== c) : [...v, c])} className={tokenCategories.includes(c) ? 'rounded-full border border-cyan-300 bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950' : 'rounded-full border border-white/10 bg-slate-900 px-3 py-2 text-xs font-black text-slate-300'}>{tokenCategories.includes(c) ? '✓ ' : ''}{c}</button>)}</div>";
  if (admin.includes(marker)) admin = admin.replace(marker, ui);
}

fs.writeFileSync(adminPath, admin);
console.log('EDUWILLS category switching and category-aware WilliToken generation verified/applied.');
