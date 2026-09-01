import fs from 'node:fs';

const path = 'workers/payments/src/index.js';
let s = fs.readFileSync(path, 'utf8');
if (s.includes('PAYMENT_ACTIVATION_FINAL_REPAIR_V1')) {
  console.log('Payment activation final repair already applied.');
  process.exit(0);
}

const marker = '/* PAYMENT_ACTIVATION_FINAL_REPAIR_V1 */';

const oldHelpers = "const cleanCategories=c=>[...new Set((Array.isArray(c)?c:[]).map(String).filter(x=>Object.hasOwn(PRICES,x)))];";
const newHelpers = oldHelpers + "const parseMetadata=v=>{if(!v)return{};if(typeof v==='string'){try{return JSON.parse(v)||{}}catch{return{}}}return typeof v==='object'?v:{}};const parseCategories=v=>{if(Array.isArray(v))return cleanCategories(v);if(typeof v==='string'){try{return cleanCategories(JSON.parse(v))}catch{return cleanCategories(v.split(',').map(x=>x.trim()))}}return[]};";
if (!s.includes(oldHelpers)) throw new Error('Could not find category helper.');
s = s.replace(oldHelpers, newHelpers);

const oldStart = "async function processPayment(env,tx,authUser=null){if(tx?.metadata?.product!=='eduwills_activation'||String(tx.status||'').toLowerCase()!=='success')return{processed:false,reason:'IGNORED'};const uid=String(tx.metadata.uid||'');const categories=cleanCategories(tx.metadata.categories);if(!uid||!categories.length)throw new Error('INVALID_PAYMENT_METADATA');const paymentReference=String(tx.reference||'');if(!paymentReference)throw new Error('INVALID_PAYMENT_REFERENCE');const user=await fsGet(env,`users/${uid}`);";
const newStart = "async function processPayment(env,tx,authUser=null){const rawMeta=parseMetadata(tx?.metadata);const paymentReference=String(tx?.reference||'');if(!paymentReference)throw new Error('INVALID_PAYMENT_REFERENCE');const pendingPayment=await fsGet(env,`paymentTransactions/${paymentReference}`);const pf=pendingPayment?.fields||{};const pendingMeta={uid:pf.uid?.stringValue||'',categories:pf.categories?.stringValue||'[]',email:pf.email?.stringValue||'',fullName:pf.fullName?.stringValue||'',username:pf.username?.stringValue||'',country:pf.country?.stringValue||''};const metadata={...pendingMeta,...rawMeta,uid:rawMeta.uid||pendingMeta.uid,categories:(rawMeta.categories??pendingMeta.categories)};if(metadata.product!=='eduwills_activation')metadata.product='eduwills_activation';if(String(tx.status||'').toLowerCase()!=='success')return{processed:false,reason:'IGNORED'};const uid=String(metadata.uid||'');const categories=parseCategories(metadata.categories);if(!uid||!categories.length)throw new Error('INVALID_PAYMENT_METADATA');const user=await fsGet(env,`users/${uid}`);";
if (!s.includes(oldStart)) throw new Error('Could not find processPayment start.');
s = s.replace(oldStart, newStart);
s = s.replace("const meta=tx.metadata||{};const authEmail", "const meta=metadata;const authEmail");

const oldInit = "const data=await paystackPost(env,'transaction/initialize',{email:u.email,amount:Math.round(amount*100),currency,reference:ref,callback_url:env.CALLBACK_URL,metadata:{uid:u.localId,categories:cats,durationMs:31536000000,product:'eduwills_activation',country:body.country||'INT',email:u.email,fullName:String(body.fullName||''),username:String(body.username||'')}});return json({reference:data.reference,authorization_url:data.authorization_url,access_code:data.access_code},200,origin);";
const newInit = "const data=await paystackPost(env,'transaction/initialize',{email:u.email,amount:Math.round(amount*100),currency,reference:ref,callback_url:env.CALLBACK_URL,metadata:{uid:u.localId,categories:cats,durationMs:31536000000,product:'eduwills_activation',country:body.country||'INT',email:u.email,fullName:String(body.fullName||''),username:String(body.username||'')}});await fsWrite(env,`paymentTransactions/${data.reference}`,{reference:data.reference,uid:u.localId,email:u.email,fullName:String(body.fullName||''),username:String(body.username||''),categories:JSON.stringify(cats),country:String(body.country||'INT'),currency,paymentAmount:amount,status:'pending',createdAt:new Date().toISOString(),callbackUrl:env.CALLBACK_URL});return json({reference:data.reference,authorization_url:data.authorization_url,access_code:data.access_code},200,origin);";
if (!s.includes(oldInit)) throw new Error('Could not find Paystack initialize block.');
s = s.replace(oldInit, newInit);

const oldVerify = "const tx=await paystackGet(env,`transaction/verify/${encodeURIComponent(reference)}`);if(String(tx?.status||'').toLowerCase()!=='success')return json({error:'Paystack has not confirmed this payment yet.'},409,origin);if(String(tx?.metadata?.product||'')!=='eduwills_activation'||String(tx?.metadata?.uid||'')!==String(u.localId))return json({error:'Payment reference is not linked to this account.'},403,origin);const result=await processPayment(env,tx,u);";
const newVerify = "const tx=await paystackGet(env,`transaction/verify/${encodeURIComponent(reference)}`);if(String(tx?.status||'').toLowerCase()!=='success')return json({error:'Paystack has not confirmed this payment yet.'},409,origin);const pending=await fsGet(env,`paymentTransactions/${reference}`);const pf=pending?.fields||{};const rawMeta=parseMetadata(tx?.metadata);const metadata={...rawMeta,uid:rawMeta.uid||pf.uid?.stringValue||'',categories:(rawMeta.categories??pf.categories?.stringValue)||'[]',product:rawMeta.product||'eduwills_activation'};if(String(metadata.product)!=='eduwills_activation'||String(metadata.uid)!==String(u.localId))return json({error:'Payment reference is not linked to this account.'},403,origin);const result=await processPayment(env,{...tx,metadata},u);await fsWrite(env,`paymentTransactions/${reference}`,{status:'success',verifiedAt:new Date().toISOString()});";
if (!s.includes(oldVerify)) throw new Error('Could not find Paystack verify block.');
s = s.replace(oldVerify, newVerify);

s += `\n${marker}\n`;
fs.writeFileSync(path, s);
console.log('Applied robust payment activation repair.');
// Triggered by the final-repair workflow so the Worker patch is applied to main.
