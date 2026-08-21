import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// This script runs after lifecycle-v4/v5, so it must be idempotent and accept
// both the original Admin implementation and the already-repaired one.
const activeUserTokens = `const userTokens = (uid: string) => tokens.filter(t => {
    const e = tokenExpiry(t);
    return t.userId === uid && !!e && e.getTime() > Date.now();
  }).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));`;

const userTokensMatch = src.match(/const userTokens = \(uid: string\) =>[\s\S]*?;(?=\n\n  const visibleBooks)/);
if (userTokensMatch) {
  src = src.replace(userTokensMatch[0], activeUserTokens);
}

// Make token loading authoritative and idempotent. If v4 already installed
// liveTokenDocs, keep it; otherwise replace the old direct setTokens call.
if (!src.includes('const liveTokenDocs = allTokenDocs.filter')) {
  const loading = /      setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\);/;
  const replacement = `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= nowMs; });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > nowMs; });
      setTokens(liveTokenDocs);`;
  if (loading.test(src)) src = src.replace(loading, replacement);
}

// Ensure the Admin status/export is derived from a valid token rather than a
// stale activated flag. The source may already have the repaired expression.
src = src.replace(/u\.activated \? 'Yes' : 'No'/g, "(userTokens(u.uid || u.id).length > 0 ? 'Yes' : 'No')");

fs.writeFileSync(file, src);
console.log('WilliToken Admin lifecycle finalized: idempotent live-token filtering, used tokens retained until expiry, expired tokens removed.');
