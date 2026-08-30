import fs from 'node:fs';

const file = 'app/dashboard/activation/page.tsx';
let s = fs.readFileSync(file, 'utf8');

// Idempotent: don't patch an implementation that is already transaction-based.
if (s.includes('await runTransaction(db,async tx=>')) {
  console.log('Activation redemption is already transaction-based; nothing to patch.');
  process.exit(0);
}

if (!s.includes('runTransaction')) {
  const importPattern = /import \{([^}]*?)\} from 'firebase\/firestore';/;
  if (!importPattern.test(s)) throw new Error('Could not locate the Firebase Firestore import.');
  s = s.replace(importPattern, (match, imports) => {
    if (/\brunTransaction\b/.test(imports)) return match;
    const trimmed = imports.trim();
    return `import { ${trimmed}${trimmed ? ', ' : ''}runTransaction } from 'firebase/firestore';`;
  });
}

const start = s.indexOf('async function redeem()');
if (start < 0) throw new Error('Could not locate activation redeem function.');

// Locate the function's actual closing brace with a small lexical scanner.
// This avoids depending on a particular line break or the next JSX marker.
const open = s.indexOf('{', start);
if (open < 0) throw new Error('Could not locate the start of the activation redeem function body.');

let depth = 0;
let end = -1;
let quote = null;
let escaped = false;
let lineComment = false;
let blockComment = false;

for (let i = open; i < s.length; i++) {
  const ch = s[i];
  const next = s[i + 1];

  if (lineComment) {
    if (ch === '\n') lineComment = false;
    continue;
  }
  if (blockComment) {
    if (ch === '*' && next === '/') { blockComment = false; i++; }
    continue;
  }
  if (quote) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === quote) quote = null;
    continue;
  }
  if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
  if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
  if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}

if (end < 0) throw new Error('Could not locate the end of the activation redeem function.');

const replacement = `async function redeem(){const clean=code.trim().toUpperCase();if(!/^[A-Z0-9]{10}$/.test(clean)){setMessage('Enter the 10-character activation code from your email.');return}const current=auth.currentUser;if(!current){setMessage('Please sign in again.');return}setRedeeming(true);setMessage('');try{const tokenRef=doc(db,'williTokens',clean);const userRef=doc(db,'users',current.uid);const result=await runTransaction(db,async tx=>{const tokenSnap=await tx.get(tokenRef);if(!tokenSnap.exists())throw new Error('ACTIVATION_CODE_NOT_FOUND');const token=tokenSnap.data()||{};const owner=String(token.userId||token.uid||'');if(owner!==current.uid)throw new Error('ACTIVATION_CODE_NOT_ASSIGNED');if(token.revoked===true||token.cancelled===true)throw new Error('ACTIVATION_CODE_REVOKED');if(token.used===true||token.redeemed===true)throw new Error('ACTIVATION_CODE_USED');const codeExpiry=token.codeExpiresAt?.toDate?.()||(token.codeExpiresAt?new Date(token.codeExpiresAt):null);if(codeExpiry&&codeExpiry.getTime()<=Date.now())throw new Error('ACTIVATION_CODE_EXPIRED');const activationExpiry=token.expiresAt?.toDate?.()||(token.expiresAt?new Date(token.expiresAt):null);if(!activationExpiry||activationExpiry.getTime()<=Date.now())throw new Error('ACTIVATION_TOKEN_EXPIRED');const categories=Array.isArray(token.categories)?token.categories:[];const userSnap=await tx.get(userRef);const existing=userSnap.exists()?userSnap.data()||{}:{};const merged=[...new Set([...(Array.isArray(existing.categories)?existing.categories:[]),...categories])];tx.update(tokenRef,{used:true,redeemed:true,active:true,redeemedBy:current.uid,redeemedAt:serverTimestamp()});tx.update(userRef,{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:activationExpiry,activeWilliToken:clean,activatedAt:serverTimestamp(),categories:merged,category:merged[0]||existing.category||'',educationLevels:merged,schoolLevels:merged,pendingActivationCode:null,pendingActivationCodeExpiresAt:null,pendingActivationPaymentStatus:null});return{activationExpiresAt:activationExpiry.getTime(),categories:categories.length?categories:merged}});setSuccess({categories:result.categories,expiresAt:new Date(result.activationExpiresAt)});setMessage('');setCode('')}catch(e){const code=e?.message||'';const messages={ACTIVATION_CODE_NOT_FOUND:'That activation code was not found.',ACTIVATION_CODE_NOT_ASSIGNED:'This activation code belongs to a different account.',ACTIVATION_CODE_REVOKED:'This WilliToken has been revoked.',ACTIVATION_CODE_USED:'This WilliToken has already been redeemed.',ACTIVATION_CODE_EXPIRED:'This activation code has expired.',ACTIVATION_TOKEN_EXPIRED:'This WilliToken has expired.'};setMessage(messages[code]||'Activation failed. Please refresh and try again.')}finally{setRedeeming(false)}}`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(file, s);
console.log('Activation redemption patched successfully.');
