import fs from 'node:fs';

const root = process.cwd();
const dashboard = `${root}/app/dashboard/page.tsx`;
const personal = `${root}/app/dashboard/personal/page.tsx`;
const activation = `${root}/app/dashboard/activation/page.tsx`;
const worker = `${root}/workers/payments/src/index.js`;

function read(p){ return fs.readFileSync(p,'utf8'); }
function write(p,s){ fs.writeFileSync(p,s,'utf8'); }
function ensureImport(src, marker, importLine){
  if (src.includes(importLine)) return src;
  const i = src.indexOf(marker);
  if (i < 0) throw new Error(`Import marker not found: ${marker}`);
  const end = src.indexOf('\n', i);
  return src.slice(0,end+1) + importLine + '\n' + src.slice(end+1);
}
function ensureComponentBeforeMainClose(src, component){
  if (src.includes(component)) return src;
  const i = src.lastIndexOf('</main>');
  if (i < 0) throw new Error('Could not locate </main>');
  return src.slice(0,i) + component + src.slice(i);
}

let d = read(dashboard);
d = ensureImport(d, "import { auth, db } from '@/lib/firebase';", "import ContactSupport from '@/components/ContactSupport';");
d = ensureComponentBeforeMainClose(d, '<ContactSupport />');
write(dashboard,d);

let p = read(personal);
p = ensureImport(p, "import { auth, db } from '@/lib/firebase';", "import ContactSupport from '@/components/ContactSupport';");
p = ensureComponentBeforeMainClose(p, '<ContactSupport />');
write(personal,p);

let a = read(activation);
a = a.replace(/<ContactSupport\s+box\s*\/>/g,'');
a = ensureImport(a, "import { auth, db } from '@/lib/firebase';", "import ContactSupport from '@/components/ContactSupport';");
a = ensureComponentBeforeMainClose(a, '<ContactSupport box />');
if (!a.includes('[paymentSuccess,setPaymentSuccess]')) {
  const needle = ",[success,setSuccess]=useState<{categories:string[];expiresAt:Date}|null>(null);";
  if (!a.includes(needle)) throw new Error('Activation success state marker not found');
  a = a.replace(needle, needle + "[paymentSuccess,setPaymentSuccess]=useState<{code?:string;emailSent:boolean;emailError?:string}|null>(null);");
}
const oldMessage = "setMessage(result.emailSent===false?'Payment confirmed. Your WilliToken is being prepared; please check your verified email shortly.':'Payment confirmed. Your WilliToken has been sent to your verified email.');window.history.replaceState({},document.title,window.location.pathname)";
if (a.includes(oldMessage)) {
  a = a.replace(oldMessage, "setPaymentSuccess({code:String(result.code||''),emailSent:result.emailSent===true,emailError:String(result.emailError||'')});setMessage('');window.history.replaceState({},document.title,window.location.pathname)");
} else if (!a.includes('setPaymentSuccess({code:String(result.code||\'\')')) {
  throw new Error('Payment confirmation message marker not found');
}
if (!a.includes('paymentSuccess&&<div className="fixed inset-0')) {
  const modal = `<>{paymentSuccess&&<div className="fixed inset-0 z-[220] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-[2rem] border border-emerald-400/30 bg-slate-900 p-7 text-white shadow-2xl"><button aria-label="Close" onClick={()=>setPaymentSuccess(null)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white/10"><X size={20}/></button><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><CheckCircle2 size={46}/></div><p className="mt-5 text-center text-xs font-black uppercase tracking-[.25em] text-emerald-300">Payment confirmed</p><h2 className="mt-2 text-center text-3xl font-black">🎉 Congratulations!</h2><p className="mt-3 text-center text-slate-300">Your activation payment was successful.</p><div className="mt-6 rounded-2xl bg-slate-950 p-5"><p className="text-xs font-black uppercase text-slate-500">What to do next</p><ul className="mt-3 space-y-2 text-sm text-slate-300"><li>✓ Check your verified email for your WilliToken.</li><li>✓ Check Spam, Junk, Promotions and other email folders.</li><li>✓ Enter the 10-character WilliToken here to activate your account.</li></ul>{paymentSuccess.code&&<div className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Activation code</p><p className="mt-2 break-all text-center font-mono text-2xl font-black tracking-[.25em] text-white">{paymentSuccess.code}</p><p className="mt-2 text-center text-xs text-slate-400">Keep this code private. It is also sent to your verified email when email delivery is configured.</p></div>}{!paymentSuccess.emailSent&&<p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-200">Email delivery is still pending{paymentSuccess.emailError?' ('+paymentSuccess.emailError+')':''}. The code above is available now; please contact support if the email does not arrive.</p>}</div><div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>setPaymentSuccess(null)} className="rounded-2xl bg-emerald-400 px-5 py-3.5 text-sm font-black text-slate-950">Continue</button><a href={`${BASE}/dashboard/`} className="inline-flex items-center justify-center rounded-2xl border border-white/10 px-5 py-3.5 text-sm font-black text-white">Go to dashboard</a></div></div></div>}</>`;
  const i = a.lastIndexOf('</main>');
  a = a.slice(0,i) + modal + a.slice(i);
}
write(activation,a);

let w = read(worker);
if (!w.includes('PAYMENT_ACTIVATION_UI_AND_DELIVERY_REPAIR_V2')) {
  w = w.replace("active:false,adminVisible:true", "active:true,adminVisible:true");
  const oldReturn = "return json({ok:true,reference,categories:result.categories||cleanCategories(tx.metadata.categories),activationExpiresAt:result.activationExpiresAt||'',tokenCreated:true,emailSent:f.activationCodeEmailSent?.booleanValue===true||result.emailSent===true,emailError:result.emailError||f.activationCodeEmailError?.stringValue||''},200,origin);";
  const newReturn = "return json({ok:true,reference,categories:result.categories||cleanCategories(tx.metadata.categories),activationExpiresAt:result.activationExpiresAt||'',tokenCreated:true,code:result.code||'',emailSent:f.activationCodeEmailSent?.booleanValue===true||result.emailSent===true,emailError:result.emailError||f.activationCodeEmailError?.stringValue||''},200,origin);";
  if (!w.includes(oldReturn)) throw new Error('Worker verify response marker not found');
  w = w.replace(oldReturn,newReturn);
  w += "\n/* PAYMENT_ACTIVATION_UI_AND_DELIVERY_REPAIR_V2 */\n";
  write(worker,w);
}
console.log('Applied support restoration, payment-success popup, and WilliToken visibility/delivery response repair.');
