import fs from 'node:fs';

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s); }
function replaceIfNeeded(p, re, replacement) {
  const s = read(p);
  if (typeof re === 'string') {
    if (!s.includes(re)) return false;
    write(p, s.replace(re, replacement));
    return true;
  }
  if (!re.test(s)) return false;
  write(p, s.replace(re, replacement));
  return true;
}

// Redemption: preserve the activation expiry selected by the Admin/token.
replaceIfNeeded(
  'app/dashboard/activation/page.tsx',
  /await updateDoc\(tokenRef, \{ used: true, usedAt: new Date\(\)\.toISOString\(\), userId: uid, username: currentUsername \}\);/,
  "await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, username: currentUsername, status: 'active', activationExpiresAt, expiresAt: activationExpiresAt });"
);

// Dashboard: if the latest dashboard implementation has the old direct-only
// activation check, add a live redeemed-token check. If a newer repair already
// supplied it, leave it untouched rather than failing the deployment.
const dashboard = 'app/dashboard/page.tsx';
let d = read(dashboard);
if (d.includes("import { doc, getDoc } from 'firebase/firestore';") && !d.includes("collection, doc, getDoc, getDocs, query, where")) {
  d = d.replace("import { doc, getDoc } from 'firebase/firestore';", "import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';");
}
if (!d.includes('async function getActiveToken')) {
  const marker = 'export default function DashboardPage';
  const helper = `async function getActiveToken(uid:string){\n const now=Date.now();\n try{\n  const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));\n  let latest:any=null;\n  for(const item of snap.docs){ const x=item.data()||{}; const raw=x.activationExpiresAt||x.expiresAt||x.expiry; const exp=typeof raw?.toDate==='function'?raw.toDate().getTime():new Date(raw).getTime(); if(exp>now&&x.used===true&&(!latest||exp>latest.exp)) latest={id:item.id,exp}; }\n  return latest;\n }catch{return null;}\n}\n\n`;
  if (d.includes(marker)) d = d.replace(marker, helper + marker);
}
write(dashboard, d);

// AI: v4 is authoritative. Only repair an old direct-only helper if it remains.
const ai = 'app/dashboard/ai/page.tsx';
let a = read(ai);
if (!a.includes("collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc")) {
  a = a.replace(/import \{[^\n]*\} from 'firebase\/firestore';/, "import {collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc} from 'firebase/firestore';");
}
write(ai, a);

// Admin: v4 may already have replaced the original setTokens assignment with
// liveTokenDocs. Support both shapes and never abort when v4 already did the job.
const admin = 'app/admin/page.tsx';
let adminText = read(admin);
if (!adminText.includes('const liveTokenDocs =')) {
  const old = /setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\)\);/;
  if (old.test(adminText)) {
    adminText = adminText.replace(old, `const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));\n      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > Date.now(); });\n      await Promise.all(allTokenDocs.filter(x => !liveTokenDocs.some(y => y.id === x.id)).map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));\n      setTokens(liveTokenDocs);`);
  }
}
if (adminText.includes('tokens.filter(t => t.userId === uid && !t.used)')) {
  adminText = adminText.replace(/tokens\.filter\(t => t\.userId === uid && !t\.used\)/g, "tokens.filter(t => t.userId === uid && (tokenExpiry(t)?.getTime() || 0) > Date.now())");
}
write(admin, adminText);

console.log('WilliToken lifecycle v5 applied');
