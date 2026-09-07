import fs from 'node:fs';

const workerPath = 'workers/payments/src/index.js';
let worker = fs.readFileSync(workerPath, 'utf8');
const workerMarker = 'PAYMENT_ACTIVATION_V2_REPAIR';
if (!worker.includes(workerMarker)) {
  const needle = "async function handle(req,env){const origin=req.headers.get('origin')||'*';if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});const url=new URL(req.url);";
  if (!worker.includes(needle)) throw new Error('Could not locate payment worker handle start.');
  const replacement = needle + `\nif(req.method==='POST'&&url.pathname==='/redeem'){try{const idToken=(req.headers.get('x-firebase-id-token')||req.headers.get('authorization')||'').replace(/^Bearer /,'');const body=await req.json().catch(()=>({}));const result=await redeemCode(env,idToken,String(body.code||'').trim().toUpperCase());return json({ok:true,...result},200,origin)}catch(e){const msg=String(e?.message||'ACTIVATION_FAILED');const status=msg==='AUTH_REQUIRED'?401:(msg==='CODE_NOT_FOR_USER'||msg==='ACTIVATION_CODE_ALREADY_USED'?403:400);return json({error:msg},status,origin)}}\n`;
  worker = worker.replace(needle, replacement);
  worker += `\n/* ${workerMarker} */\n`;
  fs.writeFileSync(workerPath, worker);
}

const pagePath = 'app/dashboard/activation/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
const pageMarker = 'PAYMENT_ACTIVATION_V2_UI_REPAIR';
if (!page.includes(pageMarker)) {
  const stateOld = "[paymentSuccess,setPaymentSuccess]=useState<{code?:string;emailSent:boolean;emailError?:string}|null>(null);";
  const stateNew = "[paymentSuccess,setPaymentSuccess]=useState<{code?:string;emailSent:boolean;emailError?:string;activated?:boolean}|null>(null);";
  if (!page.includes(stateOld)) throw new Error('Could not locate payment success state.');
  page = page.replace(stateOld, stateNew);

  const effectNeedle = "if(!result)throw lastError||new Error('Payment confirmation failed.');setPaymentSuccess({code:String(result.code||''),emailSent:result.emailSent===true,emailError:result.emailError?String(result.emailError):undefined});setMessage('');window.history.replaceState({},document.title,window.location.pathname)";
  const effectReplacement = "if(!result)throw lastError||new Error('Payment confirmation failed.');const paidCode=String(result.code||'').trim().toUpperCase();let activated=false;if(paidCode){try{const jwt=await current.getIdToken(true),backend=await getBackend(),redeemResponse=await fetch(`${backend}/redeem`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt}`,'X-Firebase-ID-Token':jwt},body:JSON.stringify({code:paidCode}),cache:'no-store'}),redeemText=await redeemResponse.text();let redeemData:any={};try{redeemData=JSON.parse(redeemText)}catch{}if(!redeemResponse.ok)throw new Error(redeemData.error||'Activation could not be completed automatically.');activated=redeemData.ok===true;}catch(autoError:any){console.warn('Automatic activation after payment failed:',autoError)}}setPaymentSuccess({code:paidCode,emailSent:result.emailSent===true,emailError:result.emailError?String(result.emailError):undefined,activated});setMessage('');window.history.replaceState({},document.title,window.location.pathname)";
  if (!page.includes(effectNeedle)) throw new Error('Could not locate payment verification UI block.');
  page = page.replace(effectNeedle, effectReplacement);

  const redeemStart = page.indexOf(' async function redeem(){');
  const redeemEnd = page.indexOf("\n if(loading)return", redeemStart);
  if (redeemStart < 0 || redeemEnd < 0) throw new Error('Could not locate redeem function.');
  const redeemFn = ` async function redeem(){const clean=code.trim().toUpperCase();if(!/^[A-Z0-9]{10}$/.test(clean)){setMessage('Enter the 10-character activation code from your email.');return}const current=auth.currentUser;if(!current){setMessage('Please sign in again.');return}setRedeeming(true);setMessage('');try{const jwt=await current.getIdToken(true),backend=await getBackend(),response=await fetch(\`${backend}/redeem\`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:\`Bearer \${jwt}\`,'X-Firebase-ID-Token':jwt},body:JSON.stringify({code:clean}),cache:'no-store'}),text=await response.text();let data:any={};try{data=JSON.parse(text)}catch{}if(!response.ok)throw new Error(data.error||'Activation failed.');setCode('');setMessage('');setPaymentSuccess({code:clean,emailSent:false,activated:true});}catch(error:any){setMessage(error?.message==='Failed to fetch'?'The secure activation service could not be reached. Please refresh and try again.':error?.message||'Activation failed.')}finally{setRedeeming(false)}}`;
  page = page.slice(0, redeemStart) + redeemFn + page.slice(redeemEnd);

  const successOld = "{paymentSuccess&&<div className=\"mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4\"><div className=\"font-black text-emerald-200\"><CheckCircle2 size={18} className=\"mr-2 inline\"/>Payment confirmed</div>{paymentSuccess.code&&<p className=\"mt-2 text-sm text-emerald-100\">Your WilliToken is <b>{paymentSuccess.code}</b>. It was also sent to your verified email.</p>}{paymentSuccess.emailError&&<p className=\"mt-2 text-xs text-amber-200\">Email delivery note: {paymentSuccess.emailError}</p>}</div>}";
  const successNew = "{paymentSuccess&&<div className=\"mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-5\"><div className=\"font-black text-lg text-emerald-200\"><CheckCircle2 size={20} className=\"mr-2 inline\"/>{paymentSuccess.activated?'Congratulations! Your EduWills account is now active.':'Payment confirmed successfully!'}</div>{paymentSuccess.code&&<><p className=\"mt-3 text-sm text-emerald-100\">Your WilliToken has been assigned to you:</p><div className=\"mt-3 flex flex-col gap-3 sm:flex-row sm:items-center\"><div className=\"min-w-0 flex-1 rounded-xl border border-emerald-300/30 bg-slate-950/70 px-4 py-4 text-center font-black text-xl tracking-[.18em] text-white\">{paymentSuccess.code}</div><button type=\"button\" onClick={()=>navigator.clipboard?.writeText(paymentSuccess.code||'')} className=\"rounded-xl bg-white px-5 py-4 text-sm font-black text-slate-950\">Copy WilliToken</button></div>{paymentSuccess.activated&&<p className=\"mt-3 text-xs text-emerald-100\">Your activation is active for 1 year. Keep this token for your records.</p>}</>}{paymentSuccess.emailError&&<p className=\"mt-3 text-xs text-amber-200\">Email delivery note: {paymentSuccess.emailError}</p>}</div>}";
  if (!page.includes(successOld)) throw new Error('Could not locate payment success card.');
  page = page.replace(successOld, successNew);
  page += `\n/* ${pageMarker} */\n`;
  fs.writeFileSync(pagePath, page);
}

console.log('Applied payment activation v2 repair.');
