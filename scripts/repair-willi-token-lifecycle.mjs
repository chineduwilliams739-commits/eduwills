import fs from 'node:fs';

function replaceOrThrow(file, from, to, label) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(from)) throw new Error(`${label} marker not found in ${file}`);
  fs.writeFileSync(file, source.replace(from, to));
}

// WilliTokens: the selected duration starts when the Admin generates the token.
// The user is immediately marked active, redemption does not restart the clock,
// and expired token records are removed so their codes are available again.
const admin = 'app/admin/page.tsx';
let a = fs.readFileSync(admin, 'utf8');

if (!a.includes("function activationExpiryMs")) {
  const marker = "function remaining(date: Date | null) {";
  const helper = `function activationExpiryMs(value: any) {\n  if (!value) return 0;\n  if (typeof value.toMillis === 'function') return value.toMillis();\n  if (value?.seconds) return Number(value.seconds) * 1000;\n  const n = Date.parse(String(value));\n  return Number.isFinite(n) ? n : 0;\n}\n\nfunction userActivationIsActive(user: User) {\n  const exp = activationExpiryMs(user.activationExpiresAt);\n  return user.activated === true && (!exp || exp > Date.now());\n}\n\n`;
  if (!a.includes(marker)) throw new Error('Admin remaining marker not found');
  a = a.replace(marker, helper + marker);
}

const oldUserTokens = "const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && !t.used).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));";
const newUserTokens = "const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && (() => { const e = tokenExpiry(t); return !!e && e.getTime() > Date.now(); })()).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));";
if (a.includes(oldUserTokens)) a = a.replace(oldUserTokens, newUserTokens);

const oldCreate = `  const createToken = async () => {\n    const u = selectedUser;\n    if (!u) return alert('Select a user first.');\n    const chosen = effectiveDurationFor(u);\n    const ms = durations.find(x => x[0] === chosen)?.[1];\n    if (!ms) return alert('No valid WilliToken duration is configured for this user.');\n    const t = token();\n    const expiresAt = new Date(Date.now() + ms);\n    try {\n      await setDoc(doc(db, 'williTokens', t), { token: t, userId: u.uid || u.id, username: u.username || '', categories: categoriesFor(u), duration: chosen, durationMs: ms, createdAt: serverTimestamp(), expiresAt, used: false });\n      setGenerated(t); setCopied(false); await load();\n    } catch { alert('Could not create the token.'); }\n  };`;
const newCreate = `  const createToken = async () => {\n    const u = selectedUser;\n    if (!u) return alert('Select a user first.');\n    const chosen = effectiveDurationFor(u);\n    const ms = chosen === 'custom' ? manualDurationMs(customDurationValue, customDurationUnit) : durations.find(x => x[0] === chosen)?.[1];\n    if (!ms) return alert('Enter a valid WilliToken duration greater than zero.');\n    const t = token();\n    const now = new Date();\n    const expiresAt = new Date(now.getTime() + ms);\n    const uid = u.uid || u.id;\n    try {\n      await setDoc(doc(db, 'williTokens', t), { token: t, userId: uid, username: u.username || '', categories: categoriesFor(u), duration: chosen === 'custom' ? (customDurationValue + ' ' + customDurationUnit) : chosen, durationMs: ms, createdAt: serverTimestamp(), issuedAt: now.toISOString(), expiresAt, used: false, active: true });\n      await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt: expiresAt.toISOString(), activatedAt: now.toISOString(), activeWilliToken: t });\n      setGenerated(t); setCopied(false); await load();\n    } catch (e: any) { alert(e?.code === 'permission-denied' ? 'Firebase denied the WilliToken operation. Publish the latest Firestore rules and try again.' : 'Could not create the token.'); }\n  };`;
if (a.includes(oldCreate)) a = a.replace(oldCreate, newCreate);
else if (!a.includes("activationStatus: 'active'")) throw new Error('Admin createToken marker not found');

// The previous admin repair added an "unused only" token centre. Make it a true active-token centre.
a = a.replace('Only unused, non-expired tokens are shown. Redeemed or expired records are removed automatically when Admin data loads.', 'Only active, non-expired WilliTokens are shown. Redeemed tokens remain active until their expiry, then are removed automatically.');
a = a.replace("tokens.filter(tokenIsActive)", "tokens.filter(t => tokenIsActive(t) && (() => { const e = tokenExpiry(t); return !!e && e.getTime() > Date.now(); })())");
a = a.replace("<p className=\"font-black text-emerald-300\">Unused · ready to activate</p>", "<p className=\"font-black text-emerald-300\">{t.used ? 'Assigned · active' : 'Unused · active'}</p>");

// Make the Admin's token helper consider an unexpired token active whether redeemed or not.
const oldTokenIsActive = `  const tokenIsActive = (t: WilliToken) => {\n    if (t.used) return false;\n    // Current WilliTokens use durationMs as the activation duration; the countdown starts when redeemed.\n    // Only legacy tokens without durationMs use expiresAt as a pre-redemption expiry.\n    if (typeof t.durationMs === 'number' && t.durationMs > 0) return true;\n    const exp = tokenExpiry(t);\n    return !exp || exp.getTime() > Date.now();\n  };`;
const newTokenIsActive = `  const tokenIsActive = (t: WilliToken) => {\n    const exp = tokenExpiry(t);\n    return !!exp && exp.getTime() > Date.now() && t.active !== false;\n  };`;
if (a.includes(oldTokenIsActive)) a = a.replace(oldTokenIsActive, newTokenIsActive);

// Clean expired token documents and deactivate affected accounts whenever Admin data loads.
const oldSetTokens = "      setTokens(t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken)));";
const newSetTokens = `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));\n      const expiredTokens = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= Date.now(); });\n      if (expiredTokens.length) await Promise.all(expiredTokens.map(x => deleteDoc(doc(db, 'williTokens', x.id))));\n      const expiredUserIds = [...new Set(expiredTokens.map(x => x.userId).filter(Boolean) as string[])];\n      if (expiredUserIds.length) await Promise.all(expiredUserIds.map(uid => updateDoc(doc(db, 'users', uid), { activated: false, activationStatus: 'inactive', activationActive: false, williTokenActive: false, activationExpiresAt: null, activeWilliToken: null }).catch(() => undefined)));\n      const expiredAccounts = u.docs.map(d => ({ id: d.id, ...d.data() } as User)).filter(x => x.activated === true && activationExpiryMs(x.activationExpiresAt) > 0 && activationExpiryMs(x.activationExpiresAt) <= Date.now());\n      if (expiredAccounts.length) await Promise.all(expiredAccounts.map(x => updateDoc(doc(db, 'users', x.uid || x.id), { activated: false, activationStatus: 'inactive', activationActive: false, williTokenActive: false, activationExpiresAt: null, activeWilliToken: null }).catch(() => undefined)));\n      const activeTokenDocs = allTokenDocs.filter(x => !expiredTokens.some(e => e.id === x.id) && tokenIsActive(x));\n      setTokens(activeTokenDocs);`;
if (a.includes(oldSetTokens)) a = a.replace(oldSetTokens, newSetTokens);
else if (!a.includes('const allTokenDocs')) throw new Error('Admin token loading marker not found');

// Show account state explicitly beside each user.
a = a.replace("<div className=\"text-right text-xs\"><div><span className=\"rounded-full bg-cyan-400/10 px-2.5 py-1 font-bold text-cyan-300\">{userBooks(uid).length} books</span></div>", "<div className=\"text-right text-xs\"><div className=\"mb-2\"><span className={userActivationIsActive(u) ? 'rounded-full bg-emerald-400/10 px-2.5 py-1 font-bold text-emerald-300' : 'rounded-full bg-slate-400/10 px-2.5 py-1 font-bold text-slate-400'}>{userActivationIsActive(u) ? 'Active account' : 'Inactive account'}</span></div><div><span className=\"rounded-full bg-cyan-400/10 px-2.5 py-1 font-bold text-cyan-300\">{userBooks(uid).length} books</span></div>");

fs.writeFileSync(admin, a);

// Activation redemption: do not restart a token's duration. Use the expiry assigned by Admin.
const activation = 'app/dashboard/activation/page.tsx';
let p = fs.readFileSync(activation, 'utf8');
const oldDurationBlock = `      // A token's selected duration is an activation duration, not a countdown\n      // that starts when the Admin generates it. Existing legacy tokens with an\n      // expiresAt field are still supported.\n      let activationExpiresAt: string;\n      if (typeof record.durationMs === 'number' && record.durationMs >= 30 * 60000) {\n        activationExpiresAt = new Date(Date.now() + record.durationMs).toISOString();\n      } else if (record.expiresAt) {\n        activationExpiresAt = record.expiresAt;\n        if (new Date(activationExpiresAt).getTime() <= Date.now()) { setTokenMessage('This older WilliToken has expired. Please ask the admin to generate a new one.'); return; }\n      } else { setTokenMessage('This WilliToken has no valid activation duration. Please ask the admin to generate a new token.'); return; }\n\n      await updateDoc(doc(db, 'users', uid), { activated: true, activationExpiresAt, activatedAt: new Date().toISOString() });\n      // Firestore rules require the redeemed token to be migrated to the current Firebase UID.\n      await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, username: currentUsername });`;
const newDurationBlock = `      // The Admin starts the countdown when the WilliToken is generated.\n      // Redemption only confirms ownership; it must never extend the activation period.\n      let activationExpiresAt = record.expiresAt || '';\n      if (!activationExpiresAt && typeof record.durationMs === 'number' && record.durationMs > 0) {\n        const created = record.createdAt && typeof (record.createdAt as any).toDate === 'function' ? (record.createdAt as any).toDate() : null;\n        if (created) activationExpiresAt = new Date(created.getTime() + record.durationMs).toISOString();\n      }\n      if (!activationExpiresAt || new Date(activationExpiresAt).getTime() <= Date.now()) { setTokenMessage('This WilliToken has expired. Please ask the admin to generate a new one.'); return; }\n\n      const activatedAt = new Date().toISOString();\n      await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activatedAt, activeWilliToken: clean });\n      await updateDoc(tokenRef, { used: true, usedAt: activatedAt, active: true, userId: uid, username: currentUsername, expiresAt: activationExpiresAt });`;
if (p.includes(oldDurationBlock)) p = p.replace(oldDurationBlock, newDurationBlock);
else if (!p.includes("activationStatus: 'active'")) throw new Error('Activation duration marker not found');
fs.writeFileSync(activation, p);

// AI: keep the existing account-record check, but also reconcile an expired activation immediately.
const ai = 'app/dashboard/ai/page.tsx';
let aiText = fs.readFileSync(ai, 'utf8');
if (!aiText.includes('const reconcileActivation')) {
  aiText = aiText.replace("import {doc,getDoc,setDoc,updateDoc} from 'firebase/firestore';", "import {collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc} from 'firebase/firestore';");
  const marker = "type Msg={role:'ai'|'user';text:string};";
  const helper = `async function reconcileActivation(uid:string,d:any){\n const now=Date.now();\n const direct=activeFromRecord(d);\n if(d.activationExpiresAt && expiryMs(d.activationExpiresAt)<=now){\n   await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);\n   return false;\n }\n try{\n   const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));\n   let active=false;\n   for(const item of snap.docs){\n     const x=item.data()||{};\n     const exp=expiryMs(x.expiresAt||x.activationExpiresAt||x.expiry);\n     if(exp>now&&x.active!==false){active=true;}\n     else if(exp&&exp<=now) await deleteDoc(item.ref).catch(()=>undefined);\n   }\n   if(active&&!direct) await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true}).catch(()=>undefined);\n   return direct||active;\n }catch{return direct;}\n}\n\n`;
  if (!aiText.includes(marker)) throw new Error('AI message type marker not found');
  aiText = aiText.replace(marker, helper + marker);
  const oldCheck = "const isActive=activeFromRecord(d);setActive(isActive);console.info('EDUWILLS AI activation check'";
  const newCheck = "const isActive=await reconcileActivation(u.uid,d);setActive(isActive);console.info('EDUWILLS AI activation check'";
  if (!aiText.includes(oldCheck)) throw new Error('AI activation check marker not found');
  aiText = aiText.replace(oldCheck,newCheck);
}
fs.writeFileSync(ai, aiText);

console.log('WilliToken lifecycle repaired: generated tokens activate accounts, redemption preserves expiry, expired tokens are removed, accounts become inactive, and EDUWILLS AI reconciles activation state.');
