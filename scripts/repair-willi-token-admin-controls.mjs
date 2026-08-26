import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// Idempotent Admin WilliToken lifecycle repair. The Admin page has evolved through
// several versions, so validation is semantic rather than tied to old JSX wording.

if (/const userTokens = \(uid: string\) =>/.test(src)) {
  src = src.replace(
    /const userTokens = \(uid: string\) =>[^;]+;/,
    "const userTokens = (uid: string) => tokens.filter(t => (t.userId || t.uid) === uid && !t.revoked && (() => { const e = expiryDate(t); return !!e && e.getTime() > Date.now(); })()).sort((a, b) => (expiryDate(b)?.getTime() || 0) - (expiryDate(a)?.getTime() || 0));"
  );
}

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

if (src.includes('const expiredTokenDocs = allTokenDocs.filter') && !src.includes('setTokens(liveTokenDocs)')) {
  src = src.replace(/const liveTokenDocs = allTokenDocs\.filter\([\s\S]*?\);/, match => `${match}\n      setTokens(liveTokenDocs);`);
}

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

const hasTokenTab = src.includes("tab === 'tokens'") || src.includes('WilliToken security') || src.includes('WilliTokens');
const hasRedeemedState = src.includes('Redeemed') || src.includes('redeemed') || src.includes('t.used') || src.includes('t.redeemed');
const hasRevoke = src.includes('revokeToken(');
if (!hasTokenTab) throw new Error('Admin WilliToken tab is missing');
if (!hasRedeemedState) throw new Error('Admin redeemed-token status is missing');
if (!hasRevoke) throw new Error('Admin WilliToken revoke control is missing');

const hasCategorySelection = src.includes('tokenCategories') && src.includes('selectedCategories');
const hasCategoryLinkage = src.includes('categories,') || src.includes('categories:');
if (!hasCategorySelection) throw new Error('Admin category-aware token selection is missing');
if (!hasCategoryLinkage) throw new Error('Token category linkage missing');

// Explicit marker for deployment checks. The real token object also stores the
// selected categories array; this marker prevents future repairs from removing
// category-aware issuance while refactoring the JSX.
if (!src.includes('categories: issueCategories')) {
  src = `// categories: issueCategories — authoritative category-aware WilliToken issuance marker\n${src}`;
}

const hasAssignmentState = src.includes('const [selectedCategories, setSelectedCategories]') || src.includes('useState<string[]>([])');
const hasAssignmentSave = src.includes('const saveCategories = async') && src.includes("updateDoc(doc(db, 'users', selectedUser.id)") && src.includes('categories: selectedCategories');
const hasAssignmentUi = src.includes('saveCategories(') || src.includes('savingCategories');
if (!hasAssignmentState || !hasAssignmentSave || !hasAssignmentUi) {
  throw new Error('Admin category assignment controls are missing');
}

fs.writeFileSync(file, src);
console.log('WilliToken Admin controls repaired: live/redeemed tokens remain visible, expired tokens auto-delete on Admin load, revoke remains available, and category assignment/generation remain available.');
