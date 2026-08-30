const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

initializeApp();

const GROQ_API_KEY = defineString('GROQ_API_KEY');
const OPENROUTER_API_KEY = defineString('OPENROUTER_API_KEY');
const PAYSTACK_SECRET_KEY = defineString('PAYSTACK_SECRET_KEY', { default: '' });
const json = (res, status, body) => res.status(status).set('Content-Type', 'application/json').send(JSON.stringify(body));

async function callGroq(key, prompt) {
  if (!key) throw new Error('GROQ_NOT_CONFIGURED');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai/gpt-oss-20b', temperature: 0.2, max_tokens: 9000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are the EduWills factual quiz generator. Return only valid JSON matching the requested schema. Never invent book facts.' }, { role: 'user', content: prompt }] }) });
  if (!r.ok) { const text = await r.text(); const e = new Error(`GROQ_${r.status}`); e.status = r.status; e.detail = text.slice(0, 500); throw e; }
  const d = await r.json(); return d?.choices?.[0]?.message?.content || '';
}
async function callOpenRouter(key, prompt) {
  if (!key) throw new Error('OPENROUTER_NOT_CONFIGURED');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://chineduwilliams739-commits.github.io/eduwills/', 'X-Title': 'EduWills' }, body: JSON.stringify({ model: 'openrouter/free', temperature: 0.2, max_tokens: 9000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are the EduWills factual quiz generator. Return only valid JSON matching the requested schema. Never invent book facts.' }, { role: 'user', content: prompt }] }) });
  if (!r.ok) { const text = await r.text(); const e = new Error(`OPENROUTER_${r.status}`); e.status = r.status; e.detail = text.slice(0, 500); throw e; }
  const d = await r.json(); return d?.choices?.[0]?.message?.content || '';
}

exports.quizAiRouter = onRequest({ region: 'us-central1', timeoutSeconds: 45, memory: '256MiB', cors: true }, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  try {
    const authHeader = String(req.get('authorization') || '');
    if (!authHeader.startsWith('Bearer ')) return json(res, 401, { error: 'Authentication required' });
    await getAuth().verifyIdToken(authHeader.slice(7));
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt || prompt.length > 140000) return json(res, 400, { error: 'Invalid prompt' });
    const providers = [['groq', () => callGroq(GROQ_API_KEY.value(), prompt)], ['openrouter', () => callOpenRouter(OPENROUTER_API_KEY.value(), prompt)]];
    const failures = [];
    for (const [provider, call] of providers) { try { const text = await call(); if (text) return json(res, 200, { provider, text }); } catch (e) { failures.push({ provider, status: e.status || 0, code: e.message || 'provider_error' }); } }
    return json(res, 503, { error: 'AI providers unavailable', failures });
  } catch (e) { return json(res, 500, { error: 'AI router failure' }); }
});

function requirePaystack() { const key = PAYSTACK_SECRET_KEY.value(); if (!key) throw new Error('PAYSTACK_NOT_CONFIGURED'); return key; }

exports.paystackInitialize = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', cors: true }, async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  try {
    const authHeader = String(req.get('authorization') || '');
    if (!authHeader.startsWith('Bearer ')) return json(res, 401, { error: 'Authentication required' });
    const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
    const key = requirePaystack();
    const amount = Number(req.body?.amount);
    const currency = String(req.body?.paymentCurrency || req.body?.currency || 'NGN').toUpperCase();
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.map(String).slice(0, 10) : ['book'];
    const durationMs = Number(req.body?.durationMs || 2592000000);
    if (!Number.isFinite(amount) || amount < 200 || amount > 100000000) return json(res, 400, { error: 'Invalid amount' });
    if (!['NGN', 'USD'].includes(currency)) return json(res, 400, { error: 'Unsupported currency' });
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 366 * 86400000) return json(res, 400, { error: 'Invalid duration' });
    const user = await getAuth().getUser(decoded.uid);
    const customerEmail = String(user.email || '').trim().toLowerCase();
    if (!customerEmail || customerEmail.endsWith('@accounts.eduwills.app')) return json(res, 400, { error: 'REAL_EMAIL_REQUIRED', message: 'Please add and verify your real email address before making an activation payment.' });
    const reference = `EW-${decoded.uid.slice(0, 8)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const payload = { email: customerEmail, amount: Math.round(amount * 100), currency, reference, callback_url: 'https://chineduwilliams739-commits.github.io/eduwills/dashboard/activation/', metadata: { uid: decoded.uid, categories, durationMs, product: 'eduwills_activation' } };
    const r = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await r.json();
    if (!r.ok || !data.status || !data.data?.authorization_url) return json(res, 502, { error: 'PAYSTACK_INITIALIZATION_FAILED', detail: data.message || 'Could not initialize payment.' });
    return json(res, 200, { reference: data.data.reference, access_code: data.data.access_code, authorization_url: data.data.authorization_url });
  } catch (e) { return json(res, e.message === 'PAYSTACK_NOT_CONFIGURED' ? 503 : 500, { error: e.message || 'Payment initialization failed' }); }
});

exports.paystackWebhook = onRequest({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB', cors: false }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST required');
  try {
    const key = requirePaystack();
    const signature = String(req.get('x-paystack-signature') || '');
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha512', key).update(raw).digest('hex');
    if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).send('Invalid signature');
    const event = req.body || {};
    if (event.event !== 'charge.success') return res.status(200).send('Ignored');
    const tx = event.data || {};
    const meta = tx.metadata || {};
    if (meta.product !== 'eduwills_activation' || tx.status !== 'success') return res.status(200).send('Ignored');
    const uid = String(meta.uid || '');
    const durationMs = Number(meta.durationMs || 2592000000);
    const amount = Number(tx.amount || 0);
    const currency = String(tx.currency || '').toUpperCase();
    if (!uid || !Number.isFinite(durationMs) || durationMs <= 0 || amount <= 0 || !['NGN', 'USD'].includes(currency)) return res.status(400).send('Invalid payment metadata');
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).send('User not found');
    const user = userSnap.data() || {};
    const paymentReference = String(tx.reference || '');
    const duplicate = await db.collection('williTokens').where('paymentReference', '==', paymentReference).limit(1).get();
    if (!duplicate.empty) return res.status(200).send('Already processed');
    const token = Array.from({ length: 10 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMs);
    const categories = Array.isArray(meta.categories) ? meta.categories.map(String).slice(0, 10) : (Array.isArray(user.categories) ? user.categories : ['book']);
    await db.collection('williTokens').doc(token).set({ token, userId: uid, uid, username: user.username || '', categories, duration: '1 year', durationMs, createdAt: FieldValue.serverTimestamp(), expiresAt, used: false, source: 'paystack', paymentReference, paymentCurrency: currency, paymentAmount: amount, paymentId: tx.id || null });
    await userRef.set({ activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt: expiresAt.toISOString(), activeWilliToken: token, activatedAt: now.toISOString(), lastPaymentReference: paymentReference, lastPaymentCurrency: currency, lastPaymentAmount: amount }, { merge: true });
    return res.status(200).send('OK');
  } catch (e) { return res.status(e.message === 'PAYSTACK_NOT_CONFIGURED' ? 503 : 500).send(e.message || 'Webhook error'); }
});

Object.assign(exports, require('./activationPayments'));

exports.paystackInitializeCallable = onCall({ region: 'us-central1', timeoutSeconds: 30, memory: '256MiB' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Please sign in again.');

  const uid = request.auth.uid;
  let user;
  try {
    user = await getAuth().getUser(uid);
  } catch (e) {
    console.error('[paystackInitializeCallable] auth lookup failed', { uid, message: e?.message, code: e?.code });
    throw new HttpsError('failed-precondition', 'Unable to verify your EduWills account. Please sign in again.');
  }

  if (!user.email || !user.emailVerified) {
    throw new HttpsError('failed-precondition', 'Verify your email before paying for activation.');
  }

  const amount = Number(request.data?.amount);
  const currency = String(request.data?.paymentCurrency || 'NGN').toUpperCase();
  const categories = Array.isArray(request.data?.categories) ? request.data.categories.map(String).slice(0, 10) : [];
  const durationMs = Number(request.data?.durationMs || 31536000000);
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpsError('invalid-argument', 'Invalid activation amount.');
  if (!['NGN', 'USD'].includes(currency)) throw new HttpsError('invalid-argument', 'Unsupported payment currency.');
  if (!categories.length) throw new HttpsError('invalid-argument', 'Select at least one category.');

  let key;
  try {
    key = requirePaystack();
  } catch (e) {
    console.error('[paystackInitializeCallable] Paystack configuration failed', { code: e?.message });
    throw new HttpsError('failed-precondition', 'Paystack is not configured on the EduWills payment server.');
  }

  const reference = `EW-${uid.slice(0, 8)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = { email: user.email, amount: Math.round(amount * 100), currency, reference, callback_url: 'https://chineduwilliams739-commits.github.io/eduwills/dashboard/activation/', metadata: { uid, categories, durationMs, product: 'eduwills_activation' } };

  try {
    const r = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (!r.ok || !data?.status || !data?.data?.authorization_url) {
      const paystackMessage = String(data?.message || '').trim();
      const safeDetail = paystackMessage || `Paystack HTTP ${r.status}`;
      console.error('[paystackInitializeCallable] Paystack rejected initialization', { httpStatus: r.status, paystackStatus: data?.status ?? null, message: safeDetail });
      throw new HttpsError('failed-precondition', `Paystack could not initialize the payment: ${safeDetail}`);
    }

    return { reference: data.data.reference, access_code: data.data.access_code || '', authorization_url: data.data.authorization_url };
  } catch (e) {
    if (e instanceof HttpsError || e?.name === 'HttpsError' || typeof e?.code === 'string' && ['invalid-argument', 'failed-precondition', 'unauthenticated', 'permission-denied', 'already-exists', 'aborted', 'resource-exhausted', 'cancelled', 'data-loss', 'deadline-exceeded', 'not-found', 'out-of-range', 'unavailable', 'unimplemented', 'internal', 'unknown'].includes(e.code)) {
      throw e;
    }
    console.error('[paystackInitializeCallable] unexpected initialization error', { name: e?.name, message: e?.message, code: e?.code, stack: e?.stack });
    throw new HttpsError('failed-precondition', `Payment initialization failed: ${String(e?.message || 'unknown server error').slice(0, 180)}`);
  }
});
