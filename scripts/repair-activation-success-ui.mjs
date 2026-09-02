import fs from 'node:fs';

const path = 'app/dashboard/activation/page.tsx';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('activationSuccess')) {
  const stateMarker = "  const [paymentSuccess, setPaymentSuccess] = useState<{ code?: string; emailSent: boolean; emailError?: string } | null>(null);";
  if (!source.includes(stateMarker)) throw new Error('Payment success state marker not found.');
  source = source.replace(
    stateMarker,
    `${stateMarker}\n  const [activationSuccess, setActivationSuccess] = useState<{ token: string; categories: string[]; expiresAt: Date } | null>(null);`,
  );
}

const paymentLabel = 'className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Activation code</p>';
if (source.includes(paymentLabel)) {
  source = source.replace(paymentLabel, 'className="text-[10px] font-black uppercase tracking-wider text-cyan-300">WilliToken</p>');
}

const oldRedeemMessage = "      setCode('');\n      setMessage('Activation successful.');";
const newRedeemMessage = "      setCode('');\n      setMessage('');\n      setActivationSuccess({ token: clean, categories, expiresAt: activationExpiry });";
if (source.includes(oldRedeemMessage)) {
  source = source.replace(oldRedeemMessage, newRedeemMessage);
} else if (!source.includes('setActivationSuccess({ token: clean')) {
  throw new Error('Activation success handler marker not found.');
}

if (!source.includes('aria-label="Activation complete"')) {
  const modal = `\n      {activationSuccess && (\n        <div className="fixed inset-0 z-[240] grid place-items-center bg-slate-950/85 p-4 backdrop-blur-md">\n          <div role="dialog" aria-modal="true" aria-label="Activation complete" className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-slate-900 p-7 text-white shadow-[0_25px_80px_rgba(0,0,0,.55)] sm:p-9">\n            <button type="button" aria-label="Close" onClick={() => setActivationSuccess(null)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white/10"><X size={20} /></button>\n            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><CheckCircle2 size={46} /></div>\n            <p className="mt-5 text-center text-xs font-black uppercase tracking-[.25em] text-emerald-300">Account activated</p>\n            <h2 className="mt-2 text-center text-3xl font-black sm:text-4xl">🎉 Congratulations!</h2>\n            <p className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-slate-300">Your WilliToken has been successfully redeemed. The learning categories attached to this token are now unlocked on your EduWills account.</p>\n            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">\n              <p className="text-center text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">WilliToken redeemed</p>\n              <p className="mt-2 break-all text-center font-mono text-2xl font-black tracking-[.22em] text-white sm:text-3xl">{activationSuccess.token}</p>\n            </div>\n            <div className="mt-5 rounded-2xl bg-slate-950/80 p-5">\n              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Unlocked categories</p>\n              <div className="mt-3 flex flex-wrap gap-2">\n                {activationSuccess.categories.length ? activationSuccess.categories.map((category) => (\n                  <span key={category} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-200">✓ {category}</span>\n                )) : <span className="text-sm text-slate-400">Your activated learning access is now available.</span>}\n              </div>\n              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">\n                <div className="rounded-xl border border-white/5 bg-white/[.03] p-3"><p className="text-[10px] font-black uppercase text-slate-500">Access duration</p><p className="mt-1 font-bold text-white">1 year</p></div>\n                <div className="rounded-xl border border-white/5 bg-white/[.03] p-3"><p className="text-[10px] font-black uppercase text-slate-500">Access expires</p><p className="mt-1 font-bold text-white">{activationSuccess.expiresAt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>\n              </div>\n            </div>\n            <p className="mt-5 text-center text-xs leading-5 text-slate-400">You can now return to your dashboard and start using the unlocked EduWills learning tools. Your WilliToken has been marked as redeemed and cannot be used again.</p>\n            <div className="mt-6 grid gap-2 sm:grid-cols-2">\n              <button type="button" onClick={() => setActivationSuccess(null)} className="rounded-2xl bg-emerald-400 px-5 py-3.5 text-sm font-black text-slate-950">Continue learning</button>\n              <a href={\`\${BASE}/dashboard/\`} className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3.5 text-sm font-black text-white">Go to dashboard</a>\n            </div>\n          </div>\n        </div>\n      )}\n`;
  const mainClose = '    </main>';
  const i = source.lastIndexOf(mainClose);
  if (i < 0) throw new Error('Activation page closing main marker not found.');
  source = source.slice(0, i) + modal + source.slice(i);
}

fs.writeFileSync(path, source);
console.log('Activation payment WilliToken label and redemption success popup repair applied.');
