import fs from 'node:fs';

const activationPath = 'app/dashboard/activation/page.tsx';
let activation = fs.readFileSync(activationPath, 'utf8');

activation = activation.replace(
  /await updateDoc\(doc\(db, 'users', uid\), \{[\s\S]*?activated: true[\s\S]*?\}\);/,
  "await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activatedAt: new Date().toISOString(), activeWilliToken: clean });"
);
activation = activation.replace(
  /await updateDoc\(tokenRef, \{[\s\S]*?used: true[\s\S]*?\}\);/,
  "await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, uid, username: currentUsername, status: 'active', active: true, revoked: false, activationExpiresAt, expiresAt: activationExpiresAt });"
);
fs.writeFileSync(activationPath, activation);

const aiPath = 'app/dashboard/ai/page.tsx';
let ai = fs.readFileSync(aiPath, 'utf8');
const helper = `function expiryMs(v:any){if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return Number(v.seconds)*1000;const n=Date.parse(String(v));return Number.isFinite(n)?n:0;}
function tokenExpiryMs(x:any){
 const explicit=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry);
 if(explicit>0)return explicit;
 if(x.usedAt&&typeof x.durationMs==='number'&&x.durationMs>0){const used=expiryMs(x.usedAt);if(used)return used+x.durationMs;}
 return 0;
}
async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 const userExpiry=expiryMs(d.activationExpiresAt);
 const userFlags=d.activated===true||d.activationStatus==='active'||d.activationActive===true||d.williTokenActive===true;
 if(userFlags&&(!userExpiry||userExpiry>now))return true;
 let activeExpiry=0;
 let activeToken='';
 const username=String(d.username||'').trim().toLowerCase();
 try{
  const snaps=[];
  snaps.push(await getDocs(query(collection(db,'williTokens'),where('userId','==',uid))));
  try{snaps.push(await getDocs(query(collection(db,'williTokens'),where('uid','==',uid))));}catch{}
  if(username){try{snaps.push(await getDocs(query(collection(db,'williTokens'),where('username','==',d.username))));}catch{}}
  const seen=new Set();
  for(const snap of snaps){
   for(const item of snap.docs){
    if(seen.has(item.id))continue;seen.add(item.id);
    const x=item.data()||{};
    const exp=tokenExpiryMs(x);
    if(exp>0&&exp<=now){await deleteDoc(item.ref).catch(()=>undefined);continue;}
    const belongs=String(x.userId||x.uid||'')===uid || (username&&String(x.username||'').trim().toLowerCase()===username);
    const usable=exp>now&&x.used===true&&x.active!==false&&x.revoked!==true&&x.cancelled!==true;
    if(belongs&&usable&&exp>activeExpiry){activeExpiry=exp;activeToken=x.token||item.id;}
   }
  }
 }catch(e){console.warn('EDUWILLS token reconciliation warning',e);}
 if(activeExpiry>now){
  await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:new Date(activeExpiry).toISOString(),activeWilliToken:activeToken||null}).catch(()=>undefined);
  return true;
 }
 if(userExpiry&&userExpiry<=now){
  await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
 }
 return false;
}
type Msg=`;

if(!/function expiryMs\(v:any\)/.test(ai)) throw new Error('AI expiry helper missing');
ai=ai.replace(/function expiryMs\(v:any\)\{[\s\S]*?\ntype Msg=/,helper);
fs.writeFileSync(aiPath,ai);
console.log('WilliToken AI v8 applied: user activation is authoritative while valid; redeemed tokens are resolved by UID or username with robust expiry fallback.');
