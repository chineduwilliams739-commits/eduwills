import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// Final Admin WilliToken lifecycle repair. Idempotent and safe after earlier repairs.
const activeUserTokens = `const userTokens = (uid: string) => tokens.filter(t => {
    const e = tokenExpiry(t);
    return t.userId === uid && !!e && e.getTime() > Date.now();
  }).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));`;

const userTokensStart = src.indexOf('const userTokens = (uid: string) =>');
if (userTokensStart >= 0) {
  const userTokensEnd = src.indexOf('\n\n  const visibleBooks', userTokensStart);
  if (userTokensEnd >= 0) src = src.slice(0, userTokensStart) + activeUserTokens + src.slice(userTokensEnd);
} else throw new Error('Admin userTokens declaration not found');

// Load every live token, regardless of used state; delete only genuinely expired records.
const directLoad = /      setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\);/;
const alreadyLiveLoad = /      const allTokenDocs = t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\);[\s\S]*?setTokens\(liveTokenDocs\);/;
const liveLoad = `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= nowMs; });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > nowMs; });
      setTokens(liveTokenDocs);`;

if (alreadyLiveLoad.test(src)) {
  // Already correct.
} else if (directLoad.test(src)) {
  src = src.replace(directLoad, liveLoad);
} else {
  const setTokensLine = /      setTokens\([\s\S]*?\);(?=\n      if \(p\.exists\(\)\))/;
  if (setTokensLine.test(src)) src = src.replace(setTokensLine, liveLoad);
  else throw new Error('Admin token loading section not found');
}

// Active status/export must use a redeemed, non-expired token, not stale users.activated.
src = src.replace(/u\.activated \? 'Yes' : 'No'/g, "(userTokens(u.uid || u.id).length > 0 ? 'Yes' : 'No')");

// Earlier Admin repair introduced tokenIsActive. It must mean live, not unused: used tokens stay active until expiry.
src = src.replace(/const tokenIsActive = \(t: WilliToken\) => \{[\s\S]*?\n  \};/m, `const tokenIsActive = (t: WilliToken) => {
    const exp = tokenExpiry(t);
    return !!exp && exp.getTime() > Date.now();
  };`);

// If the helper was not present, add it before load.
if (!src.includes('const tokenIsActive = (t: WilliToken) =>')) {
  const marker = '  const load = async (showRefresh = false) => {';
  const helper = `  const tokenIsActive = (t: WilliToken) => { const exp = tokenExpiry(t); return !!exp && exp.getTime() > Date.now(); };

  const purgeInactiveTokens = async () => {
    const snap = await getDocs(collection(db, 'williTokens'));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
    const expired = all.filter(t => { const e = tokenExpiry(t); return !e || e.getTime() <= Date.now(); });
    if (!expired.length) return 0;
    await Promise.all(expired.map(t => deleteDoc(doc(db, 'williTokens', t.id)).catch(() => undefined)));
    return expired.length;
  };

`;
  if (!src.includes(marker)) throw new Error('Admin load marker not found');
  src = src.replace(marker, helper + marker);
}

// Ensure revokeToken exists because the Active Token control centre calls it.
if (!src.includes('const revokeToken = async')) {
  const marker = '  const removeBook = async (book: Slot) => {';
  const helper = `  const revokeToken = async (t: WilliToken) => {
    if (!window.confirm(\`Revoke WilliToken \${t.token || t.id}?\\n\\nIt will be removed immediately.\`)) return;
    try {
      await deleteDoc(doc(db, 'williTokens', t.id));
      setTokens(v => v.filter(x => x.id !== t.id));
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can revoke WilliTokens.' : 'Could not revoke this WilliToken.');
    }
  };

`;
  if (!src.includes(marker)) throw new Error('Admin removeBook marker not found');
  src = src.replace(marker, helper + marker);
}

// Correct stale UI copy and make the Active Token control centre include redeemed live tokens.
src = src.replace('Only unused, non-expired tokens are shown. Redeemed or expired records are removed automatically when Admin data loads.', 'All non-expired WilliTokens are shown, whether unused or redeemed. Expired records are removed automatically when Admin data loads.');
src = src.replace('<p className="font-black text-emerald-300">Unused · ready to activate</p>', '<p className="font-black text-emerald-300">{t.used ? \'Active · redeemed\' : \'Unused · ready to activate\'}</p>');

fs.writeFileSync(file, src);
console.log('WilliToken Admin lifecycle finalized: all live tokens retained, redeemed tokens retained until expiry, expired tokens deleted, active status derived from live tokens, and revokeToken defined.');
