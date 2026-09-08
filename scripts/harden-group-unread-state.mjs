import fs from 'fs';
const p='app/dashboard/community/group/page.tsx';
let s=fs.readFileSync(p,'utf8');
const badge=String.raw`{unread>0&&<span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[8px] font-black text-white">{unread>99?'99+':unread}</span>}`;
const first=s.indexOf(badge);
if(first>=0){
  const before=s.slice(0,first+badge.length);
  const after=s.slice(first+badge.length).split(badge).join('');
  s=before+after;
}
const marker="useEffect(()=>{if(!g||!user||!understood)return;return onSnapshot(doc(db,'communityGroups',id,'readState',user.uid),s=>{const d=s.data()||{};setUnread(Number(d.unread||0))})},[g?.id,understood,user?.uid]);";
const readEffect="useEffect(()=>{if(!g||!user||!understood)return;setDoc(doc(db,'communityGroups',id,'readState',user.uid),{unread:0,lastReadAt:serverTimestamp()},{merge:true}).catch(()=>{});setUnread(0)},[g?.id,understood,user?.uid]);";
if(s.includes(marker)&&!s.includes("setDoc(doc(db,'communityGroups',id,'readState',user.uid),{unread:0,lastReadAt:serverTimestamp()")) s=s.replace(marker,marker+'\n '+readEffect);
fs.writeFileSync(p,s);
console.log('Group unread/read-state hardening applied.');
