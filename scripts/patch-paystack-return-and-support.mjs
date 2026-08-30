import fs from 'node:fs';

const activation = 'app/dashboard/activation/page.tsx';
const dashboard = 'app/dashboard/page.tsx';
const personal = 'app/dashboard/personal/page.tsx';
const WORKER = 'https://eduwills-payments.williamschinedu169.workers.dev';

function addImport(s) {
  if (!s.includes("@/components/ContactSupport")) s = s.replace(/(import[^\n]+from 'lucide-react';)/, `$1\nimport ContactSupport from '@/components/ContactSupport';`);
  return s;
}
function addBeforeMainClose(s, jsx) {
  const idx = s.lastIndexOf('</main>');
  if (idx < 0 || s.includes(jsx)) return s;
  return s.slice(0, idx) + jsx + s.slice(idx);
}

let a = fs.readFileSync(activation, 'utf8');
a = addImport(a);
if (!a.includes('[emailSent,')) a = a.replace("[success, setSuccess] = useState<{ categories: string[]; expiresAt: Date } | null>(null);", "[success, setSuccess] = useState<{ categories: string[]; expiresAt: Date } | null>(null), [emailSent, setEmailSent] = useState(false);");
const marker = '  const display = useMemo(() => quote(selected, currency, country), [selected, currency, country]);';
if (!a.includes('Paystack return verification')) {
  const effect = `  // Paystack return verification: wait for Firebase Auth, confirm the transaction server-side, generate the WilliToken and send the activation email without Firebase Functions.\n  useEffect(() => {\n    const reference = new URLSearchParams(window.location.search).get('reference');\n    if (!reference) return;\n    let cancelled = false;\n    let timer: ReturnType<typeof setInterval> | null = null;\n    const verify = async () => {\n      const current = auth.currentUser;\n      if (!current) return false;\n      try {\n        setLoading(true);\n        const jwt = await current.getIdToken(true);\n        const response = await fetch('${WORKER}/paystack/verify?reference=' + encodeURIComponent(reference), { method: 'GET', mode: 'cors', cache: 'no-store', headers: { Authorization: 'Bearer ' + jwt } });\n        const text = await response.text();\n        let data: any = {};\n        try { data = JSON.parse(text); } catch {}\n        if (!response.ok || !data?.ok) throw new Error(data?.error || 'Payment could not be confirmed.');\n        if (cancelled) return true;\n        setEmailSent(Boolean(data.emailSent));\n        setSuccess({ categories: Array.isArray(data.categories) ? data.categories : selected, expiresAt: data.activationExpiresAt ? new Date(data.activationExpiresAt) : new Date(Date.now() + 365 * 86400000) });\n        window.history.replaceState({}, '', window.location.pathname);\n        return true;\n      } catch (e: any) {\n        if (!cancelled) setMessage(e?.message || 'Payment was completed, but confirmation is still processing. Please refresh shortly.');\n        return false;\n      } finally { if (!cancelled) setLoading(false); }\n    };\n    let attempts = 0;\n    timer = setInterval(async () => { attempts++; const done = await verify(); if (done || attempts >= 20) { if (timer) clearInterval(timer); timer = null; } }, 500);\n    verify();\n    return () => { cancelled = true; if (timer) clearInterval(timer); };\n  }, []);\n\n`;
  a = a.replace(marker, effect + marker);
}
const successStart = a.indexOf('  if (success) return <main');
if (successStart >= 0 && !a.slice(successStart).includes('Your activation code is on its way')) {
  const mainOpen = a.indexOf('<main', successStart);
  const mainBrace = a.indexOf('{', mainOpen);
  let depth = 0, quote = null, escaped = false, end = -1;
  for (let i = mainBrace; i < a.length; i++) {
    const c = a[i], n = a[i + 1];
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end > 0) {
    const block = `  if (success) return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white"><ContactSupport /><div className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center"><section className="w-full rounded-[2rem] border border-emerald-400/25 bg-white/5 p-8 text-center shadow-2xl"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><CheckCircle2 size={46} /></div><p className="mt-6 text-xs font-black uppercase tracking-[.25em] text-emerald-300">Payment confirmed • Activation ready</p><h1 className="mt-2 text-4xl font-black">🎉 Congratulations!</h1><p className="mx-auto mt-4 max-w-lg text-slate-300">Your Paystack payment was successfully confirmed and your EduWills activation has been prepared.</p><div className="mt-7 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-5 text-left"><p className="text-xs font-black uppercase tracking-wider text-cyan-300">What to do next</p><ol className="mt-3 space-y-3 text-sm leading-6 text-slate-300"><li><b>1.</b> Check the email address linked to your EduWills account for your <b>10-character activation code</b>.</li><li><b>2.</b> Check your <b>Spam, Junk or Promotions</b> folder if it is not in your inbox.</li><li><b>3.</b> Copy the activation code and return to this Activation page.</li><li><b>4.</b> Enter the code in the activation-code box and redeem it once to activate your account for <b>1 year</b>.</li></ol></div>{emailSent ? <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-left text-sm text-emerald-200"><Mail size={17} className="mr-2 inline" /> Your activation-code email was sent successfully.</div> : <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-left text-sm text-amber-200"><Mail size={17} className="mr-2 inline" /> We could not confirm email delivery. Check Spam/Junk/Promotions, then contact support if you still cannot find your code.</div>}<div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-left"><p className="text-xs font-black uppercase text-slate-500">Activated categories</p><div className="mt-3 flex flex-wrap gap-2">{success.categories.map(c => <span key={c} className="rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-cyan-200">{c}</span>)}</div><p className="mt-5 border-t border-white/10 pt-4 text-xs font-black uppercase text-slate-500">Access expires after redemption</p><p className="mt-1 font-black">{success.expiresAt.toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' })}</p></div><ContactSupport box /><a href={`${BASE}/dashboard/`} className="mt-6 inline-flex w-full justify-center rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 px-5 py-4 font-black text-slate-950">Continue to EduWills Dashboard →</a></section></div></main>`;
    a = a.slice(0, successStart) + block + a.slice(end);
  }
}
a = addBeforeMainClose(a, '<ContactSupport box />');
fs.writeFileSync(activation, a, 'utf8');

for (const file of [dashboard, personal]) {
  let s = fs.readFileSync(file, 'utf8');
  s = addImport(s);
  s = addBeforeMainClose(s, '<ContactSupport />');
  if (file === personal) s = addBeforeMainClose(s, '<ContactSupport box />');
  fs.writeFileSync(file, s, 'utf8');
}
console.log('Applied Paystack return confirmation, activation guidance and WhatsApp support UI.');
