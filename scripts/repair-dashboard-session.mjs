import fs from 'node:fs';

const dashboard='app/dashboard/page.tsx';
const activation='app/dashboard/activation/page.tsx';
let d=fs.readFileSync(dashboard,'utf8');
d=d.replace("if(!s.exists()){await signOut(auth);window.location.replace(`${BASE}/login/`);return;}const d=s.data();", "if(!s.exists()){setName(u.displayName||'Learner');setActivated(false);setExpiry('');setLoading(false);return;}const d=s.data();");
d=d.replace("if(!identity){await signOut(auth);window.location.replace(`${BASE}/login/`);return;}", "if(!identity){setName(u.displayName||'Learner');} else {setName(identity);}");
d=d.replace("setName(identity);setCategory(activeCategory);", "setCategory(activeCategory);");
d=d.replace("}catch(e){console.error(e);await signOut(auth).catch(()=>undefined);window.location.replace(`${BASE}/login/`);}finally{setLoading(false)}}),[]);", "}catch(e){console.error(e);setName(auth.currentUser?.displayName||'Learner');setActivated(false);setExpiry('');}finally{setLoading(false)}}),[]);");
fs.writeFileSync(dashboard,d,'utf8');
let a=fs.readFileSync(activation,'utf8');
const box='<ContactSupport box />';
const lastMain=a.lastIndexOf('</main>');
if(lastMain>=0){const before=a.slice(0,lastMain);const normalEnd=before.lastIndexOf('Continue to secure Paystack payment');if(normalEnd>=0&&!before.slice(normalEnd).includes(box))a=a.slice(0,lastMain)+box+a.slice(lastMain);}
fs.writeFileSync(activation,a,'utf8');
console.log('Repaired dashboard session handling and ensured the activation page has a separate WhatsApp support box.');
