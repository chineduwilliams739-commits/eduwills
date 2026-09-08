import fs from 'node:fs';

const path = 'app/dashboard/activation/page.tsx';
let source = fs.readFileSync(path, 'utf8');

const modernActivationReady = source.includes('redeemThroughBackend') && source.includes('paymentSuccess') && source.includes('copyCode');
if (modernActivationReady) {
  console.log('Modern WilliToken payment/copy UI already present; skipping legacy copy-UI rewrite.');
  process.exit(0);
}

if (!source.includes('const [copiedPaymentToken, setCopiedPaymentToken]')) {
  const functionMarker = 'export default function ActivationPage(){';
  if (!source.includes(functionMarker)) throw new Error('Activation page component marker not found.');
  source = source.replace(functionMarker, `${functionMarker}\n const [copiedPaymentToken, setCopiedPaymentToken] = useState(false);`);
}

if (!source.includes('async function copyPaymentToken()')) {
  const marker = ' async function redeem(){';
  if (!source.includes(marker)) throw new Error('Redeem function marker not found.');
  const handler = ` async function copyPaymentToken(){\n  const token=paymentSuccess?.code||'';\n  if(!token)return;\n  try{await navigator.clipboard.writeText(token);setCopiedPaymentToken(true);setTimeout(()=>setCopiedPaymentToken(false),1800)}catch{setMessage('Could not copy the WilliToken. Please press and hold it to copy.')}\n }\n`;
  source = source.replace(marker, handler + marker);
}

const paymentBlock = /\{paymentSuccess&&[\s\S]*?<\/section><\/div><\/main>;/;
const newPaymentBlock = `{paymentSuccess&&<div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><div className="font-black text-emerald-200"><CheckCircle2 size={18} className="mr-2 inline"/>Payment confirmed</div>{paymentSuccess.code&&<div className="mt-5 rounded-2xl border-2 border-cyan-300/40 bg-cyan-400/10 p-5 shadow-lg"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.22em] text-cyan-200">Your WilliToken</p><button type="button" onClick={copyPaymentToken} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 shadow">{copiedPaymentToken?'✓ Copied':'Copy'}</button></div><p className="mt-3 break-all text-center font-mono text-3xl font-black tracking-[.25em] text-white sm:text-4xl">{paymentSuccess.code}</p><p className="mt-3 text-center text-xs font-bold text-cyan-100">Save this 10-character WilliToken. Your purchased categories are activated automatically after successful payment.</p></div>}{paymentSuccess.emailError&&<p className="mt-2 text-xs text-amber-200">Email delivery note: {paymentSuccess.emailError}</p>}</div>}</section></div></main>;`;
if (paymentBlock.test(source)) source = source.replace(paymentBlock, newPaymentBlock);
else if (!source.includes('Your WilliToken')) throw new Error('Payment success UI marker not found.');

const oldUsedCheck = /if\s*\(\s*token\.used\s*===\s*true\s*\|\|\s*token\.redeemed\s*===\s*true\s*\)\s*throw new Error\(['"]This WilliToken has already been redeemed\.['"]\);/;
const newUsedCheck = `if(token.used===true||token.redeemed===true){
 if(token.source==='paystack'&&token.active===true){
  const paidCategories=Array.isArray(token.categories)?token.categories.filter((value:any)=>typeof value==='string'&&Object.hasOwn(PRICES,value)):[];
  const paidExpiry=token.expiresAt?.toDate?.()||new Date(Date.now()+31536000000);
  setCode('');setMessage('');
  setActivationSuccess({token:clean,categories:paidCategories,expiresAt:paidExpiry});
  return;
 }
 throw new Error('This WilliToken has already been redeemed.');
}`;
if (oldUsedCheck.test(source)) source = source.replace(oldUsedCheck, newUsedCheck);
else if (!source.includes("token.source==='paystack'&&token.active===true") && !source.includes("token.source === 'paystack' && token.active === true")) throw new Error('WilliToken redemption guard marker not found.');

fs.writeFileSync(path, source);
console.log('Payment WilliToken copy UI and paid-token confirmation repair applied safely.');
