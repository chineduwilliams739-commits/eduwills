import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// Payment: successful Paystack payment immediately grants the purchased categories.
const paymentPath = 'functions/activationPayments.js';
let payment = read(paymentPath);
const oldTokenWrite = "await db.collection('williTokens').doc(code).set({ token: code, code, userId: uid, uid, username: user.username || '', email: user.email || '', categories, duration: '1 year', durationMs: 31536000000, createdAt: FieldValue.serverTimestamp(), expiresAt: activationExpiresAt, codeExpiresAt, used: false, redeemed: false, revoked: false, active: false, source: 'paystack', paymentReference, paymentCurrency, paymentAmount, paymentId: tx.id || null, paymentStatus: 'success', acquisitionSource: attribution.source, acquisitionVisitorId: attribution.visitorId, acquisitionLandingPath: attribution.landingPath, acquisitionRegion: attribution.region, acquisitionTimezone: attribution.timezone });";
const newTokenWrite = "await db.collection('williTokens').doc(code).set({ token: code, code, userId: uid, uid, username: user.username || '', email: user.email || '', categories, duration: '1 year', durationMs: 31536000000, createdAt: FieldValue.serverTimestamp(), expiresAt: activationExpiresAt, codeExpiresAt, used: true, redeemed: true, redeemedBy: uid, redeemedAt: FieldValue.serverTimestamp(), revoked: false, active: true, source: 'paystack', paymentReference, paymentCurrency, paymentAmount, paymentId: tx.id || null, paymentStatus: 'success', acquisitionSource: attribution.source, acquisitionVisitorId: attribution.visitorId, acquisitionLandingPath: attribution.landingPath, acquisitionRegion: attribution.region, acquisitionTimezone: attribution.timezone });";
if (payment.includes(oldTokenWrite)) payment = payment.replace(oldTokenWrite, newTokenWrite);
else if (!payment.includes("redeemedBy: uid") || !payment.includes("active: true")) throw new Error('Payment token creation block not found.');

const oldUserWrite = "await db.collection('users').doc(uid).set({ pendingActivationCode: code, pendingActivationCodeExpiresAt: codeExpiresAt.toISOString(), pendingActivationCategories: categories, pendingActivationPaymentReference: paymentReference, pendingActivationPaymentStatus: 'success', activationPaymentAmount: paymentAmount, activationPaymentCurrency: paymentCurrency, acquisitionSource: attribution.source, acquisitionVisitorId: attribution.visitorId, acquisitionLandingPath: attribution.landingPath, acquisitionRegion: attribution.region, acquisitionTimezone: attribution.timezone }, { merge: true });";
const newUserWrite = "const existingCategories = Array.isArray(user.categories) ? user.categories : [];\n  const mergedCategories = [...new Set([...existingCategories, ...categories])];\n  await db.collection('users').doc(uid).set({ pendingActivationCode: code, pendingActivationCodeExpiresAt: codeExpiresAt.toISOString(), pendingActivationCategories: categories, pendingActivationPaymentReference: paymentReference, pendingActivationPaymentStatus: 'success', activationPaymentAmount: paymentAmount, activationPaymentCurrency: paymentCurrency, categories: mergedCategories, category: mergedCategories[0] || user.category || '', educationLevels: mergedCategories, schoolLevels: mergedCategories, activeCategory: categories[0] || user.activeCategory || mergedCategories[0] || '', activeCategoryId: String(categories[0] || user.activeCategoryId || '').toLowerCase().replace(/\\s+/g, '-'), activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activeWilliToken: code, activatedAt: now.toISOString(), acquisitionSource: attribution.source, acquisitionVisitorId: attribution.visitorId, acquisitionLandingPath: attribution.landingPath, acquisitionRegion: attribution.region, acquisitionTimezone: attribution.timezone }, { merge: true });";
if (payment.includes(oldUserWrite)) payment = payment.replace(oldUserWrite, newUserWrite);
else if (!payment.includes('mergedCategories') || !payment.includes('activeWilliToken: code')) throw new Error('Payment user activation block not found.');
write(paymentPath, payment);

// Admin: status is derived only from a currently valid WilliToken; revocation updates the real user document.
const adminPath = 'app/admin/page.tsx';
let admin = read(adminPath);
if (!admin.includes('activeCategory?: string')) {
  admin = admin.replace("type User = { id: string;", "type User = { id: string; activeCategory?: string; activeCategoryId?: string;");
}
const activeFn = /function isUserActive\(user: User, tokens: WilliToken\[\]\): boolean \{[\s\S]*?\n\}/;
if (!activeFn.test(admin)) throw new Error('Admin isUserActive function not found.');
admin = admin.replace(activeFn, `function isUserActive(user: User, tokens: WilliToken[]): boolean {
  const uid = user.uid || user.id;
  return tokens.some(token => {
    const owner = token.userId || token.uid;
    const expiry = expiryDate(token);
    return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > Date.now();
  });
}`);
const oldRevokeUid = "      const uid = t.userId || t.uid || '';\n      if (!uid) throw new Error('Token has no owner');\n\n      await deleteDoc(doc(db, 'williTokens', t.id));";
const newRevokeUid = "      const uid = t.userId || t.uid || '';\n      if (!uid) throw new Error('Token has no owner');\n      const userDocId = users.find(user => (user.uid || user.id) === uid)?.id || uid;\n\n      await deleteDoc(doc(db, 'williTokens', t.id));";
if (admin.includes(oldRevokeUid)) admin = admin.replace(oldRevokeUid, newRevokeUid);
else if (!admin.includes('const userDocId = users.find(user => (user.uid || user.id) === uid)?.id || uid;')) throw new Error('Admin revoke owner block not found.');
admin = admin.replace(/await updateDoc\(doc\(db, 'users', uid\), \{/g, "await updateDoc(doc(db, 'users', userDocId), {");
const oldSave = "      await updateDoc(doc(db, 'users', selectedUser.id), {\n        categories: selectedCategories,\n        category: selectedCategories[0] || '',\n        educationLevels: selectedCategories,\n        schoolLevels: selectedCategories,\n      });";
const newSave = "      const categories = [...new Set(selectedCategories.map(normalizeCategory).filter(category => issueCategories.includes(category as typeof issueCategories[number])))];\n      const currentActiveCategory = categories.includes(selectedUser.activeCategory as string) ? selectedUser.activeCategory : (categories[0] || '');\n      await setDoc(doc(db, 'users', selectedUser.id), {\n        categories,\n        category: categories[0] || '',\n        educationLevels: categories,\n        schoolLevels: categories,\n        activeCategory: currentActiveCategory,\n        activeCategoryId: currentActiveCategory ? currentActiveCategory.toLowerCase().replace(/\\s+/g, '-') : '',\n      }, { merge: true });";
if (admin.includes(oldSave)) admin = admin.replace(oldSave, newSave);
else if (!admin.includes("const categories = [...new Set(selectedCategories.map(normalizeCategory)")) throw new Error('Admin category assignment block not found.');
write(adminPath, admin);

// Dashboard: require a valid activation expiry when using the user document's activation flags.
const dashboardPath = 'app/dashboard/page.tsx';
let dashboard = read(dashboardPath);
const oldActiveRecord = /function isActiveRecord\(d:any\)\{[\s\S]*?\n\}/;
if (!oldActiveRecord.test(dashboard)) throw new Error('Dashboard active record function not found.');
dashboard = dashboard.replace(oldActiveRecord, `function isActiveRecord(d:any){\n const now=Date.now();\n const expires=expiryMs(d.activationExpiresAt);\n const explicitActive=d.activationStatus==='active'||d.williTokenActive===true||d.activationActive===true||d.isActive===true;\n return explicitActive && !!expires && expires>now;\n}`);
write(dashboardPath, dashboard);

console.log('Payment/category/revocation lifecycle repair applied.');
