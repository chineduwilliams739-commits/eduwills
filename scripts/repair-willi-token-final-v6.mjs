import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }

// ---------------------------------------------------------------------------
// 1. Activation: redeeming a token must make the SAME user record active and
// preserve the activation expiry. The token remains a live record until that
// expiry, regardless of used=true.
// ---------------------------------------------------------------------------
const activationPath = 'app/dashboard/activation/page.tsx';
let activation = read(activationPath);
activation = activation.replace(
  "await updateDoc(doc(db, 'users', uid), { activated: true, activationExpiresAt, activatedAt: new Date().toISOString() });",
  "await updateDoc(doc(db, 'users', uid), { activated: true, activationStatus: 'active', activationActive: true, williTokenActive: true, activationExpiresAt, activatedAt: new Date().toISOString(), activeWilliToken: clean });"
);
activation = activation.replace(
  "await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, username: currentUsername });",
  "await updateDoc(tokenRef, { used: true, usedAt: new Date().toISOString(), userId: uid, username: currentUsername, status: 'active', active: true, activationExpiresAt, expiresAt: activationExpiresAt });"
);
write(activationPath, activation);

// ---------------------------------------------------------------------------
// 2. EDUWILLS AI: only a redeemed, non-expired token OR a valid current
// activation record can unlock AI. Expired token documents are deleted.
// ---------------------------------------------------------------------------
const aiPath = 'app/dashboard/ai/page.tsx';
let ai = read(aiPath);
ai = ai.replace(/async function reconcileActivation\(uid:string,d:any\)\{[\s\S]*?\n\}\ntype Msg=/, `async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 let redeemedActive=false;
 let latestExpiry=0;
 let latestToken='';
 try{
  const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
  for(const item of snap.docs){
   const x=item.data()||{};
   const exp=expiryMs(x.activationExpiresAt||x.expiresAt||x.expiry);
   if(exp>0&&exp<=now){ await deleteDoc(item.ref).catch(()=>undefined); continue; }
   if(exp>now&&x.used===true&&x.revoked!==true&&x.cancelled!==true){
    redeemedActive=true;
    if(exp>latestExpiry){latestExpiry=exp;latestToken=x.token||item.id;}
   }
  }
 }catch(e){console.warn('EDUWILLS token reconciliation failed',e);}
 const directExpiry=expiryMs(d.activationExpiresAt);
 const directActive=(d.activated===true||d.activationStatus==='active'||d.activationActive===true||d.williTokenActive===true||d.isActive===true)&&(!directExpiry||directExpiry>now);
 const active=redeemedActive||directActive;
 if(active){
  const patch:any={activated:true,activationStatus:'active',activationActive:true,williTokenActive:true};
  if(latestExpiry)patch.activationExpiresAt=new Date(latestExpiry).toISOString();
  if(latestToken)patch.activeWilliToken=latestToken;
  await updateDoc(doc(db,'users',uid),patch).catch(()=>undefined);
 }else if(d.activated===true||d.activationStatus==='active'||d.activationActive===true||d.williTokenActive===true){
  await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
 }
 return active;
}
type Msg=`);
write(aiPath, ai);

// ---------------------------------------------------------------------------
// 3. Admin: restore a reliable custom duration input and make Active Token
// Expiry include BOTH unused and redeemed live tokens.
// ---------------------------------------------------------------------------
const adminPath = 'app/admin/page.tsx';
let admin = read(adminPath);

if (!admin.includes("customDurationValue")) {
  admin = admin.replace(
    "const [duration, setDuration] = useState('30 days');",
    "const [duration, setDuration] = useState('30 days');\n  const [customDurationValue, setCustomDurationValue] = useState('30');\n  const [customDurationUnit, setCustomDurationUnit] = useState<'minutes'|'hours'|'days'>('days');"
  );
}
if (!admin.includes('function manualDurationMs(')) {
  const marker = 'function remaining(date: Date | null) {';
  const helper = "function manualDurationMs(value: string, unit: 'minutes'|'hours'|'days') { const n = Number(value); if (!Number.isFinite(n) || n <= 0) return 0; return Math.round(n * (unit === 'minutes' ? 60000 : unit === 'hours' ? 3600000 : 86400000)); }\n\n";
  if (!admin.includes(marker)) throw new Error('Admin duration marker missing');
  admin = admin.replace(marker, helper + marker);
}

// Make custom duration a true override of category policy.
admin = admin.replace(
  "const chosen = effectiveDurationFor(u);\n    const ms = durations.find(x => x[0] === chosen)?.[1];",
  "const chosen = duration === 'custom' ? 'custom' : effectiveDurationFor(u);\n    const ms = chosen === 'custom' ? manualDurationMs(customDurationValue, customDurationUnit) : durations.find(x => x[0] === chosen)?.[1];"
);
admin = admin.replace(
  "if (!ms) return alert('No valid WilliToken duration is configured for this user.');",
  "if (!ms) return alert('Enter a valid custom WilliToken duration greater than zero.');"
);

// Make generated expiry represent the token's own validity. Redemption later
// changes activationExpiresAt/expiresAt to start the activation countdown.
admin = admin.replace(
  /const createToken = async \(\) => \{[\s\S]*?\n  \};\n\n(?=  const removeBook)/,
  `const createToken = async () => {
    const u = selectedUser;
    if (!u) return alert('Select a user first.');
    const chosen = duration === 'custom' ? 'custom' : effectiveDurationFor(u);
    const ms = chosen === 'custom' ? manualDurationMs(customDurationValue, customDurationUnit) : durations.find(x => x[0] === chosen)?.[1];
    if (!ms) return alert('Enter a valid custom WilliToken duration greater than zero.');
    const t = token();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ms);
    try {
      await setDoc(doc(db, 'williTokens', t), { token: t, userId: u.uid || u.id, username: u.username || '', categories: categoriesFor(u), duration: chosen === 'custom' ? \\`${customDurationValue} ${customDurationUnit}\\` : chosen, durationMs: ms, createdAt: serverTimestamp(), issuedAt: now.toISOString(), expiresAt, used: false, active: true, status: 'issued' });
      setGenerated(t); setCopied(false); await load();
    } catch (e: any) { alert(e?.code === 'permission-denied' ? 'Firebase denied the WilliToken operation. Publish the latest Firestore rules and try again.' : 'Could not create the token.'); }
  };

`);

// Replace userTokens so redeemed live tokens remain visible.
admin = admin.replace(
  /const userTokens = \(uid: string\) => .*?;/,
  "const userTokens = (uid: string) => tokens.filter(t => t.userId === uid && (() => { const e = tokenExpiry(t); return !!e && e.getTime() > Date.now(); })()).sort((a, b) => (tokenExpiry(b)?.getTime() || 0) - (tokenExpiry(a)?.getTime() || 0));"
);

// Replace the token-loading assignment with live-token cleanup while retaining
// used=true records until their expiry.
const loadOld = /setTokens\(t\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \} as WilliToken\)\);/;
if (loadOld.test(admin)) {
  admin = admin.replace(loadOld, `const allTokenDocs = t.docs.map(d => ({ id: d.id, ...d.data() } as WilliToken));
      const expiredTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() <= Date.now(); });
      if (expiredTokenDocs.length) await Promise.all(expiredTokenDocs.map(x => deleteDoc(doc(db, 'williTokens', x.id)).catch(() => undefined)));
      const liveTokenDocs = allTokenDocs.filter(x => { const e = tokenExpiry(x); return !!e && e.getTime() > Date.now(); });
      setTokens(liveTokenDocs);`);
}

// Replace the custom-duration UI if the earlier repair removed it.
if (!admin.includes('Custom duration…')) {
  const oldUI = '<select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold">{durations.map(x => <option key={x[0]} value={x[0]}>{x[0]}</option>)}</select><button onClick={createToken}';
  const newUI = '<div className="grid gap-2"><select value={duration} onChange={e => setDuration(e.target.value)} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold">{durations.map(x => <option key={x[0]} value={x[0]}>{x[0]}</option>)}<option value="custom">Custom duration…</option></select>{duration === \'custom\' && <div className="grid grid-cols-2 gap-2"><input type="number" min="1" step="1" value={customDurationValue} onChange={e => setCustomDurationValue(e.target.value)} placeholder="Amount" className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold"/><select value={customDurationUnit} onChange={e => setCustomDurationUnit(e.target.value as \'minutes\'|\'hours\'|\'days\')} className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm font-bold"><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div>}</div><button onClick={createToken}';
  if (!admin.includes(oldUI)) throw new Error('Admin WilliToken duration UI marker missing');
  admin = admin.replace(oldUI, newUI);
}

// Ensure the revoke handler exists because the active-token UI uses it.
if (!admin.includes('const revokeToken = async')) {
  const marker = '  const removeBook = async (book: Slot) => {';
  if (!admin.includes(marker)) throw new Error('Admin removeBook marker missing');
  admin = admin.replace(marker, `  const revokeToken = async (t: WilliToken) => {\n    if (!window.confirm(\\`Revoke WilliToken \\\${t.token || t.id}?\\n\\nThis permanently removes the token.\\`)) return;\n    try { await deleteDoc(doc(db, 'williTokens', t.id)); setTokens(v => v.filter(x => x.id !== t.id)); }\n    catch (e: any) { alert(e?.code === 'permission-denied' ? 'Only an authenticated Admin can revoke WilliTokens.' : 'Could not revoke this WilliToken.'); }\n  };\n\n` + marker);
}

// Update misleading active-token text and show redeemed state.
admin = admin.replace('Only unused, non-expired tokens are shown. Redeemed or expired records are removed automatically when Admin data loads.', 'All non-expired generated tokens are shown. Redeemed tokens remain active until their activation expiry; expired records are removed automatically.');
admin = admin.replace('<p className="font-black text-emerald-300">Unused · ready to activate</p>', '<p className="font-black text-emerald-300">{t.used ? \'Redeemed · ACTIVE\' : \'Unused · ready to activate\'}</p>');

write(adminPath, admin);
console.log('WilliToken final v6 applied: activation unlock, custom duration, live token retention and expiry cleanup fixed.');
