import fs from 'node:fs';

const path = 'app/dashboard/activation/page.tsx';
let source = fs.readFileSync(path, 'utf8');

// Deployment 1638 exposed a malformed one-line paymentSuccess modal in the activation page.
// Repair that source before TypeScript runs, while preserving the secure payment/redeem flow.
if (source.includes('{paymentSuccess&&<div className="fixed') || source.includes('{paymentSuccess&&<div className=\"fixed')) {
  const lines = source.split('\n');
  const index = lines.findIndex((line) => line.includes('{paymentSuccess&&<div className="fixed'));
  if (index < 0) throw new Error('Malformed activation success JSX marker not found.');

  const replacement = [
    '  {paymentSuccess ? (',
    '   <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">',
    '    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-emerald-300/30 bg-slate-950 p-5 shadow-2xl sm:p-7">',
    '     <div className="flex items-start gap-3">',
    '      <CheckCircle2 className="mt-1 text-emerald-200" size={25}/>',
    '      <div className="min-w-0 flex-1">',
    '       <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-200">{paymentSuccess.kind === \'redeem\' ? \'Activation successful\' : \'Congratulations!\'}</p>',
    '       <h3 className="mt-1 text-2xl font-black">{paymentSuccess.alreadyActive ? \'Your EduWills access is already active\' : \'Your EduWills activation is ready\'}</h3>',
    '       <p className="mt-2 text-sm leading-6 text-emerald-50/80">{paymentSuccess.kind === \'redeem\' ? \'Your WilliToken has been redeemed successfully. Your selected learning tools are now available.\' : \'Payment confirmed. Your unique WilliToken is shown below.\'}</p>',
    '       {paymentSuccess.categories?.length ? <p className="mt-3 text-xs font-bold text-emerald-100">Active categories: {paymentSuccess.categories.join(\' · \')}</p> : null}',
    '       <div className="mt-5 rounded-2xl border border-emerald-200/20 bg-white/5 p-4">',
    '        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your WilliToken</p>',
    '        {paymentSuccess.code ? <div><p className="mt-2 break-all text-2xl font-black tracking-[.16em] text-white sm:text-3xl"><b>{paymentSuccess.code}</b></p><button type="button" onClick={copyCode} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-slate-950"><Copy size={14}/>{copied ? \'Copied!\' : \'Copy WilliToken\'}</button></div> : <p className="mt-2 text-sm font-bold text-slate-300">Check your verified email for the token.</p>}',
    '        <p className="mt-4 text-xs text-slate-400">Activation valid until: <b className="text-white">{formatDate(paymentSuccess.activationExpiresAt)}</b></p>',
    '        <p className="mt-1 text-xs text-slate-400">Email delivery: <b className="text-white">{paymentSuccess.emailSent ? \'Sent\' : \'Check email shortly\'}</b></p>',
    '        {paymentSuccess.emailError ? <p className="mt-3 text-xs font-bold text-amber-200">Email delivery note: {paymentSuccess.emailError}</p> : null}',
    '       </div>',
    '       <div className="mt-4 flex flex-wrap gap-2">',
    '        <button type="button" onClick={() => setPaymentSuccess(null)} className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white">Close</button>',
    '        <a href={`${BASE}/dashboard/`} className="inline-flex items-center rounded-xl bg-emerald-200 px-5 py-3 text-sm font-black text-slate-950">Go to my dashboard</a>',
    '       </div>',
    '      </div>',
    '     </div>',
    '    </div>',
    '   </div>',
    '  ) : null}',
  ];

  lines.splice(index, 1, ...replacement);
  source = lines.join('\n');
  fs.writeFileSync(path, source);
  console.log('Malformed activation success JSX repaired before typecheck.');
} else {
  console.log('Activation success JSX is already in repaired form.');
}
