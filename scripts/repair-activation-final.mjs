import fs from 'node:fs';

const path = 'app/dashboard/activation/page.tsx';
let source = fs.readFileSync(path, 'utf8');

const paymentState = /  const \[paymentSuccess, setPaymentSuccess\] = useState<\{ code\?: string; emailSent: boolean; emailError\?: string \} \| null>\(null\);/;
if (!source.includes('activationSuccess')) {
  if (!paymentState.test(source)) throw new Error('Payment success state marker not found.');
  source = source.replace(paymentState, "$&\n  const [activationSuccess, setActivationSuccess] = useState<{ token: string; categories: string[]; expiresAt: Date } | null>(null);");
}

if (!source.includes('setActivationSuccess({ token: clean')) {
  const success = /      setCode\(''\);\n      setMessage\('Activation successful\.'\);/;
  if (!success.test(source)) throw new Error('Activation success handler marker not found.');
  source = source.replace(success, "      setCode('');\n      setMessage('');\n      setActivationSuccess({ token: clean, categories, expiresAt: activationExpiry });");
}

const activationWrite = /        categories: merged,\n        category: merged\[0\] \|\| existing\.category \|\| '',\n        educationLevels: merged,\n        schoolLevels: merged,/;
if (activationWrite.test(source) && !source.includes('activeCategoryId: activeCategory')) {
  source = source.replace(activationWrite, "        categories: merged,\n        category: merged[0] || existing.category || '',\n        educationLevels: merged,\n        schoolLevels: merged,\n        activeCategory: categories[0] || existing.activeCategory || merged[0] || '',\n        activeCategoryId: String(categories[0] || existing.activeCategoryId || merged[0] || '').toLowerCase().replace(/\\s+/g, '-'),");
}

if (!source.includes('aria-label=\"Activation complete\"')) {
  const modal = `\n      {activationSuccess && (\n        <div className=\"fixed inset-0 z-[240] grid place-items-center bg-slate-950/85 p-4 backdrop-blur-md\">\n          <div role=\"dialog\" aria-modal=\"true\" aria-label=\"Activation complete\" className=\"relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-slate-900 p-7 text-white shadow-2xl sm:p-9\">\n            <button type=\"button\" aria-label=\"Close\" onClick={() => setActivationSuccess(null)} className=\"absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white/10\"><X size={20} /></button>\n            <div className=\"mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300\"><CheckCircle2 size={46} /></div>\n            <p className=\"mt-5 text-center text-xs font-black uppercase tracking-[.25em] text-emerald-300\">Account activated</p>\n            <h2 className=\"mt-2 text-center text-3xl font-black sm:text-4xl\">🎉 Congratulations!</h2>\n            <p className=\"mx-auto mt-3 max-w-md text-center text-sm leading-6 text-slate-300\">Your WilliToken has been successfully redeemed. Your purchased learning categories are now unlocked.</p>\n            <div className=\"mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5\">\n              <p className=\"text-center text-[10px] font-black uppercase tracking-[.22em] text-cyan-300\">WilliToken redeemed</p>\n              <p className=\"mt-2 break-all text-center font-mono text-2xl font-black tracking-[.22em]\">{activationSuccess.token}</p>\n            </div>\n            <div className=\"mt-5 rounded-2xl bg-slate-950/80 p-5\">\n              <p className=\"text-xs font-black uppercase tracking-wider text-slate-500\">Unlocked categories</p>\n              <div className=\"mt-3 flex flex-wrap gap-2\">\n                {activationSuccess.categories.length ? activationSuccess.categories.map((category) => <span key={category} className=\"rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-200\">✓ {category}</span>) : <span className=\"text-sm text-slate-400\">Activated learning access</span>}\n              </div>\n              <p className=\"mt-4 text-xs text-slate-400\">Access expires: <strong className=\"text-white\">{activationSuccess.expiresAt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>\n            </div>\n            <p className=\"mt-5 text-center text-xs leading-5 text-slate-400\">Your token has been redeemed and cannot be used again. You can now start learning.</p>\n            <div className=\"mt-6 grid gap-2 sm:grid-cols-2\">\n              <button type=\"button\" onClick={() => setActivationSuccess(null)} className=\"rounded-2xl bg-emerald-400 px-5 py-3.5 text-sm font-black text-slate-950\">Continue learning</button>\n              <a href={\`${BASE}/dashboard/\`} className=\"inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3.5 text-sm font-black text-white\">Go to dashboard</a>\n            </div>\n          </div>\n        </div>\n      )}\n`;
  const marker = '    </main>';
  const index = source.lastIndexOf(marker);
  if (index < 0) throw new Error('Activation page closing main marker not found.');
  source = source.slice(0, index) + modal + source.slice(index);
}

fs.writeFileSync(path, source);
console.log('Final activation page repair verified/applied.');
