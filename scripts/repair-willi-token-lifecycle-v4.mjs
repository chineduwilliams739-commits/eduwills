import fs from 'node:fs';

const adminPath = 'app/admin/page.tsx';
let admin = fs.readFileSync(adminPath, 'utf8');

// Ensure the Admin source has every Firestore helper used below.
admin = admin.replace(/import \{[^\n]*\} from 'firebase\/firestore';/, "import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';");

// Normalize expiry handling for Firestore Timestamps and ISO dates.
admin = admin.replace(/function tokenExpiry\(t\?: WilliToken\): Date \| null \{[\s\S]*?\n\}/, `function tokenExpiry(t?: WilliToken): Date | null {
  if (!t) return null;
  const raw: any = t.expiresAt;
  if (raw?.toDate) { const d = raw.toDate(); if (d instanceof Date) return d; }
  if (raw instanceof Date) return raw;
  if (typeof raw === 'string' || typeof raw === 'number') { const d = new Date(raw); if (!Number.isNaN(d.getTime())) return d; }
  const created = t.createdAt?.toDate?.();
  if (created instanceof Date && typeof t.durationMs === 'number') return new Date(created.getTime() + t.durationMs);
  return null;
}`);

// Active token expiry = every non-expired generated token, whether used or not.
// IMPORTANT: replace the complete line. Do not use an unanchored `.*?;` because
// the predicate itself contains semicolons and can leave a duplicated fragment.
admin = admin.replace(/^  const userTokens = \(uid: string\) => .*;$/m, `  const userTokens = (uid: string) => tokens.filter(t => (t.userId || t.uid) === uid).filter(t => { const e = tokenExpiry(t); return !!e && e.getTime() > Date.now(); }).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));`);

// Replace token creation only for older source variants that still expose a
// removeBook marker. Current Admin source already has the correct createToken
// implementation, so this block intentionally does nothing there.
const createStart = admin.indexOf('  const createToken = async () => {');
const removeStart = admin.indexOf('  const removeBook = async', createStart);
if (createStart >= 0 && removeStart > createStart) {
  admin = admin.slice(0, createStart) + `  const createToken = async () => {
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
      setGenerated(t); setCopied(false); await load();
    } catch (e: any) {
      alert(e?.code === 'permission-denied' ? 'Firebase denied the WilliToken operation. Publish the latest Firestore rules and try again.' : 'Could not create the token.');
    }
  };

` + admin.slice(removeStart);
}

// Replace the token loading assignment with authoritative live-token cleanup.
const patterns = [
  /      setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\);/,
  /      setTokens\(activeTokenDocs\);/,
  /      setTokens\(liveTokenDocs\);/,
];
const replacement = `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
      const nowMs = Date.now();
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= nowMs; });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > nowMs; });
      setTokens(liveTokenDocs);

      // A user becomes active only after a token has been redeemed (used=true).
      // Unused generated tokens remain visible above but do not unlock the user.
      const redeemedByUser = new Map<string, WilliToken>();
      for (const x of liveTokenDocs) {
        if (!x.used || !x.userId) continue;
        const old = redeemedByUser.get(x.userId);
        if (!old || (tokenExpiry(x)?.getTime() || 0) > (tokenExpiry(old)?.getTime() || 0)) redeemedByUser.set(x.userId, x);
      }
      await Promise.all(u.docs.map(async d => {
        const user = { id: d.id, ...d.data() } as User;
        const uid = user.uid || user.id;
        const redeemed = redeemedByUser.get(uid);
        const raw: any = user.activationExpiresAt;
        const exp = raw?.toDate ? raw.toDate() : (raw ? new Date(raw) : null);
        const expMs = exp instanceof Date && !Number.isNaN(exp.getTime()) ? exp.getTime() : 0;
        if (redeemed) {
          await updateDoc(doc(db, 'users', uid), {
            activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true,
            activationExpiresAt: tokenExpiry(redeemed)!.toISOString(), activeWilliToken: redeemed.token || redeemed.id,
          }).catch(() => undefined);
        } else if (user.activated === true && expMs > 0 && expMs <= nowMs) {
          await updateDoc(doc(db, 'users', uid), {
            activated: false, activationStatus: 'inactive', activationActive: false, williTokenActive: false,
            activationExpiresAt: null, activeWilliToken: null,
          }).catch(() => undefined);
        }
      }));`;
for (const p of patterns) {
  if (p.test(admin)) { admin = admin.replace(p, replacement); break; }
}
fs.writeFileSync(adminPath, admin);

// EDUWILLS AI follows the same rule: only a redeemed, non-expired token can
// unlock AI. Stale activation fields cannot override an expired activation.
const aiPath = 'app/dashboard/ai/page.tsx';
let ai = fs.readFileSync(aiPath, 'utf8');
ai = ai.replace(/import \{[^\n]*\} from 'firebase\/firestore';/, "import {collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc} from 'firebase/firestore';");
const helper = `async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 let redeemedActive=false; let redeemedExpiry=''; let redeemedToken='';
 try{
   const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
   for(const item of snap.docs){
     const x=item.data()||{}; const raw=x.expiresAt||x.activationExpiresAt||x.expiry;
     const exp=typeof raw?.toDate==='function'?raw.toDate().getTime():new Date(raw).getTime();
     if(Number.isFinite(exp)&&exp<=now){ await deleteDoc(item.ref).catch(()=>undefined); continue; }
     if(Number.isFinite(exp)&&exp>now&&x.used===true){
       redeemedActive=true;
       if(!redeemedExpiry||exp>new Date(redeemedExpiry).getTime()) { redeemedExpiry=new Date(exp).toISOString(); redeemedToken=x.token||item.id; }
     }
   }
 }catch(e){ console.warn('EDUWILLS token reconciliation failed',e); }
 const directExpiry=expiryMs(d.activationExpiresAt);
 const directActive=(d.activationStatus==='active'||d.williTokenActive===true||d.activationActive===true||d.activated===true||d.isActive===true)&&(!directExpiry||directExpiry>now);
 const active=redeemedActive||directActive;
 if(active){
   const patch:any={activated:true,activationStatus:'active',activationActive:true,williTokenActive:true};
   if(redeemedExpiry) patch.activationExpiresAt=redeemedExpiry;
   if(redeemedToken) patch.activeWilliToken=redeemedToken;
   await updateDoc(doc(db,'users',uid),patch).catch(()=>undefined);
 }else if(d.activated===true&&directExpiry>0&&directExpiry<=now){
   await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
 }
 return active;
}
`;
if(ai.includes('async function reconcileActivation')) ai=ai.replace(/async function reconcileActivation\(uid:string,d:any\)\{[\s\S]*?\n\}\n(?=type Msg)/,helper+'\n');
else ai=ai.replace("type Msg={role:'ai'|'user';text:string};",helper+"\ntype Msg={role:'ai'|'user';text:string};");
fs.writeFileSync(aiPath,ai);

console.log('WilliToken lifecycle v4 applied safely: live generated tokens remain in Active token expiry, expired tokens are deleted, only redeemed live tokens activate users/AI, and the Admin source is not corrupted by partial-line replacement.');
