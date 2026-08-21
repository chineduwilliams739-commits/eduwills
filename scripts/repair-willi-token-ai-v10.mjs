import fs from 'node:fs';

const path = 'app/dashboard/ai/page.tsx';
const src = fs.readFileSync(path, 'utf8');
const start = src.indexOf('async function reconcileActivation(');
const end = src.indexOf('\ntype Msg=', start);
if (start < 0 || end < 0) throw new Error('AI reconciliation function boundaries not found');

const replacement = `async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 const directExpiry=expiryMs(d?.activationExpiresAt);
 const directActive=(d?.activationStatus==='active'||d?.activated===true||d?.activationActive===true||d?.williTokenActive===true)&&(!directExpiry||directExpiry>now);
 if(directActive)return true;

 const linkedId=String(d?.activeWilliToken||'').trim().toUpperCase();
 const username=String(d?.username||'').trim();
 const candidates:any[]=[];
 const seen=new Set<string>();
 const add=(snap:any)=>{if(snap?.exists?.()&&!seen.has(snap.id)){seen.add(snap.id);candidates.push(snap);}};
 try{
   if(linkedId){
     const linked=await getDoc(doc(db,'williTokens',linkedId));
     add(linked);
   }
   const byUid=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
   byUid.docs.forEach(add);
   const byUidField=await getDocs(query(collection(db,'williTokens'),where('uid','==',uid)));
   byUidField.docs.forEach(add);
   if(username){
     const byUsername=await getDocs(query(collection(db,'williTokens'),where('username','==',username)));
     byUsername.docs.forEach(add);
     const lower=username.toLowerCase();
     if(lower!==username){
       const byLower=await getDocs(query(collection(db,'williTokens'),where('username','==',lower)));
       byLower.docs.forEach(add);
     }
   }

   let latestExpiry=0; let latestId:string|null=null;
   for(const item of candidates){
     const x=item.data()||{};
     const exp=tokenActivationExpiry(x);
     const belongs=x.userId===uid||x.uid===uid||String(x.username||'').trim().toLowerCase()===username.toLowerCase();
     const usable=x.used===true&&x.active!==false&&x.revoked!==true&&x.cancelled!==true&&belongs&&exp>now;
     if(usable&&exp>latestExpiry){latestExpiry=exp;latestId=item.id;}
     if(exp>0&&exp<=now){await deleteDoc(item.ref).catch(()=>undefined);}
   }
   if(latestId&&latestExpiry>now){
     const iso=new Date(latestExpiry).toISOString();
     await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:iso,activeWilliToken:latestId}).catch(()=>undefined);
     const activeSnap=await getDoc(doc(db,'williTokens',latestId)).catch(()=>null);
     if(activeSnap?.exists?.())await updateDoc(activeSnap.ref,{uid,userId:uid,username,used:true,active:true,activationStatus:'active',activationActive:true,activationExpiresAt:iso}).catch(()=>undefined);
     return true;
   }
 }catch(e){console.error('EDUWILLS AI token reconciliation failed',e);}
 return directActive;
}`;

fs.writeFileSync(path, src.slice(0,start)+replacement+src.slice(end), 'utf8');
console.log('WilliToken AI v10 applied: authoritative user activation plus direct active-token linkage and UID/username fallback.');
