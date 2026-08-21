import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// Keep every non-expired token visible to Admin, including redeemed tokens.
// Expired tokens are deleted automatically whenever Admin data is loaded.
const userTokensOld = "  const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && !t.used).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));";
const userTokensNew = "  const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && !!tokenExpiry(t) && tokenExpiry(t)!.getTime() > Date.now()).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));";
if (src.includes(userTokensOld)) src = src.replace(userTokensOld, userTokensNew);
else if (!src.includes(userTokensNew)) throw new Error('Admin userTokens declaration not found');

// Replace the raw token load with live-token loading + automatic expiry cleanup.
const rawLoad = "      setTokens(t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken)));";
const liveLoad = `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !e || e.getTime() <= nowMs; });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > nowMs; });
      setTokens(liveTokenDocs);`;
if (src.includes(rawLoad)) src = src.replace(rawLoad, liveLoad);
else if (!src.includes('const liveTokenDocs = allTokenDocs.filter')) throw new Error('Admin token loading section not found');

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

// Replace the old per-user token list with a real control centre: redeemed state,
// category linkage, exact expiry and revoke controls remain visible until expiry.
const oldSection = /<div className="mt-5"><p className="text-xs font-black uppercase tracking-\[\.16em\] text-slate-400">Active token expiry<\/p>[\s\S]*?<\/div><\/div><\/div>}<\/section>}/;
const newSection = `<div className="mt-5 rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">WilliToken Control Centre</p><h4 className="mt-1 text-lg font-black">Active tokens & redemption status</h4><p className="mt-1 text-xs text-slate-400">Every non-expired token remains visible here whether it is unused or redeemed. Expired tokens are deleted automatically.</p></div><span className="rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-cyan-200">{userTokens(selectedUser.uid || selectedUser.id).length} live</span></div><div className="mt-4 space-y-3">{userTokens(selectedUser.uid || selectedUser.id).map(t => { const exp = tokenExpiry(t); const live = !!exp && exp.getTime() > Date.now(); return <div key={t.id} className="rounded-2xl border border-white/10 bg-slate-900/90 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><code className="break-all font-black tracking-widest text-white">{t.token || t.id}</code><div className="mt-2 flex flex-wrap gap-2"><span className={t.used ? 'rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-black text-amber-200' : 'rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-200'}>{t.used ? 'Redeemed · active' : 'Unused · ready to activate'}</span><span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[11px] font-black text-violet-200">{(t.categories || categoriesFor(selectedUser)).join(', ') || 'Category not set'}</span></div></div><div className="flex items-center gap-2"><span className={live ? 'text-emerald-300' : 'text-red-300'}>{remaining(exp)}</span><button onClick={() => revokeToken(t)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 hover:bg-red-500/20"><Trash2 size={14}/> Revoke</button></div></div><p className="mt-3 text-xs text-slate-400">Duration: {t.duration || 'Not recorded'} · Expires: {formatExpiry(exp)}</p></div>); })}{!userTokens(selectedUser.uid || selectedUser.id).length && <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-center text-sm text-slate-500">No non-expired WilliToken for this user.</p>}</div></div></div></div></section>}`;
if (oldSection.test(src)) src = src.replace(oldSection, newSection);
else if (!src.includes('WilliToken Control Centre')) throw new Error('Existing Admin token UI section not found');

// Keep user activation/export status derived from a live token, not the stale activated flag.
src = src.replace(/u\.activated \? 'Yes' : 'No'/g, "(userTokens(u.uid || u.id).length > 0 ? 'Yes' : 'No')");

fs.writeFileSync(file, src);
console.log('WilliToken Admin control centre restored: redeemed live tokens are visible, revocation is available, and expired tokens are automatically deleted.');
