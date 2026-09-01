import fs from 'node:fs';

const file = 'app/dashboard/activation/page.tsx';
let s = fs.readFileSync(file, 'utf8');
const WORKER_URL = 'https://eduwills-payments.williamschinedu169.workers.dev';

const match = s.match(/(^|\n)(\s*)async function pay\s*\(\)/);
if (!match) throw new Error('Could not locate activation pay function.');
const start = match.index + match[1].length;
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
const indent = match[2];
const replacement = `${indent}async function pay() {
${indent}  if (!selected.length) return setMessage('Select at least one learning category.');
${indent}  const current = auth.currentUser;
${indent}  if (!current) return setMessage('Please sign in again.');
${indent}  try { await current.reload(); } catch {}
${indent}  if (!current.email || !current.emailVerified) return setMessage('Please verify your email address before paying.');
${indent}  setPaying(true); setMessage('');
${indent}  try {
${indent}    const jwt = await current.getIdToken(true), backend = await getBackend();
${indent}    const response = await fetch(backend + '/paystack/initialize', { method:'POST', mode:'cors', cache:'no-store', headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt,'X-Firebase-ID-Token':jwt}, body:JSON.stringify({categories:selected,country,currency,amount:display.paymentAmount,paymentCurrency:display.paymentCurrency,durationMs:31536000000,fullName:user?.fullName||'',username:user?.username||''}) });
${indent}    const text = await response.text(); let data:any = {}; try { data = JSON.parse(text); } catch {}
${indent}    if (!response.ok || !data?.authorization_url) throw new Error(data?.error || 'Payment initialization failed (' + response.status + ').');
${indent}    window.location.assign(data.authorization_url);
${indent}  } catch (e:any) { setMessage(e?.message === 'Failed to fetch' ? 'The secure payment service could not be reached. Please refresh and try again.' : e?.message || 'Could not open Paystack checkout.'); }
${indent}  finally { setPaying(false); }
${indent}}`;
s = s.slice(0, start) + replacement + s.slice(end);
s = s.replace("import { getFunctions, httpsCallable } from 'firebase/functions';\n", '');
fs.writeFileSync(file, s, 'utf8');
console.log('Paystack activation client patched: direct Cloudflare Worker initialization.');
