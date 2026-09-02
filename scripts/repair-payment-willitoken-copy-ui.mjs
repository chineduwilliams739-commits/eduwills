import fs from 'node:fs';

const path = 'app/dashboard/activation/page.tsx';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes("const [copiedPaymentToken, setCopiedPaymentToken]")) {
  const marker = "  const [paymentSuccess, setPaymentSuccess] = useState<{ code?: string; emailSent: boolean; emailError?: string } | null>(null);";
  if (!source.includes(marker)) throw new Error('Payment success state marker not found.');
  source = source.replace(marker, `${marker}\n  const [copiedPaymentToken, setCopiedPaymentToken] = useState(false);`);
}

if (!source.includes('copyPaymentToken')) {
  const marker = "  async function redeem() {";
  if (!source.includes(marker)) throw new Error('Redeem function marker not found.');
  const handler = `  async function copyPaymentToken() {\n    const token = paymentSuccess?.code || '';\n    if (!token) return;\n    try { await navigator.clipboard.writeText(token); setCopiedPaymentToken(true); setTimeout(() => setCopiedPaymentToken(false), 1800); } catch { setMessage('Could not copy the WilliToken. Please press and hold it to copy.'); }\n  }\n\n`;
  source = source.replace(marker, handler + marker);
}

const oldReference = `              {paymentSuccess.code && <li>✓ Payment reference: <span className="font-mono">{paymentSuccess.code}</span></li>}`;
const newTokenBox = `              {paymentSuccess.code && (\n                <div className="mt-5 rounded-2xl border-2 border-cyan-300/40 bg-cyan-400/10 p-5 shadow-lg">\n                  <div className="flex items-center justify-between gap-3">\n                    <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-200">Your WilliToken</p>\n                    <button type="button" onClick={copyPaymentToken} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 shadow">{copiedPaymentToken ? '✓ Copied' : 'Copy'}</button>\n                  </div>\n                  <p className="mt-3 break-all text-center font-mono text-3xl font-black tracking-[.25em] text-white sm:text-4xl">{paymentSuccess.code}</p>\n                  <p className="mt-3 text-center text-xs font-bold text-cyan-100">Save this 10-character WilliToken. Your purchased categories are activated automatically after successful payment.</p>\n                </div>\n              )}\n              {paymentSuccess.code && <li>✓ Your WilliToken is shown above and can be copied with one tap.</li>}`;
if (source.includes(oldReference)) source = source.replace(oldReference, newTokenBox);
else if (!source.includes('Your WilliToken') || !source.includes('copyPaymentToken')) throw new Error('Payment success token display marker not found.');

const oldUsedCheck = "      if (token.used === true || token.redeemed === true) throw new Error('This WilliToken has already been redeemed.');";
const newUsedCheck = "      if (token.used === true || token.redeemed === true) {\n        if (token.source === 'paystack' && token.active === true) {\n          const paidCategories = Array.isArray(token.categories) ? token.categories.filter((value: any) => typeof value === 'string' && Object.hasOwn(PRICES, value)) : [];\n          const paidExpiry = token.expiresAt?.toDate?.() || new Date(Date.now() + 31536000000);\n          setCode('');\n          setMessage('');\n          setActivationSuccess({ token: clean, categories: paidCategories, expiresAt: paidExpiry });\n          return;\n        }\n        throw new Error('This WilliToken has already been redeemed.');\n      }";
if (source.includes(oldUsedCheck)) source = source.replace(oldUsedCheck, newUsedCheck);
else if (!source.includes("token.source === 'paystack' && token.active === true")) throw new Error('WilliToken redemption guard marker not found.');

fs.writeFileSync(path, source);
console.log('Prominent copyable WilliToken payment UI and paid-token confirmation repair applied.');
