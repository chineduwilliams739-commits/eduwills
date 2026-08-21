import fs from 'node:fs';

const activationPath = 'app/dashboard/activation/page.tsx';
let activation = fs.readFileSync(activationPath, 'utf8');

activation = activation.replace(
  /await updateDoc\(doc\(db, 'users', uid\), \{[^\n]*activated: true[^\n]*\}\);/,
  "await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activatedAt: new Date().toISOString(), activeWilliToken: clean });"
);

activation = activation.replace(
  /await updateDoc\(tokenRef, \{[^\n]*used: true[^\n]*\}\);/,
  "await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, username: currentUsername, status: 'active', active: true, activationExpiresAt, expiresAt: activationExpiresAt });"
);

fs.writeFileSync(activationPath, activation);

const aiPath = 'app/dashboard/ai/page.tsx';
let ai = fs.readFileSync(aiPath, 'utf8');

const helper = `async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 let redeemedActive=false;
 let latestExpiry=0;
 let latestToken='';
 try{
  const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
  for(const item of snap.docs){
   const x=item.data()||{};
   const exp=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry);
   if(exp>0&&exp<=now){await deleteDoc(item.ref).catch(()=>undefined);continue;}
   if(exp>now&&x.used===true&&x.active!==false&&x.revoked!==true&&x.cancelled!==true){
    redeemedActive=true;
    if(exp>latestExpiry){latestExpiry=exp;latestToken=x.token||item.id;}
   }
  }
 }catch(e){console.warn('EDUWILLS token query unavailable',e);}
 const userExpiry=expiryMs(d.activationExpiresAt);
 const userActive=(d.activated===true||d.activationStatus==='active'||d.activationActive===true||d.williTokenActive===true)&&(!userExpiry||userExpiry>now);
 const active=redeemedActive||userActive;
 if(active){
  const patch:any={activated:true,activationStatus:'active',activationActive:true,williTokenActive:true};
  if(latestExpiry)patch.activationExpiresAt=new Date(latestExpiry).toISOString();
  if(latestToken)patch.activeWilliToken=latestToken;
  await updateDoc(doc(db,'users',uid),patch).catch(()=>undefined);
  return true;
 }
 if(userExpiry&&userExpiry<=now){
  await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
 }
 return false;
}
type Msg=`;

if(!/async function reconcileActivation\(uid:string,d:any\)/.test(ai)) throw new Error('AI reconciliation function missing');
ai = ai.replace(/async function reconcileActivation\(uid:string,d:any\)\{[\s\S]*?\ntype Msg=/, helper);
fs.writeFileSync(aiPath, ai);

console.log('WilliToken AI v7 applied: redeemed live tokens and valid user activation now unlock EDUWILLS AI; expired tokens are removed.');
