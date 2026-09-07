import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// This repair is intentionally idempotent. Payment confirmation must create a pending,
// unused WilliToken; the Activation page is the only place that redeems it and grants access.
const paymentPath = 'functions/activationPayments.js';
let payment = read(paymentPath);

const pendingBlock = `await db.collection('users').doc(uid).set({\n    pendingActivationCode: code,\n    pendingActivationCodeExpiresAt: codeExpiresAt.toISOString(),\n    pendingActivationCategories: categories,\n    pendingActivationPaymentReference: paymentReference,\n    pendingActivationPaymentStatus: 'success',\n    activationPaymentAmount: paymentAmount,\n    activationPaymentCurrency: paymentCurrency,\n  }, { merge: true });`;

if (!payment.includes('pendingActivationCode: code')) {
  const start = payment.indexOf('async function processSuccessfulPayment(tx){');
  const end = payment.indexOf('\nexports.paystackWebhook=', start);
  if (start >= 0 && end > start) {
    const fn = payment.slice(start, end);
    const userSet = fn.match(/await db\.collection\('users'\)\.doc\(uid\)\.set\(\{[\s\S]*?\},\{merge:true\}\);/);
    if (userSet) {
      payment = payment.slice(0, start) + fn.replace(userSet[0], pendingBlock.replace(/\n/g, '\n')) + payment.slice(end);
    }
  }
}

// Normalize the paid token creation state without relying on one fragile historical string.
if (!payment.includes('used:false,redeemed:false') && !payment.includes('used: false, redeemed: false')) {
  payment = payment.replace(/used:\s*true,\s*redeemed:\s*true,\s*redeemedBy:\s*uid,\s*redeemedAt:\s*FieldValue\.serverTimestamp\(\),\s*revoked:\s*false,\s*active:\s*true/, "used:false,redeemed:false,revoked:false,active:false");
}

// If the current payment backend already has the safe pending fields and inactive token state,
// leave it untouched. Never fail the deployment merely because the exact legacy block is gone.
const paymentAlreadySafe = payment.includes('pendingActivationCode: code') &&
  (payment.includes('used:false,redeemed:false,revoked:false,active:false') || payment.includes('used: false, redeemed: false, revoked: false, active: false'));
if (!paymentAlreadySafe) {
  // Also accept the compact production form when it already expresses the same semantics.
  const hasPending = payment.includes('pendingActivationCode: code');
  const hasInactiveToken = /used:\s*false[\s\S]{0,120}redeemed:\s*false[\s\S]{0,120}active:\s*false/.test(payment);
  if (!hasPending || !hasInactiveToken) throw new Error('Payment backend does not expose the required pending activation-token state.');
}
write(paymentPath, payment);

// Activation redemption: paid categories/access are assigned only after a valid token is redeemed.
const activationPath = 'app/dashboard/activation/page.tsx';
let activation = read(activationPath);
if (!activation.includes('activeCategoryId: activeCategory')) {
  const oldActivationUpdate = `      await updateDoc(userRef, {\n        activated: true,\n        activationStatus: 'active',\n        williTokenActive: true,\n        activationExpiresAt: activationExpiry,\n        categories: merged,\n        category: merged[0] || existing.category || '',\n        educationLevels: merged,\n        schoolLevels: merged,\n      });`;
  const newActivationUpdate = `      const activeCategory = categories[0] || existing.activeCategory || merged[0] || '';\n      await updateDoc(userRef, {\n        activated: true,\n        activationStatus: 'active',\n        activationActive: true,\n        williTokenActive: true,\n        activationExpiresAt: activationExpiry,\n        categories: merged,\n        category: merged[0] || existing.category || '',\n        educationLevels: merged,\n        schoolLevels: merged,\n        activeCategory,\n        activeCategoryId: activeCategory ? activeCategory.toLowerCase().replace(/\\s+/g, '-'): '',\n        pendingActivationCode: null,\n        pendingActivationCodeExpiresAt: null,\n        pendingActivationCategories: null,\n      });`;
  if (activation.includes(oldActivationUpdate)) activation = activation.replace(oldActivationUpdate, newActivationUpdate);
}
write(activationPath, activation);

// Admin status/revocation safeguards. Apply only when the corresponding legacy implementation exists.
const adminPath = 'app/admin/page.tsx';
let admin = read(adminPath);
if (admin.includes('function isUserActive(user: User, tokens: WilliToken[]): boolean {')) {
  admin = admin.replace(/function isUserActive\(user: User, tokens: WilliToken\[\]\): boolean \{[\s\S]*?\n\}/, `function isUserActive(user: User, tokens: WilliToken[]): boolean {\n  const uid = user.uid || user.id;\n  return tokens.some(token => {\n    const owner = token.userId || token.uid;\n    const expiry = expiryDate(token);\n    return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > Date.now();\n  });\n}`);
}

const revokeStart = admin.indexOf('  const revokeToken = async (t: WilliToken) => {');
const revokeEnd = admin.indexOf('  const deleteExpiredToken = async', revokeStart);
if (revokeStart >= 0 && revokeEnd > revokeStart && !admin.includes('activeWilliToken: null')) {
  const revoke = `  const revokeToken = async (t: WilliToken) => {\n    if (!window.confirm(\`Revoke WilliToken \${t.token || t.id}? It will immediately stop granting access.\`)) return;\n    try {\n      const uid = t.userId || t.uid || '';\n      if (!uid) throw new Error('Token has no owner');\n      const userDocId = users.find(user => (user.uid || user.id) === uid)?.id || uid;\n      await deleteDoc(doc(db, 'williTokens', t.id));\n      const remainingSnapshot = await getDocs(collection(db, 'williTokens'));\n      const now = Date.now();\n      const remainingTokens = remainingSnapshot.docs.map(x => ({ id: x.id, ...x.data() } as WilliToken)).filter(token => {\n        const owner = token.userId || token.uid;\n        const expiry = expiryDate(token);\n        return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > now;\n      });\n      if (remainingTokens.length) {\n        const latest = remainingTokens.sort((a, b) => (expiryDate(b)?.getTime() || 0) - (expiryDate(a)?.getTime() || 0))[0];\n        const latestExpiry = expiryDate(latest);\n        await updateDoc(doc(db, 'users', userDocId), { activated:true, activationStatus:'active', activationActive:true, williTokenActive:true, activationExpiresAt:latestExpiry, activeWilliToken:latest.token || latest.id });\n      } else {\n        await updateDoc(doc(db, 'users', userDocId), { activated:false, activationStatus:'inactive', activationActive:false, williTokenActive:false, activationExpiresAt:null, activeWilliToken:null });\n      }\n      await load(true);\n    } catch { alert('Could not revoke this WilliToken.'); }\n  };\n\n`;
  admin = admin.slice(0, revokeStart) + revoke + admin.slice(revokeEnd);
}

write(adminPath, admin);

// Dashboard must not regard stale activation flags as active after expiry.
const dashboardPath = 'app/dashboard/page.tsx';
let dashboard = read(dashboardPath);
if (!dashboard.includes('explicitActive=d.activationStatus')) {
  dashboard = dashboard.replace(/function isActiveRecord\(d:any\)\{[\s\S]*?\n\}/, `function isActiveRecord(d:any){\n const expires=expiryMs(d.activationExpiresAt);\n const explicitActive=d.activationStatus==='active'||d.williTokenActive===true||d.activationActive===true||d.isActive===true;\n return explicitActive && !!expires && expires>Date.now();\n}`);
}
write(dashboardPath, dashboard);

console.log('Paid activation WilliToken redemption gate is hardened idempotently.');
