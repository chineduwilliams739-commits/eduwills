import fs from 'node:fs';

const path = 'app/admin/page.tsx';
let s = fs.readFileSync(path, 'utf8');

const oldLoad = "setTokens(t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));";
const newLoad = "setTokens(t.docs.map(x => { const data = x.data() || {}; const rawCategories = data.categories; const categories = Array.isArray(rawCategories) ? rawCategories.map(String).filter(Boolean) : (typeof rawCategories === 'string' ? (() => { try { const parsed = JSON.parse(rawCategories); return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : rawCategories ? [rawCategories] : []; } catch { return rawCategories ? [rawCategories] : []; } })() : []); return { id: x.id, ...data, categories } as WilliToken; }));";
if (s.includes(oldLoad)) s = s.replace(oldLoad, newLoad);

s = s.replace("(t.categories || []).join(' ')", "(Array.isArray(t.categories) ? t.categories : []).join(' ')");
s = s.replace("t.categories?.join(', ') || 'No category recorded'", "(Array.isArray(t.categories) && t.categories.length ? t.categories.join(', ') : 'No category recorded')");

const oldExpiry = "  const explicit = token.expiresAt?.toDate?.();\n  if (explicit instanceof Date) return explicit;\n  const created = token.createdAt?.toDate?.();\n  if (created instanceof Date && typeof token.durationMs === 'number') return new Date(created.getTime() + token.durationMs);\n  return null;";
const newExpiry = "  const rawExplicit = token.expiresAt;\n  const explicit = typeof rawExplicit?.toDate === 'function' ? rawExplicit.toDate() : rawExplicit instanceof Date ? rawExplicit : rawExplicit ? new Date(rawExplicit) : null;\n  if (explicit instanceof Date && Number.isFinite(explicit.getTime())) return explicit;\n  const rawCreated = token.createdAt;\n  const created = typeof rawCreated?.toDate === 'function' ? rawCreated.toDate() : rawCreated instanceof Date ? rawCreated : rawCreated ? new Date(rawCreated) : null;\n  if (created instanceof Date && Number.isFinite(created.getTime()) && typeof token.durationMs === 'number' && Number.isFinite(token.durationMs)) return new Date(created.getTime() + token.durationMs);\n  return null;";
if (s.includes(oldExpiry)) s = s.replace(oldExpiry, newExpiry);

// Remove revoked/cancelled/expired WilliTokens from the Firestore-backed Admin view
// and keep the source UI state consistent with what actually grants access.
const oldTokenLoadBlock = "      const tokenDocs = t.docs;\n\n      // One-time migration: every WilliToken that existed before this change";
const newTokenLoadBlock = "      const tokenDocs = t.docs;\n      const nowMs = Date.now();\n      const disposableTokens = tokenDocs.filter(d => {\n        const data = d.data() || {};\n        if (data.revoked === true || data.cancelled === true) return true;\n        const exp = tokenExpiry({ id: d.id, ...data } as WilliToken);\n        return !!exp && exp.getTime() <= nowMs;\n      });\n      if (disposableTokens.length) {\n        await Promise.all(disposableTokens.map(d => deleteDoc(d.ref)));\n      }\n      const liveTokenDocs = tokenDocs.filter(d => !disposableTokens.some(x => x.id === d.id));\n\n      // One-time migration: every WilliToken that existed before this change";
if (s.includes(oldTokenLoadBlock)) s = s.replace(oldTokenLoadBlock, newTokenLoadBlock);
s = s.replace("      const legacyActive = tokenDocs.filter(d => {", "      const legacyActive = liveTokenDocs.filter(d => {");
s = s.replace("      setTokens(t.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));", "      setTokens(liveTokenDocs.map(x => ({ id: x.id, ...x.data() } as WilliToken)));\n      ");

// The Admin badge must not use stale activation fields alone. It is active only
// when a current, usable token exists and the user has not explicitly been made inactive.
const oldActiveLine = "  const activeToken = (uid: string) => userTokens(uid).find(t => { const exp = tokenExpiry(t); return !!exp && exp.getTime() > now; });";
const newActiveLine = "  const activeToken = (uid: string) => userTokens(uid).find(t => { const exp = tokenExpiry(t); return !!exp && exp.getTime() > now && t.used !== true; });\n  const isAdminUserActive = (u: User, uid: string) => {\n    if (u.uid && u.uid !== uid) return false;\n    if (u.activated === false || (u as any).activationStatus === 'inactive' || (u as any).williTokenActive === false) return false;\n    return !!activeToken(uid);\n  };";
if (s.includes(oldActiveLine)) s = s.replace(oldActiveLine, newActiveLine);
s = s.replace("const active = activeToken(uid);\n      rows.push([u.fullName || '', u.username ? `@${u.username}` : '', u.phone || '', categoriesFor(u).join(' | ') || 'Not set', categoryExpiryText(u), active ? 'Active' : 'Inactive'", "const active = activeToken(uid);\n      const statusActive = isAdminUserActive(u, uid);\n      rows.push([u.fullName || '', u.username ? `@${u.username}` : '', u.phone || '', categoriesFor(u).join(' | ') || 'Not set', categoryExpiryText(u), statusActive ? 'Active' : 'Inactive'");
s = s.replace("{users.map(u => { const uid = u.uid || u.id; const cats = categoriesFor(u); const active = activeToken(uid); return", "{users.map(u => { const uid = u.uid || u.id; const cats = categoriesFor(u); const active = isAdminUserActive(u, uid); return");

fs.writeFileSync(path, s);
console.log('Admin WilliToken runtime hardening, cleanup and status reconciliation applied');
