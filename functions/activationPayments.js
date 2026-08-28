const { onRequest } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

const PAYSTACK_SECRET_KEY = defineString('PAYSTACK_SECRET_KEY', { default: '' });
const RESEND_API_KEY = defineString('RESEND_API_KEY', { default: '' });
const RESEND_FROM_EMAIL = defineString('RESEND_FROM_EMAIL', { default: 'EduWills <onboarding@resend.dev>' });

const PRICES = { Primary: 2000, 'Junior Secondary': 3000, 'Senior Secondary': 3000, 'Book Learner': 4000 };
const COUNTRY_CURRENCY = { NG: 'NGN', US: 'USD', GB: 'GBP', GH: 'GHS', KE: 'KES', ZA: 'ZAR', CI: 'XOF' };
const PAYSTACK_CURRENCIES = new Set(['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'XOF']);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const json = (res, status, body) => res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(body));
const cleanCategories = (categories) => [...new Set((Array.isArray(categories) ? categories : []).map(String).filter(x => Object.prototype.hasOwnProperty.call(PRICES, x)))];
const baseTotal = (categories) => cleanCategories(categories).reduce((sum, x) => sum + PRICES[x], 0);
const makeCode = () => Array.from({ length: 10 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

function requirePaystack() { const key = PAYSTACK_SECRET_KEY.value(); if (!key) throw new Error('PAYSTACK_NOT_CONFIGURED'); return key; }
function requireResend() { const key = RESEND_API_KEY.value(); if (!key) throw new Error('RESEND_NOT_CONFIGURED'); return key; }

async function fxRate(from, to) {
  if (from === to) return 1;
  const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
  if (!response.ok) throw new Error('FX_PROVIDER_UNAVAILABLE');
  const data = await response.json();
  const rate = Number(data?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('FX_RATE_UNAVAILABLE');
  return rate;
}

async function sendActivationEmail({ to, name, code, categories, paymentAmount, paymentCurrency, activationExpiresAt, codeExpiresAt }) {
  const key = requireResend();
  const safeName = String(name || 'EduWills learner').replace(/[<>]/g, '');
  const safeCategories = categories.map(x => String(x).replace(/[<>]/g, '')).join(', ');
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:620px;margin:32px auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0"><div style="background:#0f172a;padding:28px 32px;color:#fff"><div style="font-size:22px;font-weight:800">EDUWILLS</div><div style="margin-top:8px;color:#a5f3fc;font-size:12px;letter-spacing:2px;font-weight:700">ACCOUNT ACTIVATION</div></div><div style="padding:32px"><p style="font-size:16px">Hello ${safeName},</p><p>Your payment has been confirmed successfully. Your EduWills activation code is ready.</p><div style="margin:24px 0;padding:22px;text-align:center;background:#f8fafc;border:1px solid #cbd5e1;border-radius:14px"><div style="font-size:11px;color:#64748b;letter-spacing:2px;font-weight:700">ACTIVATION CODE</div><div style="margin-top:10px;font-size:28px;letter-spacing:5px;font-weight:900;font-family:monospace">${code}</div></div><p style="margin:6px 0"><strong>Category:</strong> ${safeCategories}</p><p style="margin:6px 0"><strong>Payment:</strong> ${paymentCurrency} ${Number(paymentAmount).toFixed(paymentCurrency === 'NGN' ? 0 : 2)}</p><p style="margin:6px 0"><strong>Code valid until:</strong> ${new Date(codeExpiresAt).toLocaleString('en-NG')}</p><p style="margin:6px 0"><strong>Activation duration after redemption:</strong> 1 year</p><div style="margin-top:24px;padding:14px;background:#ecfeff;border-radius:10px;color:#155e75;font-size:13px">For your security, this code can only be redeemed once. If you did not make this payment, contact EduWills support immediately.</div><p style="margin-top:28px;color:#64748b;font-size:13px">Thank you for choosing EduWills.</p></div></div></body></html>`;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: RESEND_FROM_EMAIL.value(), to: [to], subject: 'Your EduWills activation code', html }) });
  if (!r.ok) { const text = await r.text(); throw new Error(`EMAIL_SEND_FAILED:${text.slice(0, 300)}`); }
  return r.json();
}

exports.paystackQuote = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', cors: true }, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  try {
    const authHeader = String(req.get('authorization') || '');
    if (!authHeader.startsWith('Bearer ')) return json(res, 401, { error: 'Authentication required' });
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    const user = await getAuth().getUser(decoded.uid);
    if (!user.email || !user.emailVerified) return json(res, 403, { error: 'Verify your email before paying for activation.' });
    const categories = cleanCategories(req.body?.categories);
    if (!categories.length) return json(res, 400, { error: 'Select at least one category.' });
    const country = String(req.body?.country || 'INT').toUpperCase();
    const requestedCurrency = String(req.body?.currency || COUNTRY_CURRENCY[country] || 'USD').toUpperCase();
    const ngnTotal = baseTotal(categories);
    if (country === 'NG') return json(res, 200, { localCurrency: 'NGN', localAmount: ngnTotal, paymentCurrency: 'NGN', paymentAmount: ngnTotal, displayName: 'Nigerian Naira', rate: 1 });
    const localCurrency = requestedCurrency === 'NGN' ? 'USD' : requestedCurrency;
    const usdRateFromNgn = await fxRate('NGN', 'USD');
    const paymentAmountUSD = (ngnTotal * usdRateFromNgn) + 1;
    const displayCurrency = localCurrency;
    const localRate = await fxRate('USD', displayCurrency);
    const localAmount = paymentAmountUSD * localRate;
    return json(res, 200, { localCurrency: displayCurrency, localAmount: Math.round(localAmount * 100) / 100, paymentCurrency: 'USD', paymentAmount: Math.round(paymentAmountUSD * 100) / 100, displayName: displayCurrency, rate: localRate });
  } catch (e) { return json(res, 500, { error: e.message || 'Could not calculate quote.' }); }
});

exports.paystackInitialize = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', cors: true }, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  try {
    const authHeader = String(req.get('authorization') || '');
    if (!authHeader.startsWith('Bearer ')) return json(res, 401, { error: 'Authentication required' });
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    const user = await getAuth().getUser(decoded.uid);
    if (!user.email || !user.emailVerified) return json(res, 403, { error: 'Verify your email before paying for activation.' });
    const categories = cleanCategories(req.body?.categories);
    const quoteCurrency = String(req.body?.paymentCurrency || 'NGN').toUpperCase();
    const requestedAmount = Number(req.body?.amount);
    if (!categories.length || !Number.isFinite(requestedAmount) || requestedAmount <= 0) return json(res, 400, { error: 'Invalid activation request.' });
    if (!PAYSTACK_CURRENCIES.has(quoteCurrency)) return json(res, 400, { error: 'Unsupported Paystack payment currency.' });
    const key = requirePaystack();
    const reference = `EW-${decoded.uid.slice(0, 8)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const payload = { email: user.email, amount: Math.round(requestedAmount * 100), currency: quoteCurrency, reference, callback_url: 'https://chineduwilliams739-commits.github.io/eduwills/dashboard/activation/', metadata: { uid: decoded.uid, categories, durationMs: 31536000000, product: 'eduwills_activation', country: String(req.body?.country || 'INT') } };
    const r = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json();
    if (!r.ok || !data.status) return json(res, 502, { error: data.message || 'Could not initialize Paystack payment.' });
    return json(res, 200, { reference: data.data.reference, authorization_url: data.data.authorization_url, access_code: data.data.access_code });
  } catch (e) { return json(res, e.message === 'PAYSTACK_NOT_CONFIGURED' ? 503 : 500, { error: e.message || 'Payment initialization failed.' }); }
});

async function processSuccessfulPayment(tx) {
  const meta = tx.metadata || {};
  if (meta.product !== 'eduwills_activation' || tx.status !== 'success') return { ignored: true };
  const uid = String(meta.uid || '');
  const categories = cleanCategories(meta.categories);
  if (!uid || !categories.length) throw new Error('Invalid payment metadata');
  const db = getFirestore();
  const paymentReference = String(tx.reference || '');
  const duplicate = await db.collection('williTokens').where('paymentReference', '==', paymentReference).limit(1).get();
  if (!duplicate.empty) return { duplicate: true };
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) throw new Error('User not found');
  const user = userSnap.data() || {};
  const code = makeCode();
  const now = new Date();
  const codeExpiresAt = new Date(now.getTime() + 7 * 86400000);
  const activationExpiresAt = new Date(now.getTime() + 365 * 86400000);
  const paymentCurrency = String(tx.currency || 'NGN').toUpperCase();
  const paymentAmount = Number(tx.amount || 0) / 100;
  await db.collection('williTokens').doc(code).set({ token: code, code, userId: uid, uid, username: user.username || '', email: user.email || '', categories, duration: '1 year', durationMs: 31536000000, createdAt: FieldValue.serverTimestamp(), expiresAt: activationExpiresAt, codeExpiresAt, used: false, redeemed: false, revoked: false, active: false, source: 'paystack', paymentReference, paymentCurrency, paymentAmount, paymentId: tx.id || null, paymentStatus: 'success' });
  await db.collection('users').doc(uid).set({ pendingActivationCode: code, pendingActivationCodeExpiresAt: codeExpiresAt.toISOString(), pendingActivationCategories: categories, pendingActivationPaymentReference: paymentReference, pendingActivationPaymentStatus: 'success', activationPaymentAmount: paymentAmount, activationPaymentCurrency: paymentCurrency }, { merge: true });
  if (user.email) await sendActivationEmail({ to: user.email, name: user.fullName, code, categories, paymentAmount, paymentCurrency, activationExpiresAt, codeExpiresAt });
  return { code };
}

exports.paystackWebhook = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST required');
  try {
    const key = requirePaystack();
    const signature = String(req.get('x-paystack-signature') || '');
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha512', key).update(raw).digest('hex');
    if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).send('Invalid signature');
    if (req.body?.event !== 'charge.success') return res.status(200).send('Ignored');
    await processSuccessfulPayment(req.body.data || {});
    return res.status(200).send('OK');
  } catch (e) { return res.status(e.message === 'PAYSTACK_NOT_CONFIGURED' ? 503 : 500).send(e.message || 'Webhook error'); }
});

async function requireAdmin(req) {
  const authHeader = String(req.get('authorization') || '');
  if (!authHeader.startsWith('Bearer ')) throw new Error('Authentication required');
  const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
  const admin = await getFirestore().collection('admins').doc(decoded.uid).get();
  if (!admin.exists) throw new Error('Admin access required');
  return decoded;
}

exports.adminSendActivationCode = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', cors: true }, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  try {
    await requireAdmin(req);
    const uid = String(req.body?.uid || '');
    const db = getFirestore();
    const snap = await db.collection('williTokens').doc(String(req.body?.code || '')).get();
    let token = snap.exists ? snap.data() : null;
    if (!token && uid) {
      const q = await db.collection('williTokens').where('userId', '==', uid).where('used', '==', false).limit(20).get();
      const now = Date.now();
      token = q.docs.map(d => ({ id: d.id, ...d.data() })).find(x => x.codeExpiresAt?.toMillis?.() > now || (x.codeExpiresAt && new Date(x.codeExpiresAt).getTime() > now));
    }
    if (!token) return json(res, 404, { error: 'No unused activation code found.' });
    const userSnap = await db.collection('users').doc(token.userId || token.uid).get();
    if (!userSnap.exists) return json(res, 404, { error: 'User not found.' });
    const user = userSnap.data() || {};
    if (!user.email) return json(res, 400, { error: 'User has no email address.' });
    const codeExpiry = token.codeExpiresAt?.toDate?.() || new Date(token.codeExpiresAt);
    if (!(codeExpiry instanceof Date) || codeExpiry.getTime() <= Date.now()) return json(res, 410, { error: 'Activation code has expired.' });
    await sendActivationEmail({ to: user.email, name: user.fullName, code: token.code || token.token, categories: token.categories || [], paymentAmount: token.paymentAmount || 0, paymentCurrency: token.paymentCurrency || 'NGN', activationExpiresAt: token.expiresAt?.toDate?.() || new Date(Date.now() + 365 * 86400000), codeExpiresAt: codeExpiry });
    await db.collection('williTokens').doc(token.code || token.token).set({ lastEmailedAt: FieldValue.serverTimestamp(), lastEmailedTo: user.email }, { merge: true });
    return json(res, 200, { sentTo: user.email });
  } catch (e) { return json(res, e.message === 'Authentication required' || e.message === 'Admin access required' ? 403 : 500, { error: e.message || 'Could not resend activation email.' }); }
});

exports.redeemActivationCode = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', cors: true }, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  try {
    const authHeader = String(req.get('authorization') || '');
    if (!authHeader.startsWith('Bearer ')) return json(res, 401, { error: 'Authentication required' });
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(code)) return json(res, 400, { error: 'Enter a valid 10-character activation code.' });
    const db = getFirestore();
    const ref = db.collection('williTokens').doc(code);
    const snap = await ref.get();
    if (!snap.exists) return json(res, 404, { error: 'Invalid activation code.' });
    const token = snap.data();
    const codeExpiry = token.codeExpiresAt?.toDate?.() || new Date(token.codeExpiresAt);
    if (token.used || token.redeemed) return json(res, 409, { error: 'This activation code has already been redeemed.' });
    if (!(codeExpiry instanceof Date) || codeExpiry.getTime() <= Date.now()) return json(res, 410, { error: 'This activation code expired after 7 days.' });
    if (String(token.userId || token.uid) !== decoded.uid) return json(res, 403, { error: 'This activation code belongs to another account.' });
    const now = new Date();
    const activationExpiresAt = new Date(now.getTime() + 365 * 86400000);
    await ref.set({ used: true, redeemed: true, active: true, usedAt: FieldValue.serverTimestamp(), redeemedAt: FieldValue.serverTimestamp(), activationExpiresAt }, { merge: true });
    await db.collection('users').doc(decoded.uid).set({ activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activeWilliToken: code, activationExpiresAt: activationExpiresAt.toISOString(), activatedAt: now.toISOString(), categories: token.categories || [] }, { merge: true });
    return json(res, 200, { success: true, activationExpiresAt: activationExpiresAt.toISOString(), categories: token.categories || [] });
  } catch (e) { return json(res, 500, { error: e.message || 'Activation failed.' }); }
});
