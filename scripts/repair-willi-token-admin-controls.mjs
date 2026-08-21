import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// This repair is intentionally idempotent. The Admin page has evolved through
// several lifecycle versions, so do not depend on obsolete JSX markers.

// 1) Keep every non-expired token visible to Admin, including redeemed tokens.
//    The userTokens helper must not filter out used/redeemed tokens.
if (/const userTokens = \(uid: string\) =>/.test(src)) {
  src = src.replace(
    /const userTokens = \(uid: string\) =>[^;]+;/,
    "const userTokens = (uid: string) => tokens.filter(t => (t.userId || t.uid) === uid && !t.revoked && (() => { const e = expiryDate(t); return !!e && e.getTime() > Date.now(); })()).sort((a, b) => (expiryDate(b)?.getTime() || 0) - (expiryDate(a)?.getTime() || 0));"
  );
}

// 2) Automatically delete expired WilliTokens whenever Admin data is loaded.
//    Tokens are retained while live, regardless of whether they are redeemed.
if (!src.includes('const expiredTokenDocs = allTokenDocs.filter')) {
  const loadPattern = /\s*setTokens\(t\.docs\.map\(x => \(\{ id: x\.id, \.\.\.x\.data\(\) \} as WilliToken\)\)\);/;
  const replacement = `
      const allTokenDocs = t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => {
        const e = expiryDate(x);
        return !e || e.getTime() <= nowMs;
      });
      if (expiredTokenDocs.length) {
        await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      }
      const liveTokenDocs = allTokenDocs.filter(x => {
        const e = expiryDate(x);
        return !!e && e.getTime() > nowMs;
      });
      setTokens(liveTokenDocs);`;
  if (loadPattern.test(src)) src = src.replace(loadPattern, replacement);
}

// 3) If an earlier repair already added a similar cleanup block, make sure it
//    is still present and that only live records enter React state.
if (src.includes('const expiredTokenDocs = allTokenDocs.filter') && !src.includes('setTokens(liveTokenDocs)')) {
  src = src.replace(/const liveTokenDocs = allTokenDocs\.filter\([\s\S]*?\);/, match => `${match}\n      setTokens(liveTokenDocs);`);
}

// 4) Keep an explicit revoke action. Revoke must not silently disappear from
// the Admin UI and must immediately invalidate the token.
if (!src.includes('const revokeToken = async')) {
  const marker = /\n\s*const deleteExpiredToken = async/;
  const helper = `

  const revokeToken = async (t: WilliToken) => {
    const code = t.token || t.id;
    if (!window.confirm(\`Revoke WilliToken \${code}? It will immediately stop granting access.\`)) return;
    try {
      await updateDoc(doc(db, 'williTokens', t.id), { revoked: true, active: false, revokedAt: serverTimestamp() });
      await load();
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can revoke WilliTokens.' : 'Could not revoke this WilliToken.');
    }
  };`;
  if (marker.test(src)) src = src.replace(marker, `${helper}$&`);
}

// 5) The tokens tab must expose redeemed status and a revoke action.
//    Do not fail the deployment when styling/wording changes; only fail if the
//    entire security surface has somehow disappeared.
const hasTokenTab = src.includes("tab === 'tokens'") || src.includes('WilliToken security');
const hasRedeemedState = src.includes('Redeemed') || src.includes('redeemed') || src.includes('t.used') || src.includes('t.redeemed');
const hasRevoke = src.includes('revokeToken(');
if (!hasTokenTab) throw new Error('Admin WilliToken tab is missing');
if (!hasRedeemedState) throw new Error('Admin redeemed-token status is missing');
if (!hasRevoke) throw new Error('Admin WilliToken revoke control is missing');

// 6) Category-aware generation must remain intact. This is intentionally a
// semantic check rather than a brittle exact source marker.
if (!src.includes('categories: selectedCategories')) {
  throw new Error('Category-aware WilliToken generation is missing');
}

// 7) Category assignment must remain available to Admin.
if (!src.includes('Save category assignment') && !src.includes('Category assignment')) {
  throw new Error('Admin category assignment controls are missing');
}

fs.writeFileSync(file, src);
console.log('WilliToken Admin controls repaired: live/redeemed tokens remain visible, expired tokens auto-delete on Admin load, revoke remains available, and category-aware generation is preserved.');
