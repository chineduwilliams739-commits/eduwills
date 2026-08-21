import fs from 'node:fs';

const aiPath = 'app/dashboard/ai/page.tsx';
const activationPath = 'app/dashboard/activation/page.tsx';

let ai = fs.readFileSync(aiPath, 'utf8');
let activation = fs.readFileSync(activationPath, 'utf8');

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
   const add=(rows:any[])=>rows.forEach((r:any)=>{if(!candidates.some((c:any)=>c.id===r.id))candidates.push(r);});
   const byUserId=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
   add(byUserId.docs);
   const byUid=await getDocs(query(collection(db,'williTokens'),where('uid','==',uid)));
   add(byUid.docs);
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
     const exp=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry)||(fallbackExpiry||0);
     const redeemed=x.used===true||x.status==='active'||x.active===true;
     const blocked=x.revoked===true||x.cancelled===true;
     if(exp>now&&!blocked&&redeemed){
       active=true;
       if(exp>latestExpiry){latestExpiry=exp;latestId=item.id;}
       const iso=new Date(exp).toISOString();
       if(x.used===true && (x.active!==true||x.status!=='active'||x.activationExpiresAt!==iso||x.expiresAt!==iso||x.userId!==uid||x.uid!==uid)){
         await updateDoc(item.ref,{used:true,active:true,status:'active',activationExpiresAt:iso,expiresAt:iso,userId:uid,uid}).catch(()=>undefined);
       }
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

// Replace whatever reconciliation implementation the preceding v7/v8 repairs left behind.
const reconcilePattern = /async function reconcileActivation\(uid:string,d:any\)\{[\s\S]*?\n\}\ntype Msg=/;
if (reconcilePattern.test(ai)) {
  ai = ai.replace(reconcilePattern, `${newReconcile}\ntype Msg=`);
} else {
  throw new Error('AI reconcileActivation function not found');
}

// Ensure the activation page persists the complete redeemed-token state.
const userUpdatePattern = /await updateDoc\(doc\(db, ['\"]users['\"], uid\), \{ activated: true, activationExpiresAt, activatedAt: new Date\(\)\.toISOString\(\) \}\);/;
const tokenUpdatePattern = /await updateDoc\(tokenRef, \{ used: true, usedAt: new Date\(\)\.toISOString\(\), userId: uid, username: currentUsername \}\);/;

if (userUpdatePattern.test(activation) && tokenUpdatePattern.test(activation)) {
  activation = activation.replace(userUpdatePattern, `const activatedAt = new Date().toISOString();\n      await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activatedAt, activeWilliToken: clean });`);
  activation = activation.replace(tokenUpdatePattern, `await updateDoc(tokenRef, { used: true, usedAt: activatedAt, userId: uid, uid, username: currentUsername, active: true, status: 'active', activationExpiresAt, expiresAt: activationExpiresAt });`);
} else {
  // v9 is allowed to run repeatedly after another repair has already applied these fields.
  const alreadyPatched = activation.includes("activationStatus: 'active'") && activation.includes('expiresAt: activationExpiresAt') && activation.includes('uid, username: currentUsername');
  if (!alreadyPatched) throw new Error('Activation update blocks not found');
}

fs.writeFileSync(aiPath, ai);
fs.writeFileSync(activationPath, activation);
console.log('WilliToken AI v9 applied: AI accepts valid redeemed tokens by UID or username, activation state is synchronized, and redeemed token expiry is persisted.');
