import fs from 'node:fs';

const aiPath = 'app/dashboard/ai/page.tsx';
const activationPath = 'app/dashboard/activation/page.tsx';

let ai = fs.readFileSync(aiPath, 'utf8');
let activation = fs.readFileSync(activationPath, 'utf8');

const oldReconcile = `async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 const direct=activeFromRecord(d);
 if(d.activationExpiresAt && expiryMs(d.activationExpiresAt)<=now){
   await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
   return false;
 }
 try{
   const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
   let active=false;
   let latestExpiry=0;
   for(const item of snap.docs){
     const x=item.data()||{};
     const exp=expiryMs(x.expiresAt||x.activationExpiresAt||x.expiry);
     if(exp>now&&x.active!==false){active=true;if(exp>latestExpiry)latestExpiry=exp;}
     else if(exp&&exp<=now) await deleteDoc(item.ref).catch(()=>undefined);
   }
   if(active&&!direct){
     await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:new Date(latestExpiry).toISOString(),activeWilliToken:snap.docs.find(item=>{const x=item.data()||{};return expiryMs(x.expiresAt||x.activationExpiresAt||x.expiry)===latestExpiry})?.id||null}).catch(()=>undefined);
   }
   return direct||active;
 }catch{return direct;}
}`;

const newReconcile = `async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 const directExpiry=expiryMs(d.activationExpiresAt);
 if(d.activationExpiresAt && directExpiry<=now){
   await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
 }
 let active=Boolean((d.activated===true||d.activationStatus==='active'||d.activationActive===true||d.williTokenActive===true) && (!directExpiry||directExpiry>now));
 let latestExpiry=directExpiry>now?directExpiry:0;
 let latestId=d.activeWilliToken||null;
 try{
   const candidates=[];
   const byUid=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
   byUid.docs.forEach(r=>candidates.push(r));
   const byUidField=await getDocs(query(collection(db,'williTokens'),where('uid','==',uid)));
   byUidField.docs.forEach(r=>{if(!candidates.some(c=>c.id===r.id))candidates.push(r);});
   const username=String(d.username||'').trim().toLowerCase();
   if(username){
     const byUsername=await getDocs(query(collection(db,'williTokens'),where('username','==',username)));
     byUsername.docs.forEach(r=>{if(!candidates.some(c=>c.id===r.id))candidates.push(r);});
   }
   for(const item of candidates){
     const x=item.data()||{};
     const exp=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry||(x.durationMs&&x.usedAt?new Date(expiryMs(x.usedAt)+Number(x.durationMs)).toISOString():null));
     if(exp>now && x.revoked!==true && x.cancelled!==true && (x.used===true || x.status==='active' || x.active===true)){
       active=true;
       if(exp>latestExpiry){latestExpiry=exp;latestId=item.id;}
       if(x.used===true && (x.expiresAt!==new Date(exp).toISOString() || x.activationExpiresAt!==new Date(exp).toISOString())){
         await updateDoc(item.ref,{active:true,status:'active',activationExpiresAt:new Date(exp).toISOString(),expiresAt:new Date(exp).toISOString(),userId:uid,uid}).catch(()=>undefined);
       }
     } else if(exp && exp<=now){ await deleteDoc(item.ref).catch(()=>undefined); }
   }
   if(active){
     await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:new Date(latestExpiry).toISOString(),activeWilliToken:latestId}).catch(()=>undefined);
   }
   return active;
 }catch{return active;}
}`;

if (ai.includes(oldReconcile)) ai = ai.replace(oldReconcile, newReconcile);
else if (!ai.includes("where('uid','==',uid)") || !ai.includes("where('username','==',username)")) throw new Error('AI reconciliation block not found');

const oldUserUpdate = `await updateDoc(doc(db, 'users', uid), { activated: true, activationExpiresAt, activatedAt: new Date().toISOString() });`;
const newUserUpdate = `const activatedAt = new Date().toISOString();
      await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activatedAt, activeWilliToken: clean });`;
const oldTokenUpdate = `await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, username: currentUsername });`;
const newTokenUpdate = `await updateDoc(tokenRef, { used: true, usedAt: activatedAt, userId: uid, uid, username: currentUsername, active: true, status: 'active', activationExpiresAt, expiresAt: activationExpiresAt });`;
if (activation.includes(oldUserUpdate) && activation.includes(oldTokenUpdate)) {
  activation = activation.replace(oldUserUpdate,newUserUpdate).replace(oldTokenUpdate,newTokenUpdate);
} else if (!activation.includes("activationStatus: 'active'") || !activation.includes('expiresAt: activationExpiresAt')) {
  throw new Error('Activation update blocks not found');
}

fs.writeFileSync(aiPath, ai);
fs.writeFileSync(activationPath, activation);
console.log('WilliToken AI v9 applied: AI accepts valid redeemed tokens by UID or username, activation state is synchronized, and redeemed token expiry is persisted.');
