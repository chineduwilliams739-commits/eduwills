import fs from 'node:fs';

const quizFile = 'app/dashboard/quiz/page.tsx';
let q = fs.readFileSync(quizFile, 'utf8');

q = q.replace("const minutes = duration === 'none' ? null : Number(duration);", "const minutes = duration === 'none' ? null : Math.max(5, Number(duration) || 5);");
q = q.replace('className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3"', 'className="relative mx-auto flex max-w-4xl items-center px-5 py-3"');
q = q.replace('<div className="text-center"><div className={`inline-flex items-center gap-2 rounded-full', '<div className="mx-auto text-center"><div className={`inline-flex items-center gap-2 rounded-full');
q = q.replace('className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 shadow-sm"', 'className="absolute left-5 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-black text-red-700 shadow-sm"');
q = q.replace('<span>QUESTION {idx + 1} OF {qs.length}</span><span>{answers.filter((x) => x !== undefined).length} answered</span>', '<span className="sr-only">Question {idx + 1} of {qs.length}</span><span>{answers.filter((x) => x !== undefined).length} answered</span>');
q = q.replace('<section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8"><h1', '<section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8"><p className="mb-2 text-xs font-black uppercase tracking-wider text-eduBlue">Question {idx + 1}</p><h1');
q = q.replace('className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-sm disabled:opacity-40"', 'className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-black disabled:opacity-40"');
q = q.replace('className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-3 font-black text-sm text-white disabled:opacity-40"', 'className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 px-3 py-2.5 text-xs font-black text-white disabled:opacity-40"');
q = q.replace('className="flex-1 rounded-xl bg-ink px-4 py-3 font-black text-sm text-white disabled:opacity-40"', 'className="flex-1 rounded-lg bg-ink px-3 py-2.5 text-xs font-black text-white disabled:opacity-40"');
q = q.replace('{answers.filter((x) => x !== undefined)} answered questions.', '{answers.filter((x) => x !== undefined).length} answered questions.');
fs.writeFileSync(quizFile, q);

const adminFile = 'app/admin/page.tsx';
let a = fs.readFileSync(adminFile, 'utf8');

if (!a.includes("const [customDurationValue, setCustomDurationValue]")) {
  a = a.replace("const [duration, setDuration] = useState('30 days');", "const [duration, setDuration] = useState('30 days');\n  const [customDurationValue, setCustomDurationValue] = useState('30');\n  const [customDurationUnit, setCustomDurationUnit] = useState<'minutes'|'hours'|'days'>('days');");
}
if (!a.includes('function manualDurationMs(')) {
  const marker = 'function remaining(date: Date | null) {';
  const helper = "function manualDurationMs(value: string, unit: 'minutes'|'hours'|'days') { const n = Number(value); if (!Number.isFinite(n) || n <= 0) return 0; return n * (unit === 'minutes' ? 60000 : unit === 'hours' ? 3600000 : 86400000); }\n\n";
  if (!a.includes(marker)) throw new Error('Admin remaining marker not found');
  a = a.replace(marker, helper + marker);
}
a = a.replace("const ms = durations.find(x => x[0] === chosen)?.[1];", "const ms = chosen === 'custom' ? manualDurationMs(customDurationValue, customDurationUnit) : durations.find(x => x[0] === chosen)?.[1];");
a = a.replace("if (!ms) return alert('No valid WilliToken duration is configured for this user.');", "if (!ms) return alert('Enter a valid manual WilliToken duration greater than zero.');");

const oldTokenUI = '<select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold">{durations.map(x => <option key={x[0]} value={x[0]}>{x[0]}</option>)}</select><button onClick={createToken}';
const newTokenUI = '<div className="grid gap-2"><select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold">{durations.map(x => <option key={x[0]} value={x[0]}>{x[0]}</option>)}<option value="custom">Custom duration…</option></select>{duration === \'custom\' && <div className="grid grid-cols-2 gap-2"><input type="number" min="1" step="1" value={customDurationValue} onChange={e => setCustomDurationValue(e.target.value)} placeholder="Amount" className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold"/><select value={customDurationUnit} onChange={e => setCustomDurationUnit(e.target.value as \'minutes\'|\'hours\'|\'days\')} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold"><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div>}</div><button onClick={createToken}';
if (a.includes(oldTokenUI)) a = a.replace(oldTokenUI, newTokenUI); else if (!a.includes('Custom duration…')) throw new Error('Admin WilliToken duration UI marker not found');

if (!a.includes('function tokenExpiry(')) throw new Error('Admin tokenExpiry helper not found');
if (!a.includes('const tokenIsActive =')) {
  const marker = '  const load = async (showRefresh = false) => {';
  const helper = `  const tokenIsActive = (t: WilliToken) => {\n    if (t.used) return false;\n    // Current WilliTokens use durationMs as the activation duration; the countdown starts when redeemed.\n    // Only legacy tokens without durationMs use expiresAt as a pre-redemption expiry.\n    if (typeof t.durationMs === 'number' && t.durationMs > 0) return true;\n    const exp = tokenExpiry(t);\n    return !exp || exp.getTime() > Date.now();\n  };\n\n  const purgeInactiveTokens = async () => {\n    const snap = await getDocs(collection(db, 'williTokens'));\n    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));\n    const inactive = all.filter(t => !tokenIsActive(t));\n    if (!inactive.length) return 0;\n    await Promise.all(inactive.map(t => deleteDoc(doc(db, 'williTokens', t.id))));\n    return inactive.length;\n  };\n\n`;
  if (!a.includes(marker)) throw new Error('Admin load marker not found');
  a = a.replace(marker, helper + marker);
}

if (!a.includes('const activeTokenDocs =')) {
  const old = "      setTokens(t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken)));";
  const replacement = "      const activeTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));\n      setTokens(activeTokenDocs.filter(tokenIsActive));\n      const inactiveTokenDocs = activeTokenDocs.filter(x => !tokenIsActive(x));\n      if (inactiveTokenDocs.length) await Promise.all(inactiveTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id))));";
  if (a.includes(old)) a = a.replace(old, replacement); else if (!a.includes('setTokens(activeTokenDocs.filter(tokenIsActive))')) throw new Error('Admin token loading marker not found; cannot add active-token cleanup safely.');
}

if (!a.includes('const revokeToken = async')) {
  const marker = '  const removeBook = async (book: Slot) => {';
  const helper = `  const revokeToken = async (t: WilliToken) => {\n    if (!window.confirm(\`Revoke WilliToken \${t.token || t.id}?\\n\\nIt will be removed from active tokens and the code can be generated again later.\`)) return;\n    try { await deleteDoc(doc(db, 'williTokens', t.id)); setTokens(v => v.filter(x => x.id !== t.id)); }\n    catch (e: any) { alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can revoke WilliTokens.' : 'Could not revoke this WilliToken.'); }\n  };\n\n`;
  if (!a.includes(marker)) throw new Error('Admin removeBook marker not found');
  a = a.replace(marker, helper + marker);
}

if (!a.includes('Active WilliToken control centre')) {
  const marker = "    {tab === 'accounts' && <section";
  const insert = `    {tab === 'accounts' && <section className="mt-5 space-y-5"><div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/5 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><KeyRound className="text-emerald-300"/><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Active WilliTokens</p></div><h2 className="mt-1 text-2xl font-black">Active WilliToken control centre</h2><p className="mt-1 text-sm text-slate-400">Only unused, non-expired tokens are shown. Redeemed or expired records are removed automatically when Admin data loads.</p></div><button onClick={async () => { try { const n = await purgeInactiveTokens(); alert(n ? ('Removed ' + n + ' inactive WilliToken' + (n === 1 ? '' : 's') + '. The codes can be generated again later.') : 'No inactive WilliTokens found.'); await load(true); } catch { alert('Could not clean inactive WilliTokens.'); } }} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-xs font-black">Clean inactive</button></div><div className="mt-4 space-y-3">{tokens.filter(tokenIsActive).map(t => { const exp = tokenExpiry(t); return <div key={t.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><code className="break-all font-black tracking-widest">{t.token || t.id}</code><p className="mt-2 text-sm font-bold">{t.username ? ('@' + t.username) : userName(t.userId || '')}</p><p className="mt-1 text-xs text-slate-400">Duration: {t.duration || 'Not recorded'} · Categories: {(t.categories || []).join(', ') || 'Not set'}</p></div><div className="text-right text-xs"><p className="font-black text-emerald-300">Unused · ready to activate</p><p className="mt-1 text-slate-500">Activation duration: {t.duration || 'Not recorded'}</p><button onClick={() => revokeToken(t)} className="mt-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 font-black text-red-300">Revoke</button></div></div></div>; })}{!tokens.filter(tokenIsActive).length && <p className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-slate-500">No active WilliTokens. Generate one from the Users section.</p>}</div></div></section>}\n\n`;
  if (!a.includes(marker)) throw new Error('Admin accounts tab marker not found');
  a = a.replace(marker, insert + marker);
}

fs.writeFileSync(adminFile, a);
console.log('Latest quiz positioning, minimum duration, compact controls, manual WilliToken duration, and active-token admin controls applied.');
