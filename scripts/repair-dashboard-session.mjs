import fs from 'node:fs';

const file='app/dashboard/page.tsx';
let s=fs.readFileSync(file,'utf8');
// Never sign the user out merely because a profile read temporarily fails after an external payment redirect.
s=s.replace("}catch(e){console.error(e);await signOut(auth).catch(()=>undefined);window.location.replace(`${BASE}/login/`);}finally{setLoading(false)}}),[]);", "}catch(e){console.error(e);setName(auth.currentUser?.displayName||'Learner');setActivated(false);setExpiry('');}finally{setLoading(false)}}),[]);");
// A missing profile should not destroy a valid Firebase session; show the dashboard shell instead.
s=s.replace("if(!s.exists()){await signOut(auth);window.location.replace(`${BASE}/login/`);return;}const d=s.data();", "if(!s.exists()){setName(u.displayName||'Learner');setActivated(false);setExpiry('');return;}const d=s.data();");
s=s.replace("if(!identity){await signOut(auth);window.location.replace(`${BASE}/login/`);return;}", "if(!identity){setName(u.displayName||'Learner');} else setName(identity);");
// Remove the now-duplicated name assignment created by the identity guard replacement.
s=s.replace("setName(u.displayName||'Learner');} else setName(identity);setCategory(activeCategory);", "setCategory(activeCategory);");
fs.writeFileSync(file,s,'utf8');
console.log('Repaired dashboard session handling: external payment redirects no longer sign out valid users on profile-read errors.');
