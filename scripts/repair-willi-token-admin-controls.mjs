import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// Keep every non-expired token visible to Admin, including redeemed tokens.
// Expired tokens are deleted automatically whenever Admin data is loaded.
const userTokensOld = "  const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && !t.used).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));";
const userTokensNew = "  const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && !!tokenExpiry(t) && tokenExpiry(t)!.getTime() > Date.now()).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));";
if (src.includes(userTokensOld)) src = src.replace(userTokensOld, userTokensNew);
else if (!src.includes(userTokensNew)) throw new Error('Admin userTokens declaration not found');

// Load every live token and delete only genuinely expired records.
const rawLoad = "      setTokens(t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken)));";
const liveLoad = `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !e || e.getTime() <= nowMs; });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > nowMs; });
      setTokens(liveTokenDocs);`;
if (src.includes(rawLoad)) src = src.replace(rawLoad, liveLoad);
else if (!src.includes('const liveTokenDocs = allTokenDocs.filter')) throw new Error('Admin token loading section not found');

// Save the administrator's category assignment for the selected user.
if (!src.includes('const assignUserCategories = async')) {
  const marker = "  const removeBook = async (book: Slot) => {";
  const helper = `  const assignUserCategories = async (u: User, nextCategories: string[]) => {
    const uid = u.uid || u.id;
    const categories = [...new Set(nextCategories.filter(Boolean))];
    try {
      await setDoc(doc(db, 'users', uid), {
        categories,
        category: categories[0] || '',
        educationLevels: categories,
        educationLevel: categories[0] || '',
        schoolLevels: categories,
        schoolLevel: categories[0] || '',
        categoryAssignedByAdmin: true,
        categoryAssignedAt: serverTimestamp(),
      }, { merge: true });
      setUsers(v => v.map(x => (x.uid || x.id) === uid ? { ...x, categories, category: categories[0] || '', educationLevels: categories, educationLevel: categories[0] || '', schoolLevels: categories, schoolLevel: categories[0] || '' } : x));
      alert(categories.length ? 'User category assignment saved.' : 'User category assignment cleared.');
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can assign categories.' : 'Could not save the category assignment.');
    }
  };

`;
  if (!src.includes(marker)) throw new Error('Admin removeBook marker not found');
  src = src.replace(marker, helper + marker);
}

// Add an explicit revoke action if the current page does not already have one.
if (!src.includes('const revokeToken = async')) {
  const marker = "  const removeBook = async (book: Slot) => {";
  const helper = `  const revokeToken = async (t: WilliToken) => {
    const code = t.token || t.id;
    if (!window.confirm(\`Revoke WilliToken \${code}?\\n\\nThis immediately removes the token and disables its activation. The code cannot be used again.\`)) return;
    try {
      await deleteDoc(doc(db, 'williTokens', t.id));
      setTokens(v => v.filter(x => x.id !== t.id));
      setGenerated(g => g === code ? '' : g);
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can revoke WilliTokens.' : 'Could not revoke this WilliToken.');
    }
  };

`;
  if (!src.includes(marker)) throw new Error('Admin removeBook marker not found');
  src = src.replace(marker, helper + marker);
}

// Add the category-assignment panel immediately before the WilliToken controls.
if (!src.includes('Assign learner categories')) {
  const marker = '<div className="mt-5 border-t border-white/10 pt-5"><h4 className="flex items-center gap-2 font-black"><KeyRound size={18}/> WilliToken</h4>';
  const assignment = `<div className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-400/5 p-4"><div className="flex items-center gap-2"><Settings2 size={17} className="text-violet-300"/><div><p className="text-xs font-black uppercase tracking-[.16em] text-violet-300">Account assignment</p><h4 className="mt-1 font-black">Assign learner categories</h4></div></div><p className="mt-2 text-xs text-slate-400">Admins assign one or more categories. The assignment controls which category the learner can switch to and which categories are attached to newly generated WilliTokens.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{CATEGORIES.map(c => { const checked = categoriesFor(selectedUser).includes(c); return <label key={c} className={\`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm font-black \${checked ? 'border-violet-300/40 bg-violet-400/10 text-violet-100' : 'border-white/10 bg-slate-900 text-slate-300'}\`}><input type="checkbox" checked={checked} onChange={e => { const next = e.target.checked ? [...categoriesFor(selectedUser), c] : categoriesFor(selectedUser).filter(x => x !== c); setUsers(v => v.map(x => (x.uid || x.id) === (selectedUser.uid || selectedUser.id) ? { ...x, categories: next, category: next[0] || '', educationLevels: next, educationLevel: next[0] || '', schoolLevels: next, schoolLevel: next[0] || '' } : x)); }} className="accent-violet-400"/><span>{c}</span></label>; })}</div><button onClick={() => assignUserCategories(selectedUser, categoriesFor(selectedUser))} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-black text-slate-950"><Check size={16}/> Save assignment</button></div>`;
  if (!src.includes(marker)) throw new Error('WilliToken section insertion point not found');
  src = src.replace(marker, assignment + marker);
}

// Add a dedicated live-token control centre immediately before the existing token list.
// Anchor by semantic text instead of brittle full JSX so later styling changes do not break the repair.
if (!src.includes('WilliToken Control Centre')) {
  const label = '>Active token expiry</p>';
  const labelIndex = src.indexOf(label);
  if (labelIndex < 0) throw new Error('Active token expiry label not found');
  const anchorStart = src.lastIndexOf('<div', labelIndex);
  if (anchorStart < 0) throw new Error('Active token expiry container not found');
  const controlCentre = `<div className="mt-5 rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">WilliToken Control Centre</p><h4 className="mt-1 text-lg font-black">Live tokens & redemption status</h4><p className="mt-1 text-xs text-slate-400">Every non-expired WilliToken remains visible whether unused or redeemed. Expired records are deleted automatically when Admin data loads.</p></div><span className="rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-cyan-200">{userTokens(selectedUser.uid || selectedUser.id).length} live</span></div><div className="mt-4 space-y-3">{userTokens(selectedUser.uid || selectedUser.id).map(t => { const exp = tokenExpiry(t); return <div key={t.id} className="rounded-2xl border border-white/10 bg-slate-900/90 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><code className="break-all font-black tracking-widest text-white">{t.token || t.id}</code><div className="mt-2 flex flex-wrap gap-2"><span className={t.used ? 'rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-black text-amber-200' : 'rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-200'}>{t.used ? 'Redeemed · active' : 'Unused · ready to activate'}</span><span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] font-black text-violet-200">{(t.categories || categoriesFor(selectedUser)).join(', ') || 'Category not set'}</span></div></div><div className="flex items-center gap-2"><span className="text-emerald-300">{remaining(exp)}</span><button onClick={() => revokeToken(t)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/20"><Trash2 size={14}/> Revoke</button></div></div><p className="mt-3 text-xs text-slate-400">Duration: {t.duration || 'Not recorded'} · Expires: {formatExpiry(exp)}</p></div>); })}{!userTokens(selectedUser.uid || selectedUser.id).length && <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-center text-sm text-slate-500">No non-expired WilliToken for this user.</p>}</div></div>\n`;
  src = src.slice(0, anchorStart) + controlCentre + src.slice(anchorStart);
}

// The older list also includes redeemed live tokens because userTokens() is live-token based.
src = src.replace('Active token expiry', 'Live token expiry history');

// Export/admin user status should be derived from a live WilliToken rather than a stale activated flag.
src = src.replace(/u\.activated \? 'Yes' : 'No'/g, "(userTokens(u.uid || u.id).length > 0 ? 'Yes' : 'No')");

fs.writeFileSync(file, src);
console.log('WilliToken Admin controls fixed: category assignment, redeemed-token visibility, revoke controls and automatic expiry cleanup are wired safely.');
