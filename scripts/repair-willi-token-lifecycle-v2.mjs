import fs from 'node:fs';

// This repair runs after repair-quiz-admin-latest.mjs, so it patches the latest
// Admin source instead of relying on older token-duration markers.

const admin = 'app/admin/page.tsx';
let a = fs.readFileSync(admin, 'utf8');

if (!a.includes('function activationExpiryMs')) {
  const marker = 'function remaining(date: Date | null) {';
  const helper = `function activationExpiryMs(value: any) {\n  if (!value) return 0;\n  if (typeof value.toMillis === 'function') return value.toMillis();\n  if (value?.seconds) return Number(value.seconds) * 1000;\n  const n = Date.parse(String(value));\n  return Number.isFinite(n) ? n : 0;\n}\n\nfunction userActivationIsActive(user: User) {\n  const exp = activationExpiryMs(user.activationExpiresAt);\n  return user.activated === true && (!exp || exp > Date.now());\n}\n\n`;
  if (!a.includes(marker)) throw new Error('Admin remaining marker not found');
  a = a.replace(marker, helper + marker);
}

// Active means unexpired, regardless of whether the token has been redeemed.
const tokenActiveRegex = /  const tokenIsActive = \(t: WilliToken\) => \{[\s\S]*?\n  \};/;
if (tokenActiveRegex.test(a)) {
  a = a.replace(tokenActiveRegex, `  const tokenIsActive = (t: WilliToken) => {\n    const exp = tokenExpiry(t);\n    return !!exp && exp.getTime() > Date.now() && t.active !== false;\n  };`);
}

const userTokensRegex = /  const userTokens = \(uid: string\) => .*?;/;
if (userTokensRegex.test(a)) {
  a = a.replace(userTokensRegex, "  const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && (() => { const e = tokenExpiry(t); return !!e && e.getTime() > Date.now(); })()).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));");
}

// Replace the complete token generator so generation immediately activates the account
// and fixes the expiry timestamp for both Admin and learner views.
const createStart = a.indexOf('  const createToken = async () => {');
const removeStart = a.indexOf('  const removeBook = async', createStart);
if (createStart < 0 || removeStart < 0) throw new Error('Admin createToken/removeBook markers not found');
const createBlock = `  const createToken = async () => {\n    const u = selectedUser;\n    if (!u) return alert('Select a user first.');\n    const chosen = effectiveDurationFor(u);\n    const ms = chosen === 'custom' ? manualDurationMs(customDurationValue, customDurationUnit) : durations.find(x => x[0] === chosen)?.[1];\n    if (!ms) return alert('Enter a valid manual WilliToken duration greater than zero.');\n    const t = token();\n    const now = new Date();\n    const expiresAt = new Date(now.getTime() + ms);\n    const uid = u.uid || u.id;\n    try {\n      await setDoc(doc(db, 'williTokens', t), { token: t, userId: uid, username: u.username || '', categories: categoriesFor(u), duration: chosen === 'custom' ? (customDurationValue + ' ' + customDurationUnit) : chosen, durationMs: ms, createdAt: serverTimestamp(), issuedAt: now.toISOString(), expiresAt, used: false, active: true });\n      await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt: expiresAt.toISOString(), activatedAt: now.toISOString(), activeWilliToken: t });\n      setGenerated(t); setCopied(false); await load();\n    } catch (e: any) { alert(e?.code === 'permission-denied' ? 'Firebase denied the WilliToken operation. Publish the latest Firestore rules and try again.' : 'Could not create the token.'); }\n  };\n\n`;
a = a.slice(0, createStart) + createBlock + a.slice(removeStart);

// Replace the latest admin-load token cleanup with authoritative expiry cleanup.
const activeLoadRegex = /      const activeTokenDocs = t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\);[\s\S]*?      if \(p\.exists\(\)\)/;
if (activeLoadRegex.test(a)) {
  const loadBlock = `      const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));\n      const expiredTokens = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= Date.now(); });\n      if (expiredTokens.length) await Promise.all(expiredTokens.map(x => deleteDoc(doc(db, 'williTokens', x.id))));\n      const expiredUserIds = [...new Set(expiredTokens.map(x => x.userId).filter(Boolean))];\n      if (expiredUserIds.length) await Promise.all(expiredUserIds.map(uid => updateDoc(doc(db, 'users', uid), { activated: false, activationStatus: 'inactive', activationActive: false, williTokenActive: false, activationExpiresAt: null, activeWilliToken: null }).catch(() => undefined)));\n      const loadedUsers = u.docs.map(d => ({ id: d.id, ...d.data() } as User));\n      const expiredAccounts = loadedUsers.filter(x => x.activated === true && activationExpiryMs(x.activationExpiresAt) > 0 && activationExpiryMs(x.activationExpiresAt) <= Date.now());\n      if (expiredAccounts.length) await Promise.all(expiredAccounts.map(x => updateDoc(doc(db, 'users', x.uid || x.id), { activated: false, activationStatus: 'inactive', activationActive: false, williTokenActive: false, activationExpiresAt: null, activeWilliToken: null }).catch(() => undefined)));\n      const activeTokenDocs = allTokenDocs.filter(x => !expiredTokens.some(e => e.id === x.id) && tokenIsActive(x));\n      setTokens(activeTokenDocs);\n      if (p.exists())`;
  a = a.replace(activeLoadRegex, loadBlock);
} else if (!a.includes('const allTokenDocs =')) {
  throw new Error('Admin token loading block not found');
}

// Make the user list visibly distinguish active/inactive accounts.
a = a.replace("<div className=\"text-right text-xs\"><div><span className=\"rounded-full bg-cyan-400/10 px-2.5 py-1 font-bold text-cyan-300\">{userBooks(uid).length} books</span></div>", "<div className=\"text-right text-xs\"><div className=\"mb-2\"><span className={userActivationIsActive(u) ? 'rounded-full bg-emerald-400/10 px-2.5 py-1 font-bold text-emerald-300' : 'rounded-full bg-slate-400/10 px-2.5 py-1 font-bold text-slate-400'}>{userActivationIsActive(u) ? 'Active account' : 'Inactive account'}</span></div><div><span className=\"rounded-full bg-cyan-400/10 px-2.5 py-1 font-bold text-cyan-300\">{userBooks(uid).length} books</span></div>");
a = a.replace('Only unused, non-expired tokens are shown. Redeemed or expired records are removed automatically when Admin data loads.', 'Only active, non-expired WilliTokens are shown. Redeemed tokens remain active until their expiry, then are removed automatically.');
a = a.replace("<p className=\"font-black text-emerald-300\">Unused · ready to activate</p>", "<p className=\"font-black text-emerald-300\">{t.used ? 'Assigned · active' : 'Unused · active'}</p>");
a = a.replace("tokens.filter(tokenIsActive)", "tokens.filter(t => tokenIsActive(t))");
fs.writeFileSync(admin, a);

// Redemption must preserve the expiry assigned at generation. It never restarts the timer.
const activation = 'app/dashboard/activation/page.tsx';
let p = fs.readFileSync(activation, 'utf8');
const activationStart = p.indexOf('      // A token\'s selected duration');
const activationEnd = p.indexOf("      await updateDoc(tokenRef,", activationStart);
if (activationStart >= 0 && activationEnd >= 0) {
  const endLine = p.indexOf('\n', activationEnd);
  const block = `      // The Admin starts the countdown when the WilliToken is generated.\n      // Redemption only confirms ownership; it never extends the activation period.\n      let activationExpiresAt = record.expiresAt || '';\n      if (!activationExpiresAt && typeof record.durationMs === 'number' && record.durationMs > 0) {\n        const created = record.createdAt && typeof record.createdAt.toDate === 'function' ? record.createdAt.toDate() : null;\n        if (created) activationExpiresAt = new Date(created.getTime() + record.durationMs).toISOString();\n      }\n      if (!activationExpiresAt || new Date(activationExpiresAt).getTime() <= Date.now()) { setTokenMessage('This WilliToken has expired. Please ask the admin to generate a new one.'); return; }\n\n      const activatedAt = new Date().toISOString();\n      await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activatedAt, activeWilliToken: clean });\n      await updateDoc(tokenRef, { used: true, usedAt: activatedAt, active: true, userId: uid, username: currentUsername, expiresAt: activationExpiresAt });`;
  p = p.slice(0, activationStart) + block + p.slice(endLine >= 0 ? endLine + 1 : activationEnd);
} else if (!p.includes("activationStatus: 'active'")) {
  throw new Error('Activation duration block not found');
}
fs.writeFileSync(activation, p);

// EDUWILLS AI also reconciles the user record with active token documents and cleans expired ones.
const ai = 'app/dashboard/ai/page.tsx';
let aiText = fs.readFileSync(ai, 'utf8');
if (!aiText.includes('reconcileActivation')) {
  aiText = aiText.replace("import {doc,getDoc,setDoc,updateDoc} from 'firebase/firestore';", "import {collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc} from 'firebase/firestore';");
  const marker = "type Msg={role:'ai'|'user';text:string};";
  const helper = `async function reconcileActivation(uid:string,d:any){\n const now=Date.now();\n const direct=activeFromRecord(d);\n if(d.activationExpiresAt && expiryMs(d.activationExpiresAt)<=now){\n   await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);\n   return false;\n }\n try{\n   const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));\n   let active=false;\n   for(const item of snap.docs){\n     const x=item.data()||{};\n     const exp=expiryMs(x.expiresAt||x.activationExpiresAt||x.expiry);\n     if(exp>now&&x.active!==false){active=true;}\n     else if(exp&&exp<=now) await deleteDoc(item.ref).catch(()=>undefined);\n   }\n   if(active&&!direct) await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true}).catch(()=>undefined);\n   return direct||active;\n }catch{return direct;}\n}\n\n`;
  if (!aiText.includes(marker)) throw new Error('AI message type marker not found');
  aiText = aiText.replace(marker, helper + marker);
  const oldCheck = "const isActive=activeFromRecord(d);setActive(isActive);console.info('EDUWILLS AI activation check'";
  if (!aiText.includes(oldCheck)) throw new Error('AI activation check marker not found');
  aiText = aiText.replace(oldCheck, "const isActive=await reconcileActivation(u.uid,d);setActive(isActive);console.info('EDUWILLS AI activation check'");
}
fs.writeFileSync(ai, aiText);

console.log('WilliToken lifecycle v2 applied: generated tokens activate accounts, redemption preserves expiry, expired tokens are deleted, expired accounts become inactive, and EDUWILLS AI reconciles activation state.');
