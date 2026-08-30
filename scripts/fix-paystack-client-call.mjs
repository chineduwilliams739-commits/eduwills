import fs from 'node:fs';

const file = 'app/dashboard/activation/page.tsx';
let s = fs.readFileSync(file, 'utf8');

if (!s.includes("const PAYMENT_BACKEND_CONFIG")) {
  s = s.replace(
    "const PAYMENT_API = 'https://us-central1-eduwills.cloudfunctions.net';",
    "const PAYMENT_BACKEND_CONFIG = `${BASE}/payment-backend.json`;"
  );
}

const start = s.indexOf('  async function pay()');
if (start < 0) throw new Error('Could not locate activation pay function.');
let brace = s.indexOf('{', start);
if (brace < 0) throw new Error('Could not locate activation pay function body.');
let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
let end = -1;
for (let i = brace; i < s.length; i++) {
  const c = s[i], n = s[i + 1];
  if (lineComment) { if (c === '\n') lineComment = false; continue; }
  if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i++; } continue; }
  if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = null; continue; }
  if (c === '/' && n === '/') { lineComment = true; i++; continue; }
  if (c === '/' && n === '*') { blockComment = true; i++; continue; }
  if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
  if (c === '{') depth++;
  else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) throw new Error('Could not locate end of activation pay function.');

const replacement = `  async function pay() {
    if (!selected.length) return setMessage('Select at least one learning category.');
    const current = auth.currentUser;
    if (!current) return setMessage('Please sign in again.');
    await current.reload();
    if (!current.email || !current.emailVerified) return setMessage('Please add and verify your email in Personal before paying. Your activation code will be sent there.');
    setPaying(true);
    setMessage('');
    try {
      const configResponse = await fetch(PAYMENT_BACKEND_CONFIG, { cache: 'no-store' });
      const config = await configResponse.json().catch(() => ({}));
      const backend = String(config?.baseUrl || '').replace(/\\/$/, '');
      if (!configResponse.ok || !backend) throw new Error('The secure payment service is not configured. Please refresh and try again.');

      const jwt = await current.getIdToken(true);
      const response = await fetch(backend + '/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
        body: JSON.stringify({ categories: selected, country, currency, amount: display.paymentAmount, paymentCurrency: display.paymentCurrency, durationMs: 31536000000 })
      });
      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text); } catch {}
      if (!response.ok) throw new Error(data?.error || 'Payment initialization failed (' + response.status + ').');
      if (!data?.authorization_url) throw new Error(data?.error || 'Paystack did not return a checkout URL.');
      window.location.assign(data.authorization_url);
    } catch (e) {
      const error = e as { message?: string };
      setMessage(error?.message === 'Failed to fetch' ? 'The secure payment service could not be reached. Please refresh and try again.' : error?.message || 'Could not open Paystack checkout.');
    } finally {
      setPaying(false);
    }
  }`;

s = s.slice(0, start) + replacement + s.slice(end);
s = s.replace("import { getFunctions, httpsCallable } from 'firebase/functions';\n", '');
fs.writeFileSync(file, s, 'utf8');
console.log('Paystack activation client patched: Cloudflare Worker initialization.');
