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

// Redemption must move the token's expiry to the actual activation expiry.
replaceRequired(
  activation,
  /await updateDoc\(tokenRef, \{ used: true, usedAt: new Date\(\)\.toISOString\(\), userId: uid, username: currentUsername \}\);/,
  "await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, username: currentUsername, status: 'active', activationExpiresAt, expiresAt: activationExpiresAt });",
  'token redemption update'
);

// Dashboard: determine activation from the user's redeemed, non-expired token records.
replaceRequired(
  dashboard,
  /function isActiveRecord\(d:any\)\{[\s\S]*?\n\}\n\nexport default function DashboardPage/, 
  `function isActiveRecord(d:any){
 const now=Date.now();
 const expires=expiryMs(d.activationExpiresAt);
 if(d.activationStatus==='active'&&expires>now)return true;
 if(d.activated===true&&expires>now)return true;
 return false;
}
async function getActiveToken(uid:string){
 try{
  const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
  let latest:any=null;
  for(const item of snap.docs){
   const x=item.data()||{};
   const exp=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry);
   if(exp<=now) continue;
   if(x.used!==true) continue;
   if(!latest||exp>latest.exp) latest={id:item.id,exp};
  }
  return latest;
 }catch{return null;}
}

export default function DashboardPage`,
  'dashboard activation helpers'
);
replaceRequired(
  dashboard,
  "import { doc, getDoc } from 'firebase/firestore';",
  "import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';",
  'dashboard firestore imports'
);
replaceRequired(
  dashboard,
  /const d=s\.data\(\);const identity=String\(d\.fullName\?\.split\(' '\)\[0\]\|\|d\.username\|\|u\.displayName\|\|' '\)\.trim\(\);[\s\S]*?setExpiry\(''\);\}\}catch\(e\)\{console\.error\(e\);/,
  `const d=s.data();const identity=String(d.fullName?.split(' ')[0]||d.username||u.displayName||'').trim();if(!identity){await signOut(auth);window.location.replace(\`${BASE}/login/\`);return;}setName(identity);const tokenRecord=await getActiveToken(u.uid);const directExpiry=expiryMs(d.activationExpiresAt);const tokenActive=!!tokenRecord;const active=tokenActive||(isActiveRecord(d)&&directExpiry>Date.now());setActivated(active);if(active){const ms=tokenRecord?.exp||directExpiry;if(ms)setExpiry(new Date(ms).toLocaleString());}else setExpiry('');}catch(e){console.error(e);`,
  'dashboard auth activation check'
);

// AI: query the token collection and use only redeemed, non-expired tokens.
replaceRequired(
  ai,
  "import {collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc} from 'firebase/firestore';",
  "import {collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc} from 'firebase/firestore';",
  'AI firestore import'
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

// Admin: remove expired tokens while loading, keep redeemed active tokens visible, and base user status on them.
replaceRequired(
  admin,
  /const \[users, s, t, p\] = await Promise\.all\(\[[\s\S]*?\n      \]\);/,
  `const [u, s, t, p] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'bookSlots')),
        getDocs(collection(db, 'williTokens')),
        getDoc(doc(db, 'settings', 'williTokenPolicies')),
      ]);
      const now = Date.now();
      const validTokenDocs = [];
      for (const td of t.docs) {
        const x = td.data() || {};
        const exp = tokenExpiry(x).getTime();
        if (exp && exp <= now) { await deleteDoc(td.ref).catch(()=>undefined); continue; }
        validTokenDocs.push(td);
      }
      setUsers(u.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setSlots(s.docs.map(d => ({ id: d.id, ...d.data() } as Slot)).sort((a, b) => a.slot - b.slot));
      setTokens(validTokenDocs.map(d => ({ id: d.id, ...d.data() } as WilliToken)));`,
  'admin token cleanup load'
);
replaceRequired(
  admin,
  /setUsers\(u\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as User\)\)\);\n      setSlots\(s\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as Slot\)\)\.sort\(\(a, b\) => a\.slot - b\.slot\)\);\n      setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\)\);/,
  `// token state is populated above after expired-token cleanup`,
  'admin duplicate token state'
);
replaceRequired(
  admin,
  /const userTokens = \(uid: string\) => tokens\.filter\(t => t\.userId === uid && !t\.used\)\.sort\(\(a, b\) => \(tokenExpiry\(b\)\?\.getTime\(\) \|\| 0\) - \(tokenExpiry\(a\)\?\.getTime\(\) \|\| 0\)\);/,
  `const userTokens = (uid: string) => tokens.filter(t => t.userId === uid).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));
  const activeUserToken = (uid: string) => userTokens(uid).find(t => t.used === true && (tokenExpiry(t)?.getTime() || 0) > Date.now()) || null;
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
  'admin user status'
);
replaceRequired(
  admin,
  /<p className=\"mt-2 text-slate-400\">\{exp \? `WilliToken expires \$\{formatExpiry\(exp\)\}` : 'No active WilliToken'\}<\/p>/,
  `<p className=\"mt-2 text-slate-400\">{exp ? \`WilliToken expires ${formatExpiry(exp)}\` : 'No active WilliToken'}</p><div className=\"mt-1 font-black ${'${userIsActive(uid) ? \'text-emerald-300\' : \'text-slate-500\'}'}\">{userIsActive(uid) ? 'ACTIVE' : 'INACTIVE'}</div>`,
  'admin user status badge'
);

console.log('WilliToken lifecycle v5 applied');
