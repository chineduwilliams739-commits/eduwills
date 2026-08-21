import fs from 'node:fs';

// Final WilliToken lifecycle repair.
// Runs in CI before `next build` and makes the Firestore token/account state
// authoritative from the token's expiry timestamp.

const adminPath = 'app/admin/page.tsx';
let admin = fs.readFileSync(adminPath, 'utf8');

// Parse Firestore Timestamp, ISO strings and legacy Date-like values.
admin = admin.replace(
  /function tokenExpiry\(t\?: WilliToken\): Date \| null \{[\s\S]*?\n\}/,
  `function tokenExpiry(t?: WilliToken): Date | null {
  if (!t) return null;
  const raw: any = t.expiresAt;
  if (raw?.toDate) { const d = raw.toDate(); if (d instanceof Date) return d; }
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string' || typeof raw === 'number') { const d = new Date(raw); if (!Number.isNaN(d.getTime())) return d; }
  const created = t.createdAt?.toDate?.();
  if (created instanceof Date && typeof t.durationMs === 'number') return new Date(created.getTime() + t.durationMs);
  return null;
}`
);

// Only non-expired tokens belong in the Active token expiry area. Used does
// NOT mean expired: a redeemed token remains active until expiresAt.
admin = admin.replace(
  /const userTokens = \(uid: string\) => .*?;/,
  `const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && (() => { const e = tokenExpiry(t); return !!e && e.getTime() > Date.now(); })()).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));`
);

// Load only live tokens into the dashboard and automatically delete expired
// token documents. Also reconcile the linked user's status.
const oldTokenLoad = /      setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\);/;
if (oldTokenLoad.test(admin)) {
  admin = admin.replace(oldTokenLoad, `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= nowMs; });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > nowMs; });
      setTokens(liveTokenDocs);
      const liveByUser = new Map<string, WilliToken>();
      for (const x of liveTokenDocs) { if (x.userId) { const old = liveByUser.get(x.userId); if (!old || (tokenExpiry(x)?.getTime() || 0) > (tokenExpiry(old)?.getTime() || 0)) liveByUser.set(x.userId, x); } }
      await Promise.all(u.docs.map(async d => {
        const user = { id: d.id, ...d.data() } as User;
        const uid = user.uid || user.id;
        const live = liveByUser.get(uid);
        const currentExp = user.activationExpiresAt?.toDate?.() || (typeof user.activationExpiresAt === 'string' ? new Date(user.activationExpiresAt) : null);
        const currentMs = currentExp instanceof Date && !Number.isNaN(currentExp.getTime()) ? currentExp.getTime() : 0;
        if (live) {
          const exp = tokenExpiry(live)!.toISOString();
          if (user.activated !== true || user.activationExpiresAt !== exp || user.activationStatus !== 'active') {
            await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt: exp, activeWilliToken: live.token || live.id }).catch(() => undefined);
          }
        } else if (user.activated === true && currentMs > 0 && currentMs <= nowMs) {
          await updateDoc(doc(db, 'users', uid), { activated: false, activationStatus: 'inactive', activationActive: false, williTokenActive: false, activationExpiresAt: null, activeWilliToken: null }).catch(() => undefined);
        }
      }));`);
}

// Replace token generation so every generated token is immediately placed in
// the active list and activates the selected user's account. The expiry clock
// starts at generation, not redemption.
const createStart = admin.indexOf('  const createToken = async () => {');
const removeStart = admin.indexOf('  const removeBook = async', createStart);
if (createStart >= 0 && removeStart > createStart) {
  const createBlock = `  const createToken = async () => {
    const u = selectedUser;
    if (!u) return alert('Select a user first.');
    const chosen = effectiveDurationFor(u);
    const ms = durations.find(x => x[0] === chosen)?.[1];
    if (!ms) return alert('No valid WilliToken duration is configured for this user.');
    const t = token();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ms);
    try {
      await setDoc(doc(db, 'williTokens', t), {
        token: t, userId: u.uid || u.id, username: u.username || '', categories: categoriesFor(u),
        duration: chosen, durationMs: ms, createdAt: serverTimestamp(), issuedAt: now.toISOString(),
        expiresAt, used: false, active: true,
      });
      await updateDoc(doc(db, 'users', u.uid || u.id), {
        activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true,
        activationExpiresAt: expiresAt.toISOString(), activatedAt: now.toISOString(), activeWilliToken: t,
      });
      setGenerated(t); setCopied(false); await load();
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Firebase denied the WilliToken operation. Publish the latest Firestore rules and try again.' : 'Could not create the token.');
    }
  };

`;
  admin = admin.slice(0, createStart) + createBlock + admin.slice(removeStart);
}

fs.writeFileSync(adminPath, admin);

// Fix EDUWILLS AI: never return false just because the user's old activation
// fields are stale. First inspect live token documents, then reconcile the user.
const aiPath = 'app/dashboard/ai/page.tsx';
let ai = fs.readFileSync(aiPath, 'utf8');

if (!ai.includes('async function reconcileActivation')) {
  ai = ai.replace(
    "import {doc,getDoc,setDoc,updateDoc} from 'firebase/firestore';",
    "import {collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc} from 'firebase/firestore';"
  );
  const marker = "type Msg={role:'ai'|'user';text:string};";
  const helper = `async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 let liveToken=false;
 let liveExpiry='';
 let liveTokenId='';
 try{
   const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
   for(const item of snap.docs){
     const x=item.data()||{};
     const raw=x.expiresAt||x.activationExpiresAt||x.expiry;
     const exp=typeof raw?.toDate==='function'?raw.toDate().getTime():new Date(raw).getTime();
     if(Number.isFinite(exp)&&exp>now){
       liveToken=true;
       if(!liveExpiry||exp>new Date(liveExpiry).getTime()) liveExpiry=new Date(exp).toISOString();
       liveTokenId=x.token||item.id;
     }else if(Number.isFinite(exp)&&exp<=now){ await deleteDoc(item.ref).catch(()=>undefined); }
   }
 }catch(e){ console.warn('EDUWILLS token reconciliation failed',e); }
 const directExpiry=expiryMs(d.activationExpiresAt);
 const directActive=(d.activationStatus==='active'||d.williTokenActive===true||d.activationActive===true||d.activated===true||d.isActive===true)&&(!directExpiry||directExpiry>now);
 const active=liveToken||directActive;
 if(active){
   const patch:any={activated:true,activationStatus:'active',activationActive:true,williTokenActive:true};
   if(liveExpiry) patch.activationExpiresAt=liveExpiry;
   if(liveTokenId) patch.activeWilliToken=liveTokenId;
   await updateDoc(doc(db,'users',uid),patch).catch(()=>undefined);
 }else if(d.activated===true&&directExpiry>0&&directExpiry<=now){
   await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
 }
 return active;
}

`;
  ai = ai.replace(marker, helper + marker);
}

ai = ai.replace(
  /const isActive=await reconcileActivation\(u\.uid,d\);setActive\(isActive\);/,
  'const isActive=await reconcileActivation(u.uid,d);setActive(isActive);'
);

fs.writeFileSync(aiPath, ai);

console.log('WilliToken lifecycle v3 applied: live generated tokens stay in Active token expiry until expiry, expired tokens are deleted, redeemed tokens remain active, users are marked active, and EDUWILLS AI reconciles from live token records.');
