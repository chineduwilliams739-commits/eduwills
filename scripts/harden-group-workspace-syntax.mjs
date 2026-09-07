import fs from 'node:fs';
const path='app/dashboard/community/group/page.tsx';
let s=fs.readFileSync(path,'utf8');
const broken="setUnderstood(d.creatorRulesAccepted===true||d.ownerId!==user.uid)},[id,user?.uid]);";
const fixed="setUnderstood(d.creatorRulesAccepted===true||d.ownerId!==user.uid);},[id,user?.uid]);";
if(s.includes(broken)) s=s.replace(broken,fixed);
// Remove accidental duplicate unread badges from an earlier generated workspace revision.
const badge="{unread>0&&<span className=\"ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[8px] font-black text-white\">{unread>99?'99+':unread}</span>}";
s=s.replaceAll(badge+badge+badge,badge);
fs.writeFileSync(path,s);
console.log('Group workspace syntax and duplicate badge hardening completed safely.');
