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

fs.writeFileSync(path, s);
console.log('Admin WilliToken runtime hardening applied');
