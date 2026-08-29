const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore } = require('firebase-admin/firestore');

exports.cleanupExpiredAndRevokedWilliTokens = onSchedule({
  schedule: 'every 15 minutes',
  timeZone: 'Africa/Lagos',
  region: 'us-central1',
  timeoutSeconds: 120,
  memory: '256MiB',
}, async () => {
  const db = getFirestore();
  const snap = await db.collection('williTokens').get();
  const now = Date.now();
  let batch = db.batch();
  let count = 0;

  const commitBatch = async () => {
    if (!count) return;
    await batch.commit();
    batch = db.batch();
    count = 0;
  };

  for (const item of snap.docs) {
    const token = item.data() || {};
    const expiresAt = token.expiresAt?.toDate?.() || (token.expiresAt ? new Date(token.expiresAt) : null);
    const codeExpiresAt = token.codeExpiresAt?.toDate?.() || (token.codeExpiresAt ? new Date(token.codeExpiresAt) : null);

    const expiredActivation = expiresAt instanceof Date && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= now;
    const expiredUnusedCode = codeExpiresAt instanceof Date && Number.isFinite(codeExpiresAt.getTime()) && codeExpiresAt.getTime() <= now && token.used !== true && token.redeemed !== true;

    if (token.revoked === true || expiredActivation || expiredUnusedCode) {
      batch.delete(item.ref);
      count += 1;
      if (count >= 450) await commitBatch();
    }
  }

  await commitBatch();
});
