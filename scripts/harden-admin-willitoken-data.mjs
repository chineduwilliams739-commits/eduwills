import fs from 'node:fs';

const path = 'app/admin/page.tsx';
let s = fs.readFileSync(path, 'utf8');

// Normalize category data safely when loading legacy token records.
const normalizedLoad = "setTokens(t.docs.map(x => { const data = x.data() || {}; const rawCategories = data.categories; const categories = Array.isArray(rawCategories) ? rawCategories.map(String).filter(Boolean) : (typeof rawCategories === 'string' ? (() => { try { const parsed = JSON.parse(rawCategories); return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : rawCategories ? [rawCategories] : []; } catch { return rawCategories ? [rawCategories] : []; } })() : []); return { id: x.id, ...data, categories } as WilliToken; }));";
const basicLoad = "setTokens(t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));";
if (s.includes(basicLoad)) s = s.replace(basicLoad, normalizedLoad);
s = s.replace("(t.categories || []).join(' ')", "(Array.isArray(t.categories) ? t.categories : []).join(' ')");
s = s.replace("t.categories?.join(', ') || 'No category recorded'", "(Array.isArray(t.categories) && t.categories.length ? t.categories.join(', ') : 'No category recorded')");

// Make expiry parsing work with Firestore Timestamp, Date, ISO strings and numbers.
const oldExpiry = "  const explicit = token.expiresAt?.toDate?.();\n  if (explicit instanceof Date) return explicit;\n  const created = token.createdAt?.toDate?.();\n  if (created instanceof Date && typeof token.durationMs === 'number') return new Date(created.getTime() + token.durationMs);\n  return null;";
const newExpiry = "  const rawExplicit = token.expiresAt;\n  const explicit = typeof rawExplicit?.toDate === 'function' ? rawExplicit.toDate() : rawExplicit instanceof Date ? rawExplicit : rawExplicit ? new Date(rawExplicit) : null;\n  if (explicit instanceof Date && Number.isFinite(explicit.getTime())) return explicit;\n  const rawCreated = token.createdAt;\n  const created = typeof rawCreated?.toDate === 'function' ? rawCreated.toDate() : rawCreated instanceof Date ? rawCreated : rawCreated ? new Date(rawCreated) : null;\n  if (created instanceof Date && Number.isFinite(created.getTime()) && typeof token.durationMs === 'number' && Number.isFinite(token.durationMs)) return new Date(created.getTime() + token.durationMs);\n  return null;";
if (s.includes(oldExpiry)) s = s.replace(oldExpiry, newExpiry);

// The previous hardening script targeted an old token-loading block that no longer exists.
// Patch the current Admin load directly: every revoked/cancelled/expired token is physically
// deleted from Firestore, and React state is populated only from the surviving documents.
const currentTokenLoad = "      const loadedTokens = t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken));\n      const now = Date.now();\n      const expiredTokens = loadedTokens.filter(token => {\n        const expiry = expiryDate(token);\n        return !!expiry && expiry.getTime() <= now;\n      });\n      if (expiredTokens.length) {\n        await Promise.all(expiredTokens.map(token => deleteDoc(doc(db, 'williTokens', token.id))));\n      }\n      const liveTokens = loadedTokens.filter(token => !expiredTokens.some(expired => expired.id === token.id));";
const hardenedTokenLoad = "      const loadedTokens = t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken));\n      const now = Date.now();\n      const disposableTokens = loadedTokens.filter(token => {\n        const expiry = expiryDate(token);\n        return token.revoked === true || token.cancelled === true || (!!expiry && expiry.getTime() <= now);\n      });\n      if (disposableTokens.length) {\n        await Promise.all(disposableTokens.map(token => deleteDoc(doc(db, 'williTokens', token.id))));\n      }\n      const disposableIds = new Set(disposableTokens.map(token => token.id));\n      const liveTokens = loadedTokens.filter(token => !disposableIds.has(token.id));";
if (s.includes(currentTokenLoad)) s = s.replace(currentTokenLoad, hardenedTokenLoad);

// Crucially, populate React state from the post-cleanup snapshot, not the pre-cleanup snapshot.
const liveState = "      setTokens(liveTokens);";
if (!s.includes(liveState)) {
  s = s.replace(normalizedLoad, liveState);
}

// A redeemed token remains the user's active entitlement until expiry. Do NOT exclude used=true.
const oldActive = "  const activeToken = (uid: string) => userTokens(uid).find(t => { const exp = tokenExpiry(t); return !!exp && exp.getTime() > now; });";
const wrongActive = "  const activeToken = (uid: string) => userTokens(uid).find(t => { const exp = tokenExpiry(t); return !!exp && exp.getTime() > now && t.used !== true; });";
const fixedActive = "  const activeToken = (uid: string) => userTokens(uid).find(t => { const exp = tokenExpiry(t); return !!exp && exp.getTime() > now && t.revoked !== true && t.cancelled !== true; });";
if (s.includes(wrongActive)) s = s.replace(wrongActive, fixedActive);
else if (s.includes(oldActive)) s = s.replace(oldActive, fixedActive);

const oldStatus = "const active = activeToken(uid);\n      rows.push([u.fullName || '', u.username ? `@${u.username}` : '', u.phone || '', categoriesFor(u).join(' | ') || 'Not set', categoryExpiryText(u), active ? 'Active' : 'Inactive'";
const newStatus = "const active = activeToken(uid);\n      const statusActive = !((u as any).activated === false || (u as any).activationStatus === 'inactive' || (u as any).williTokenActive === false) && !!active;\n      rows.push([u.fullName || '', u.username ? `@${u.username}` : '', u.phone || '', categoriesFor(u).join(' | ') || 'Not set', categoryExpiryText(u), statusActive ? 'Active' : 'Inactive'";
if (s.includes(oldStatus)) s = s.replace(oldStatus, newStatus);

s = s.replace(
  "{users.map(u => { const uid = u.uid || u.id; const cats = categoriesFor(u); const active = activeToken(uid); return",
  "{users.map(u => { const uid = u.uid || u.id; const cats = categoriesFor(u); const active = !((u as any).activated === false || (u as any).activationStatus === 'inactive' || (u as any).williTokenActive === false) && !!activeToken(uid); return"
);

fs.writeFileSync(path, s);
console.log('Admin WilliToken cleanup and status reconciliation hardened');
