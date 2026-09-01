import fs from 'node:fs';

const path = 'app/admin/page.tsx';
let s = fs.readFileSync(path, 'utf8');

// Normalize category data safely when loading legacy token records.
s = s.replace(
  "setTokens(t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));",
  "setTokens(t.docs.map(x => { const data = x.data() || {}; const rawCategories = data.categories; const categories = Array.isArray(rawCategories) ? rawCategories.map(String).filter(Boolean) : (typeof rawCategories === 'string' ? (() => { try { const parsed = JSON.parse(rawCategories); return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : rawCategories ? [rawCategories] : []; } catch { return rawCategories ? [rawCategories] : []; } })() : []); return { id: x.id, ...data, categories } as WilliToken; }));"
);
s = s.replace("(t.categories || []).join(' ')", "(Array.isArray(t.categories) ? t.categories : []).join(' ')");
s = s.replace("t.categories?.join(', ') || 'No category recorded'", "(Array.isArray(t.categories) && t.categories.length ? t.categories.join(', ') : 'No category recorded')");

// Make expiry parsing work with Firestore Timestamp, Date, ISO strings and numbers.
const oldExpiry = "  const explicit = token.expiresAt?.toDate?.();\n  if (explicit instanceof Date) return explicit;\n  const created = token.createdAt?.toDate?.();\n  if (created instanceof Date && typeof token.durationMs === 'number') return new Date(created.getTime() + token.durationMs);\n  return null;";
const newExpiry = "  const rawExplicit = token.expiresAt;\n  const explicit = typeof rawExplicit?.toDate === 'function' ? rawExplicit.toDate() : rawExplicit instanceof Date ? rawExplicit : rawExplicit ? new Date(rawExplicit) : null;\n  if (explicit instanceof Date && Number.isFinite(explicit.getTime())) return explicit;\n  const rawCreated = token.createdAt;\n  const created = typeof rawCreated?.toDate === 'function' ? rawCreated.toDate() : rawCreated instanceof Date ? rawCreated : rawCreated ? new Date(rawCreated) : null;\n  if (created instanceof Date && Number.isFinite(created.getTime()) && typeof token.durationMs === 'number' && Number.isFinite(token.durationMs)) return new Date(created.getTime() + token.durationMs);\n  return null;";
if (s.includes(oldExpiry)) s = s.replace(oldExpiry, newExpiry);

// Permanently remove revoked, cancelled and expired token documents during Admin load.
const oldTokenLoad = "      const tokenDocs = t.docs;\n\n      // One-time migration: every WilliToken that existed before this change";
const newTokenLoad = "      const tokenDocs = t.docs;\n      const nowMs = Date.now();\n      const disposableTokens = tokenDocs.filter(d => {\n        const data = d.data() || {};\n        if (data.revoked === true || data.cancelled === true) return true;\n        const exp = tokenExpiry({ id: d.id, ...data } as WilliToken);\n        return !!exp && exp.getTime() <= nowMs;\n      });\n      if (disposableTokens.length) {\n        await Promise.all(disposableTokens.map(d => deleteDoc(d.ref).catch(() => undefined)));\n      }\n      const liveTokenDocs = tokenDocs.filter(d => !disposableTokens.some(x => x.id === d.id));\n\n      // One-time migration: every WilliToken that existed before this change";
if (s.includes(oldTokenLoad)) s = s.replace(oldTokenLoad, newTokenLoad);
s = s.replace("      const legacyActive = tokenDocs.filter(d => {", "      const legacyActive = liveTokenDocs.filter(d => {");
s = s.replace(
  "      setTokens(t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));",
  "      setTokens(liveTokenDocs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));"
);

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
