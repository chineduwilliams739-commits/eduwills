import fs from 'node:fs';

// Safe CI repair/validation for the WilliToken lifecycle.
// Never rewrites the Admin page wholesale. If the Admin loader is missing
// expiry cleanup, patch only its exact token-loading statement.

const adminPath = 'app/admin/page.tsx';
const aiPath = 'app/dashboard/ai/page.tsx';

if (!fs.existsSync(adminPath)) throw new Error(`Required EDUWILLS file is missing: ${adminPath}`);
if (!fs.existsSync(aiPath)) throw new Error(`Required EDUWILLS file is missing: ${aiPath}`);

let admin = fs.readFileSync(adminPath, 'utf8');
const ai = fs.readFileSync(aiPath, 'utf8');

if (!admin.includes('const userTokens')) throw new Error('Admin WilliToken handling is missing.');
if (!admin.includes('expiryDate')) throw new Error('Admin expiry handling is missing.');
if (!ai.includes('getAiEntitlement')) throw new Error('EDUWILLS AI entitlement handling is missing.');

// Keep every live token in the Active token expiry data and delete expired
// documents when Admin data is loaded. This exact, local replacement avoids
// the source-corruption problem caused by earlier broad regular expressions.
if (!admin.includes('expiredTokenDocs')) {
  const needle = "      setTokens(t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));";
  const replacement = `      const allTokenDocs = t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = expiryDate(x); return !!e && e.getTime() <= nowMs; });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = expiryDate(x); return !!e && e.getTime() > nowMs; });
      setTokens(liveTokenDocs);`;

  if (!admin.includes(needle)) {
    throw new Error('Admin WilliToken loader shape is not recognized; refusing unsafe source rewrite.');
  }
  admin = admin.replace(needle, replacement);
  fs.writeFileSync(adminPath, admin);
}

console.log('WilliToken lifecycle validation passed. Expired-token cleanup is present and no broad source rewrite was performed.');
