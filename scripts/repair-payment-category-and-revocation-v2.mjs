import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// This repair is intentionally idempotent: older deployment patches may already
// have changed the exact payment block, so a second pass must not fail the build.
const paymentPath = 'functions/activationPayments.js';
let payment = read(paymentPath);

if (payment.includes("redeemedBy: uid") && payment.includes("active: true")) {
  console.log('Payment token lifecycle already hardened; no token rewrite needed.');
} else {
  const tokenSet = /await db\.collection\(['"]williTokens['"]\)\.doc\(code\)\.set\(\{[\s\S]*?\}\);/m;
  const match = payment.match(tokenSet);
  if (!match) throw new Error('Payment token creation block not found.');
  const original = match[0];
  let replacement = original
    .replace(/used:\s*false/, 'used: true')
    .replace(/redeemed:\s*false/, 'redeemed: true')
    .replace(/revoked:\s*false/, 'revoked: false')
    .replace(/active:\s*false/, 'active: true');
  if (!replacement.includes('redeemedBy: uid')) replacement = replacement.replace(/redeemed:\s*true,?/, 'redeemed: true, redeemedBy: uid, redeemedAt: FieldValue.serverTimestamp(),');
  payment = payment.replace(original, replacement);
  console.log('Payment token lifecycle hardened.');
}

const oldUserMarker = "pendingActivationPaymentStatus: 'success'";
if (!payment.includes('activeWilliToken: code') && payment.includes(oldUserMarker)) {
  payment = payment.replace(
    /await db\.collection\(['"]users['"]\)\.doc\(uid\)\.set\(\{[\s\S]*?pendingActivationPaymentStatus: 'success',[\s\S]*?\}, \{ merge: true \}\);/m,
    (m) => m.replace("pendingActivationPaymentStatus: 'success',", "pendingActivationPaymentStatus: 'success', activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activeWilliToken: code,")
  );
}
write(paymentPath, payment);

const adminPath = 'app/admin/page.tsx';
let admin = read(adminPath);
if (!admin.includes('activeCategory?: string')) {
  admin = admin.replace("type User = { id: string;", "type User = { id: string; activeCategory?: string; activeCategoryId?: string;");
}
const activeFn = /function isUserActive\(user: User, tokens: WilliToken\[\]\): boolean \{[\s\S]*?\n\}/;
if (activeFn.test(admin)) {
  admin = admin.replace(activeFn, `function isUserActive(user: User, tokens: WilliToken[]): boolean {
  const uid = user.uid || user.id;
  return tokens.some(token => {
    const owner = token.userId || token.uid;
    const expiry = expiryDate(token);
    return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > Date.now();
  });
}`);
}
const oldRevokeUid = "      const uid = t.userId || t.uid || '';\n      if (!uid) throw new Error('Token has no owner');\n\n      await deleteDoc(doc(db, 'williTokens', t.id));";
if (admin.includes(oldRevokeUid)) {
  admin = admin.replace(oldRevokeUid, "      const uid = t.userId || t.uid || '';\n      if (!uid) throw new Error('Token has no owner');\n      const userDocId = users.find(user => (user.uid || user.id) === uid)?.id || uid;\n\n      await deleteDoc(doc(db, 'williTokens', t.id));");
}
admin = admin.replace(/await updateDoc\(doc\(db, 'users', uid\), \{/g, "await updateDoc(doc(db, 'users', userDocId), {");
write(adminPath, admin);

const dashboardPath = 'app/dashboard/page.tsx';
let dashboard = read(dashboardPath);
const oldActiveRecord = /function isActiveRecord\(d:any\)\{[\s\S]*?\n\}/;
if (oldActiveRecord.test(dashboard) && dashboard.includes('function expiryMs')) {
  dashboard = dashboard.replace(oldActiveRecord, `function isActiveRecord(d:any){\n const now=Date.now();\n const expires=expiryMs(d.activationExpiresAt);\n const explicitActive=d.activationStatus==='active'||d.williTokenActive===true||d.activationActive===true||d.isActive===true;\n return explicitActive && !!expires && expires>now;\n}`);
}
write(dashboardPath, dashboard);

console.log('Payment/category/revocation lifecycle repair applied safely.');
