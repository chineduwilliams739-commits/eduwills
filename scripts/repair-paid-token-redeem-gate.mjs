import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// Payment confirmation must create a pending token only. No paid category or account activation
// is granted until the user enters that token in the Activation page.
const paymentPath = 'functions/activationPayments.js';
let payment = read(paymentPath);
payment = payment.replace(/const existingCategories = Array\.isArray\(user\.categories\) \? user\.categories : \[\];[\s\S]*?await db\.collection\('users'\)\.doc\(uid\)\.set\(\{[\s\S]*?\}, \{ merge: true \}\);/, `await db.collection('users').doc(uid).set({
    pendingActivationCode: code,
    pendingActivationCodeExpiresAt: codeExpiresAt.toISOString(),
    pendingActivationCategories: categories,
    pendingActivationPaymentReference: paymentReference,
    pendingActivationPaymentStatus: 'success',
    activationPaymentAmount: paymentAmount,
    activationPaymentCurrency: paymentCurrency,
    acquisitionSource: attribution.source,
    acquisitionVisitorId: attribution.visitorId,
    acquisitionLandingPath: attribution.landingPath,
    acquisitionRegion: attribution.region,
    acquisitionTimezone: attribution.timezone,
  }, { merge: true });`);

payment = payment.replace(/used: true, redeemed: true, redeemedBy: uid, redeemedAt: FieldValue\.serverTimestamp\(\), revoked: false, active: true, source: 'paystack'/, "used: false, redeemed: false, revoked: false, active: false, source: 'paystack'");
if (!payment.includes("pendingActivationCode: code") || !payment.includes("used: false, redeemed: false, revoked: false, active: false, source: 'paystack'")) {
  throw new Error('Paid-token redemption gate could not be applied to payment backend.');
}
write(paymentPath, payment);

// Activation-page redemption is the only point at which paid categories are assigned.
const activationPath = 'app/dashboard/activation/page.tsx';
let activation = read(activationPath);
const oldActivationUpdate = `      await updateDoc(userRef, {
        activated: true,
        activationStatus: 'active',
        williTokenActive: true,
        activationExpiresAt: activationExpiry,
        categories: merged,
        category: merged[0] || existing.category || '',
        educationLevels: merged,
        schoolLevels: merged,
      });`;
const newActivationUpdate = `      const activeCategory = categories[0] || existing.activeCategory || merged[0] || '';
      await updateDoc(userRef, {
        activated: true,
        activationStatus: 'active',
        activationActive: true,
        williTokenActive: true,
        activationExpiresAt: activationExpiry,
        categories: merged,
        category: merged[0] || existing.category || '',
        educationLevels: merged,
        schoolLevels: merged,
        activeCategory,
        activeCategoryId: activeCategory ? activeCategory.toLowerCase().replace(/\\s+/g, '-') : '',
        pendingActivationCode: null,
        pendingActivationCodeExpiresAt: null,
        pendingActivationCategories: null,
      });`;
if (activation.includes(oldActivationUpdate)) activation = activation.replace(oldActivationUpdate, newActivationUpdate);
else if (!activation.includes('activeCategoryId: activeCategory')) throw new Error('Activation redemption assignment block not found.');
write(activationPath, activation);

// Admin: status must be token-derived, and revoking the final token must explicitly deactivate the real user document.
const adminPath = 'app/admin/page.tsx';
let admin = read(adminPath);
admin = admin.replace(/function isUserActive\(user: User, tokens: WilliToken\[\]\): boolean \{[\s\S]*?\n\}/, `function isUserActive(user: User, tokens: WilliToken[]): boolean {
  const uid = user.uid || user.id;
  return tokens.some(token => {
    const owner = token.userId || token.uid;
    const expiry = expiryDate(token);
    return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > Date.now();
  });
}`);

const revokeStart = admin.indexOf('  const revokeToken = async (t: WilliToken) => {');
const revokeEnd = admin.indexOf('  const deleteExpiredToken = async', revokeStart);
if (revokeStart < 0 || revokeEnd < 0) throw new Error('Admin revoke function not found.');
const revoke = `  const revokeToken = async (t: WilliToken) => {
    if (!window.confirm(\`Revoke WilliToken \${t.token || t.id}? It will immediately stop granting access.\`)) return;
    try {
      const uid = t.userId || t.uid || '';
      if (!uid) throw new Error('Token has no owner');
      const userDocId = users.find(user => (user.uid || user.id) === uid)?.id || uid;
      await deleteDoc(doc(db, 'williTokens', t.id));

      const remainingSnapshot = await getDocs(collection(db, 'williTokens'));
      const now = Date.now();
      const remainingTokens = remainingSnapshot.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)).filter(token => {
        const owner = token.userId || token.uid;
        const expiry = expiryDate(token);
        return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > now;
      });

      if (remainingTokens.length) {
        const latest = remainingTokens.sort((a, b) => (expiryDate(b)?.getTime() || 0) - (expiryDate(a)?.getTime() || 0))[0];
        const latestExpiry = expiryDate(latest);
        await updateDoc(doc(db, 'users', userDocId), {
          activated: true,
          activationStatus: 'active',
          activationActive: true,
          williTokenActive: true,
          activationExpiresAt: latestExpiry,
          activeWilliToken: latest.token || latest.id,
        });
      } else {
        await updateDoc(doc(db, 'users', userDocId), {
          activated: false,
          activationStatus: 'inactive',
          activationActive: false,
          williTokenActive: false,
          activationExpiresAt: null,
          activeWilliToken: null,
        });
      }
      await load(true);
    } catch { alert('Could not revoke this WilliToken.'); }
  };

`;
admin = admin.slice(0, revokeStart) + revoke + admin.slice(revokeEnd);

const saveStart = admin.indexOf('  const saveCategories = async () => {');
const saveEnd = admin.indexOf('  const exportUsers =', saveStart);
if (saveStart < 0 || saveEnd < 0) throw new Error('Admin category assignment function not found.');
const save = `  const saveCategories = async () => {
    if (!selectedUser) return;
    setSavingCategories(true);
    try {
      const categories = [...new Set(selectedCategories.map(normalizeCategory).filter(category => issueCategories.includes(category as typeof issueCategories[number])))];
      if (!categories.length) throw new Error('Select at least one valid category.');
      const activeCategory = categories.includes(selectedUser.activeCategory as string) ? selectedUser.activeCategory : categories[0];
      await setDoc(doc(db, 'users', selectedUser.id), {
        categories,
        category: categories[0],
        educationLevels: categories,
        schoolLevels: categories,
        activeCategory,
        activeCategoryId: activeCategory.toLowerCase().replace(/\\s+/g, '-'),
      }, { merge: true });
      setSelectedCategories(categories);
      setTokenCategories(categories);
      await load(true);
      alert('User category assignment saved.');
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can assign categories.' : e?.message || 'Could not save category assignment.');
    } finally { setSavingCategories(false); }
  };

`;
admin = admin.slice(0, saveStart) + save + admin.slice(saveEnd);
if (!admin.includes('activeWilliToken: null') || !admin.includes('const userDocId = users.find')) throw new Error('Admin revoke deactivation safeguards missing.');
write(adminPath, admin);

// Dashboard: never treat stale account flags as active without a future activation expiry.
const dashboardPath = 'app/dashboard/page.tsx';
let dashboard = read(dashboardPath);
dashboard = dashboard.replace(/function isActiveRecord\(d:any\)\{[\s\S]*?\n\}/, `function isActiveRecord(d:any){
 const expires=expiryMs(d.activationExpiresAt);
 const explicitActive=d.activationStatus==='active'||d.williTokenActive===true||d.activationActive===true||d.isActive===true;
 return explicitActive && !!expires && expires>Date.now();
}`);
write(dashboardPath, dashboard);

console.log('Paid activation is now gated by WilliToken redemption; Admin category/revocation and dashboard status safeguards applied.');
