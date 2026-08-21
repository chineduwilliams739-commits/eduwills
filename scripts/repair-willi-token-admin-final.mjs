import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

const oldUserTokens = "const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && !t.used).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));";
const newUserTokens = "const userTokens = (uid: string) => tokens.filter(t => { const expiry = tokenExpiry(t); return t.userId === uid && !!expiry && expiry.getTime() > Date.now(); }).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));";
if (src.includes(oldUserTokens)) src = src.replace(oldUserTokens, newUserTokens);
else if (!src.includes(newUserTokens)) throw new Error('Admin userTokens block not found');

const oldSetTokens = "setTokens(t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken)));";
const newSetTokens = "const loadedTokens = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));\n      const now = Date.now();\n      const expired = loadedTokens.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= now; });\n      await Promise.all(expired.map(x => deleteDoc(doc(db, 'williTokens', x.id))));\n      setTokens(loadedTokens.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > now; }));";
if (src.includes(oldSetTokens)) src = src.replace(oldSetTokens, newSetTokens);
else if (!src.includes(newSetTokens)) throw new Error('Admin token loading block not found');

const oldActivated = "u.activated ? 'Yes' : 'No'";
const newActivated = "(userTokens(u.uid || u.id).length > 0 ? 'Yes' : 'No')";
src = src.replace(oldActivated, newActivated);

fs.writeFileSync(file, src);
console.log('WilliToken Admin lifecycle finalized: valid used tokens remain active; expired tokens are removed.');
