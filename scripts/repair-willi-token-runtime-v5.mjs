import fs from 'node:fs';

const activation = 'app/dashboard/activation/page.tsx';
const dashboard = 'app/dashboard/page.tsx';
const ai = 'app/dashboard/ai/page.tsx';
const admin = 'app/admin/page.tsx';

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s); }
function replaceRequired(p, re, replacement, label) {
  const s = read(p);
  const n = s.replace(re, replacement);
  if (n === s) throw new Error(`v5 could not patch ${label} in ${p}`);
  write(p, n);
}

replaceRequired(
  activation,
  /await updateDoc\(tokenRef, \{ used: true, usedAt: new Date\(\)\.toISOString\(\), userId: uid, username: currentUsername \}\);/,
  "await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, username: currentUsername, status: 'active', activationExpiresAt, expiresAt: activationExpiresAt });",
  'token redemption update'
);

replaceRequired(
  dashboard,
  "import { doc, getDoc } from 'firebase/firestore';",
  "import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';",
  'dashboard firestore imports'
);
replaceRequired(
  dashboard,
  /function isActiveRecord\(d:any\)\{[\s\S]*?\n\}\n\nexport default function DashboardPage/,
  `function isActiveRecord(d:any){
 const now=Date.now();
 const expires=expiryMs(d.activationExpiresAt);
 return d.activationStatus==='active' && expires>now;
}
async function getActiveToken(uid:string){
 const now=Date.now();
 try{
  const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
  let latest:any=null;
  for(const item of snap.docs){
   const x=item.data()||{};
   const exp=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry);
   if(exp>now && x.used===true && (!latest||exp>latest.exp)) latest={id:item.id,exp};
  }
  return latest;
 }catch{return null;}
}

export default function DashboardPage`,
  'dashboard activation helpers'
);
replaceRequired(
  dashboard,
  /const d=s\.data\(\);const identity=String\(d\.fullName\?\.split\(' '\)\[0\]\|\|d\.username\|\|u\.displayName\|\|' '\)\.trim\(\);[\s\S]*?setExpiry\(''\);\}\}catch\(e\)\{console\.error\(e\);/,
  `const d=s.data();const identity=String(d.fullName?.split(' ')[0]||d.username||u.displayName||'').trim();if(!identity){await signOut(auth);window.location.replace(\`${BASE}/login/\`);return;}setName(identity);const tokenRecord=await getActiveToken(u.uid);const directExpiry=expiryMs(d.activationExpiresAt);const active=!!tokenRecord||(isActiveRecord(d)&&directExpiry>Date.now());setActivated(active);if(active){const ms=tokenRecord?.exp||directExpiry;if(ms)setExpiry(new Date(ms).toLocaleString());}else setExpiry('');}catch(e){console.error(e);`,
  'dashboard auth activation check'
);

replaceRequired(
  ai,
  /function activeFromRecord\(d:any\)\{[\s\S]*?\n\}\nasync function reconcileActivation\(uid:string,d:any\)\{[\s\S]*?\n\}\ntype Msg=/,
  `function activeFromRecord(d:any){
 const now=Date.now();
 const expires=expiryMs(d.activationExpiresAt);
 return d.activationStatus==='active' && expires>now;
}
async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 try{
  const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
  let latest=0; let activeTokenId='';
  for(const item of snap.docs){
   const x=item.data()||{};
   const exp=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry);
   if(exp<=now){ await deleteDoc(item.ref).catch(()=>undefined); continue; }
   if(x.used===true && exp>latest){latest=exp;activeTokenId=item.id;}
  }
  if(latest>now){
   await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:new Date(latest).toISOString(),activeWilliToken:activeTokenId}).catch(()=>undefined);
   return true;
  }
  await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
  return false;
 }catch{return activeFromRecord(d);}
}
type Msg=`,
  'AI activation reconciliation'
);

// Admin: keep every non-expired token (used or unused) in Active Token Expiry and delete expired tokens.
replaceRequired(
  admin,
  /setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\)\);/,
  `const validTokenDocs = t.docs.filter(td => { const x = td.data() || {}; const exp = tokenExpiry(x)?.getTime() || 0; return !exp || exp > Date.now(); });
      Promise.all(t.docs.filter(td => !validTokenDocs.includes(td)).map(td => deleteDoc(td.ref).catch(()=>undefined)));
      setTokens(validTokenDocs.map(d => ({ id: d.id, ...d.data() } as WilliToken)));`,
  'admin token cleanup'
);
replaceRequired(
  admin,
  /const userTokens = \(uid: string\) => tokens\.filter\(t => t\.userId === uid && !t\.used\)\.sort\(\(a, b\) => \(tokenExpiry\(b\)\?\.getTime\(\) \|\| 0\) - \(tokenExpiry\(a\)\?\.getTime\(\) \|\| 0\)\);/,
  `const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && (tokenExpiry(t)?.getTime() || 0) > Date.now()).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));
  const activeUserToken = (uid: string) => userTokens(uid).find(t => t.used === true) || null;
  const userIsActive = (uid: string) => !!activeUserToken(uid);`,
  'admin active token selector'
);
replaceRequired(
  admin,
  /const latest = userTokens\(u\.uid \|\| u\.id\)\[0\];/g,
  "const latest = activeUserToken(u.uid || u.id) || userTokens(u.uid || u.id)[0];",
  'admin latest token export'
);
replaceRequired(
  admin,
  /u\.activated \? 'Yes' : 'No'/g,
  "userIsActive(u.uid || u.id) ? 'Active' : 'Inactive'",
  'admin user status export'
);

console.log('WilliToken lifecycle v5 applied');
