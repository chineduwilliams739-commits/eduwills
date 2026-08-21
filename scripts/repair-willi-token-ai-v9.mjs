import fs from 'node:fs';

const aiPath = 'app/dashboard/ai/page.tsx';
const activationPath = 'app/dashboard/activation/page.tsx';

let ai = fs.readFileSync(aiPath, 'utf8');
let activation = fs.readFileSync(activationPath, 'utf8');

const newReconcile = `async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 const directExpiry=expiryMs(d.activationExpiresAt);
 let active=Boolean((d.activated===true||d.activationStatus==='active'||d.activationActive===true||d.williTokenActive===true) && (!directExpiry||directExpiry>now));
 let latestExpiry=directExpiry>now?directExpiry:0;
 let latestId=d.activeWilliToken||null;
 if(d.activationExpiresAt && directExpiry<=now){
   await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
   active=false;
 }
 try{
   const candidates:any[]=[];
   const add=(rows:any[])=>rows.forEach((r:any)=>{if(!candidates.some((c:any)=>c.id===r.id))candidates.push(r);});
   const byUserId=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
   add(byUserId.docs);
   const username=String(d.username||'').trim();
   if(username){
     const byUsername=await getDocs(query(collection(db,'williTokens'),where('username','==',username)));
     add(byUsername.docs);
   }
   for(const item of candidates){
     const x=item.data()||{};
     const usedAt=expiryMs(x.usedAt);
     const durationMs=Number(x.durationMs||0);
     const fallbackExpiry=usedAt>0&&durationMs>0?usedAt+durationMs:0;
     const exp=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry)||fallbackExpiry;
     const redeemed=x.used===true||x.status==='active';
     const blocked=x.revoked===true||x.cancelled===true;
     if(exp>now&&!blocked&&redeemed){
       active=true;
       if(exp>latestExpiry){latestExpiry=exp;latestId=item.id;}
       const iso=new Date(exp).toISOString();
       await updateDoc(item.ref,{used:true,active:true,status:'active',activationExpiresAt:iso,expiresAt:iso,userId:uid,uid}).catch(()=>undefined);
     } else if(exp&&exp<=now){
       await deleteDoc(item.ref).catch(()=>undefined);
     }
   }
   if(active){
     await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:latestExpiry?new Date(latestExpiry).toISOString():d.activationExpiresAt||null,activeWilliToken:latestId}).catch(()=>undefined);
   }
   return active;
 }catch(error){
   console.error('EDUWILLS AI token reconciliation failed',error);
   return active;
 }
}`;

// Find the reconciliation function by stable structural markers rather than the exact
// implementation produced by an earlier repair version.
const start = ai.indexOf('async function reconcileActivation(');
const end = ai.indexOf('\ntype Msg=', start);
if (start < 0 || end < 0) throw new Error('AI reconcileActivation function boundary not found');
ai = ai.slice(0, start) + newReconcile + ai.slice(end);

// Ensure the activation page persists the complete redeemed-token state.
const userUpdatePattern = /await updateDoc\(doc\(db, ['\"]users['\"], uid\), \{ activated: true, activationExpiresAt, activatedAt: new Date\(\)\.toISOString\(\) \}\);/;
const tokenUpdatePattern = /await updateDoc\(tokenRef, \{ used: true, usedAt: new Date\(\)\.toISOString\(\), userId: uid, username: currentUsername \}\);/;

if (userUpdatePattern.test(activation) && tokenUpdatePattern.test(activation)) {
  activation = activation.replace(userUpdatePattern, `const activatedAt = new Date().toISOString();\n      await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activatedAt, activeWilliToken: clean });`);
  activation = activation.replace(tokenUpdatePattern, `await updateDoc(tokenRef, { used: true, usedAt: activatedAt, userId: uid, uid, username: currentUsername, active: true, status: 'active', activationExpiresAt, expiresAt: activationExpiresAt });`);
} else {
  const alreadyPatched = activation.includes("activationStatus: 'active'") && activation.includes('expiresAt: activationExpiresAt') && activation.includes('userId: uid, uid, username: currentUsername');
  if (!alreadyPatched) throw new Error('Activation update blocks not found');
}

fs.writeFileSync(aiPath, ai);
fs.writeFileSync(activationPath, activation);
console.log('WilliToken AI v9 applied: robust activation reconciliation now uses the current user record plus readable redeemed tokens by UID/username, persists expiry, and removes expired tokens.');
