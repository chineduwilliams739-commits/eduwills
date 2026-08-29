import fs from 'node:fs';

const file = 'app/dashboard/activation/page.tsx';
let s = fs.readFileSync(file, 'utf8');

s = s.replace(
  "import { doc, getDoc } from 'firebase/firestore';",
  "import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';"
);

const start = s.indexOf(' async function redeem(){');
const end = s.indexOf('\n if(loading)', start);
if (start < 0 || end < 0) throw new Error('Could not locate activation redeem function.');

const replacement = ` async function redeem(){const clean=code.trim().toUpperCase();if(!/^[A-Z0-9]{10}$/.test(clean)){setMessage('Enter the 10-character activation code from your email.');return}const current=auth.currentUser;if(!current){setMessage('Please sign in again.');return}setRedeeming(true);setMessage('');try{const tokenRef=doc(db,'williTokens',clean);const userRef=doc(db,'users',current.uid);const result=await runTransaction(db,async tx=>{const tokenSnap=await tx.get(tokenRef);if(!tokenSnap.exists())throw new Error('ACTIVATION_CODE_NOT_FOUND');const token=tokenSnap.data()||{};const owner=String(token.userId||token.uid||'');if(owner!==current.uid)throw new Error('ACTIVATION_CODE_NOT_ASSIGNED');if(token.revoked===true)throw new Error('ACTIVATION_CODE_REVOKED');if(token.used===true||token.redeemed===true)throw new Error('ACTIVATION_CODE_USED');const codeExpiry=token.codeExpiresAt?.toDate?.()||(token.codeExpiresAt?new Date(token.codeExpiresAt):null);if(codeExpiry&&codeExpiry.getTime()<=Date.now())throw new Error('ACTIVATION_CODE_EXPIRED');const activationExpiry=token.expiresAt?.toDate?.()||(token.expiresAt?new Date(token.expiresAt):null);if(!activationExpiry||activationExpiry.getTime()<=Date.now())throw new Error('ACTIVATION_TOKEN_EXPIRED');const categories=Array.isArray(token.categories)?token.categories:[];tx.update(tokenRef,{used:true,redeemed:true,active:true,redeemedBy:current.uid,redeemedAt:serverTimestamp()});tx.update(userRef,{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:activationExpiry.toISOString(),activeWilliToken:clean,activatedAt:new Date().toISOString(),categories,...(categories.length?{category:categories[0],educationLevels:categories,schoolLevels:categories}:{}),pendingActivationCode:null,pendingActivationCodeExpiresAt:null,pendingActivationPaymentStatus:null});return{activationExpiresAt:activationExpiry.getTime()}});setMessage(\`Activation successful. Your access is active until \${new Date(result.activationExpiresAt).toLocaleString('en-NG')}.\`);setCode('');window.setTimeout(()=>window.location.reload(),700)}catch(e){const code=e?.message||'';const messages={ACTIVATION_CODE_NOT_FOUND:'That activation code was not found.',ACTIVATION_CODE_NOT_ASSIGNED:'This activation code belongs to a different account.',ACTIVATION_CODE_REVOKED:'This WilliToken has been revoked.',ACTIVATION_CODE_USED:'This WilliToken has already been redeemed.',ACTIVATION_CODE_EXPIRED:'This activation code has expired.',ACTIVATION_TOKEN_EXPIRED:'This WilliToken has expired.'};setMessage(messages[code]||'Activation failed. Please refresh and try again.')}finally{setRedeeming(false)}}`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(file, s);
console.log('Activation redemption patched successfully.');
