import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// Final Admin lifecycle repair. This script is intentionally idempotent and
// does not depend on exact output produced by earlier repair scripts.
const activeUserTokens = `const userTokens = (uid: string) => tokens.filter(t => {
    const e = tokenExpiry(t);
    return t.userId === uid && !!e && e.getTime() > Date.now();
  }).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));`;

// Replace the complete userTokens declaration regardless of whether an
// earlier repair left the original one-line filter or a multiline version.
const userTokensStart = src.indexOf('const userTokens = (uid: string) =>');
if (userTokensStart >= 0) {
  const userTokensEnd = src.indexOf('\n\n  const visibleBooks', userTokensStart);
  if (userTokensEnd >= 0) {
    src = src.slice(0, userTokensStart) + activeUserTokens + src.slice(userTokensEnd);
  }
} else {
  throw new Error('Admin userTokens declaration not found');
}

// Replace the token-loading assignment with authoritative live-token loading.
// It deliberately keeps both used and unused tokens until their real expiry.
const directLoad = /      setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\);/;
const alreadyLiveLoad = /      const allTokenDocs = t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\);[\s\S]*?setTokens\(liveTokenDocs\);/;
const liveLoad = `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= nowMs; });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > nowMs; });
      setTokens(liveTokenDocs);`;

if (alreadyLiveLoad.test(src)) {
  // Keep an existing correct implementation.
} else if (directLoad.test(src)) {
  src = src.replace(directLoad, liveLoad);
} else {
  // Handle a repaired loader that uses a differently named intermediate array.
  const setTokensLine = /      setTokens\([\s\S]*?\);(?=\n      if \(p\.exists\(\)\))/;
  if (setTokensLine.test(src)) src = src.replace(setTokensLine, liveLoad);
  else throw new Error('Admin token loading section not found');
}

// Exported/user status must be based on a currently live WilliToken, not the
// stale users.activated flag.
src = src.replace(/u\.activated \? 'Yes' : 'No'/g, "(userTokens(u.uid || u.id).length > 0 ? 'Yes' : 'No')");

fs.writeFileSync(file, src);
console.log('WilliToken Admin lifecycle finalized: live generated tokens retained, redeemed tokens retained until expiry, expired tokens deleted, and active status derived from live tokens.');
