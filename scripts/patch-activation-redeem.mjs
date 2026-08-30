import fs from 'node:fs';

const file = 'app/dashboard/activation/page.tsx';
let s = fs.readFileSync(file, 'utf8');

// Keep this workflow patch idempotent. The activation page may already contain
// the transaction-based redemption implementation from a previous deployment.
if (s.includes('runTransaction(db,async tx=>')) {
  console.log('Activation redemption is already transaction-based; nothing to patch.');
  process.exit(0);
}

if (!s.includes('runTransaction')) {
  s = s.replace(
    "import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch, serverTimestamp } from 'firebase/firestore';",
    "import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch, serverTimestamp, runTransaction } from 'firebase/firestore';"
  );
}

const start = s.indexOf('async function redeem()');
if (start < 0) throw new Error('Could not locate activation redeem function.');

const markers = ['\n if(loading)', '\n if (loading)', '\nif(loading)', '\nif (loading)'];
const end = markers.map(marker => s.indexOf(marker, start)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? -1;
if (end < 0) throw new Error('Could not locate the end of the activation redeem function.');

const replacement = `async function redeem(){const clean=code.trim().toUpperCase();if(!/^[A-Z0-9]{10}$/.test(clean)){setMessage('Enter the 10-character activation code from your email.');return}const current=auth.currentUser;if(!current){setMessage('Please sign in again.');return}setRedeeming(true);setMessage('');try{const tokenRef=doc(db,'williTokens',clean);const userRef=doc(db,'users',current.uid);const result=await runTransaction(db,async tx=>{const tokenSnap=await tx.get(tokenRef);if(!tokenSnap.exists())throw new Error('ACTIVATION_CODE_NOT_FOUND');const token=tokenSnap.data()||{};const owner=String(token.userId||token.uid||'');if(owner!==current.uid)throw new Error('ACTIVATION_CODE_NOT_ASSIGNED');if(token.revoked===true||token.cancelled===true)throw new Error('ACTIVATION_CODE_REVOKED');if(token.used===true||token.redeemed===true)throw new Error('ACTIVATION_CODE_USED');const codeExpiry=token.codeExpiresAt?.toDate?.()||(token.codeExpiresAt?new Date(token.codeExpiresAt):null);if(codeExpiry&&codeExpiry.getTime()<=Date.now())throw new Error('ACTIVATION_CODE_EXPIRED');const activationExpiry=token.expiresAt?.toDate?.()||(token.expiresAt?new Date(token.expiresAt):null);if(!activationExpiry||activationExpiry.getTime()<=Date.now())throw new Error('ACTIVATION_TOKEN_EXPIRED');const categories=Array.isArray(token.categories)?token.categories:[];const userSnap=await tx.get(userRef);const existing=userSnap.exists()?userSnap.data()||{}:{};const merged=[...new Set([...(Array.isArray(existing.categories)?existing.categories:[]),...categories])];tx.update(tokenRef,{used:true,redeemed:true,active:true,redeemedBy:current.uid,redeemedAt:serverTimestamp()});tx.update(userRef,{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:activationExpiry,activeWilliToken:clean,activatedAt:serverTimestamp(),categories:merged,category:merged[0]||existing.category||'',educationLevels:merged,schoolLevels:merged,pendingActivationCode:null,pendingActivationCodeExpiresAt:null,pendingActivationPaymentStatus:null});return{activationExpiresAt:activationExpiry.getTime(),categories:categories.length?categories:merged}});setActivationSuccess({categories:result.categories,expiresAt:new Date(result.activationExpiresAt)});setMessage('');setCode('')}catch(e){const code=e?.message||'';const messages={ACTIVATION_CODE_NOT_FOUND:'That activation code was not found.',ACTIVATION_CODE_NOT_ASSIGNED:'This activation code belongs to a different account.',ACTIVATION_CODE_REVOKED:'This WilliToken has been revoked.',ACTIVATION_CODE_USED:'This WilliToken has already been redeemed.',ACTIVATION_CODE_EXPIRED:'This activation code has expired.',ACTIVATION_TOKEN_EXPIRED:'This WilliToken has expired.'};setMessage(messages[code]||'Activation failed. Please refresh and try again.')}finally{setRedeeming(false)}}`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(file, s);
console.log('Activation redemption patched successfully.');
