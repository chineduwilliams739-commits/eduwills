import fs from 'node:fs';

const dashboard='app/dashboard/page.tsx';
const activation='app/dashboard/activation/page.tsx';
let d=fs.readFileSync(dashboard,'utf8');
d=d.replace("if(!s.exists()){await signOut(auth);window.location.replace(`${BASE}/login/`);return;}const d=s.data();", "if(!s.exists()){setName(u.displayName||'Learner');setActivated(false);setExpiry('');setLoading(false);return;}const d=s.data();");
d=d.replace("if(!identity){await signOut(auth);window.location.replace(`${BASE}/login/`);return;}", "if(!identity){setName(u.displayName||'Learner');} else {setName(identity);}");
d=d.replace("setName(identity);setCategory(activeCategory);", "setCategory(activeCategory);");
d=d.replace("}catch(e){console.error(e);await signOut(auth).catch(()=>undefined);window.location.replace(`${BASE}/login/`);}finally{setLoading(false)}}),[]);", "}catch(e){console.error(e);setName(auth.currentUser?.displayName||'Learner');setActivated(false);setExpiry('');}finally{setLoading(false)}}),[]);");
fs.writeFileSync(dashboard,d,'utf8');
// Support is provided by the single global floating ContactSupport control.
// Do not inject a second support box into the activation page.
let a=fs.readFileSync(activation,'utf8');
a=a.replace(/<ContactSupport\s+box\s*\/>/g, '');
fs.writeFileSync(activation,a,'utf8');
console.log('Repaired dashboard session handling and kept activation support to one control.');
