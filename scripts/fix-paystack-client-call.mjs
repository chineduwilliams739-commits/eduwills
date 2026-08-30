import fs from 'node:fs';

const file = 'app/dashboard/activation/page.tsx';
let s = fs.readFileSync(file, 'utf8');

if (!s.includes("from 'firebase/functions'")) {
  s = s.replace("import { onAuthStateChanged } from 'firebase/auth';", "import { onAuthStateChanged } from 'firebase/auth';\nimport { getFunctions, httpsCallable } from 'firebase/functions';");
}

const start = s.indexOf('async function pay()');
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

const replacement = `async function pay() {
    if (!selected.length) return setMessage('Select at least one learning category.');
    const current = auth.currentUser;
    if (!current) return setMessage('Please sign in again.');
    await current.reload();
    if (!current.email || !current.emailVerified) return setMessage('Please add and verify your email in Personal before paying. Your activation code will be sent there.');
    setPaying(true);
    setMessage('');
    try {
      const functions = getFunctions(undefined, 'us-central1');
      const initialize = httpsCallable(functions, 'paystackInitializeCallable');
      const result = await initialize({ categories: selected, country, currency, amount: display.paymentAmount, paymentCurrency: display.paymentCurrency, durationMs: 31536000000 });
      const data = result.data as { authorization_url?: string };
      if (!data.authorization_url) throw new Error('Paystack did not return a checkout URL.');
      window.location.assign(data.authorization_url);
    } catch (e) {
      const error = e as { code?: string; message?: string };
      const message = error?.message || '';
      if (error?.code === 'functions/failed-precondition' && message.includes('PAYSTACK_NOT_CONFIGURED')) setMessage('Paystack Test Mode is not configured on the payment server yet.');
      else if (error?.code === 'functions/unauthenticated') setMessage('Your login session expired. Please sign in again.');
      else setMessage(message || 'Could not open Paystack checkout. Please refresh and try again.');
    } finally {
      setPaying(false);
    }
  }`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(file, s, 'utf8');
console.log('Paystack activation client patched: Firebase callable checkout initialization v2.');
