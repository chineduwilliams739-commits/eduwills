import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Several older build-time repair scripts target the same legacy marker. Normalize
// their output so repeated Pages builds can never create duplicate React state.
g=g.replace(/\n const \[isMember,setIsMember\]=useState\(false\),\[joining,setJoining\]=useState\(false\)(?:,\[isLocked,setIsLocked\]=useState\(false\))?;\n/g,'\n');
const stateMarker="[memberSearch,setMemberSearch]=useState(''),[reply,setReply]=useState<any>(null),[unread,setUnread]=useState(0);";
if(!g.includes('[isMember,setIsMember]')){
  if(!g.includes(stateMarker)) throw new Error('COMMUNITY_STATE_MARKER_MISSING');
  g=g.replace(stateMarker,stateMarker+"\n const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);");
} else if(!g.includes('[isLocked,setIsLocked]')){
  const marker='[isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),';
  g=g.replace(marker,marker+'[isLocked,setIsLocked]=useState(false),');
}

// Remove the exact legacy joinGroup implementation inserted by community-controls-v2;
// the current v6 implementation is retained.
const legacyJoin=" async function joinGroup(){if(!user||!g||joining||isMember)return;setJoining(true);try{await updateDoc(doc(db,'communityGroups',id),{memberIds:arrayUnion(user.uid),memberCount:(Array.isArray(g.memberIds)?g.memberIds.length:0)+1,updatedAt:serverTimestamp()});setIsMember(true);setNotice('You joined the group.')}catch(e:any){setNotice(e?.message||'Could not join this group.')}finally{setJoining(false)}}\n";
while(g.includes(legacyJoin)) g=g.replace(legacyJoin,'\n');

// If a duplicate loadMembers declaration was introduced by an earlier repair, keep
// the first declaration and remove the known v4/v6-compatible duplicate by exact body.
const memberFn=" async function loadMembers(ids:any[]){const list=Array.isArray(ids)?ids.filter(Boolean):[];try{const rows=await Promise.all(list.map(async uid=>{try{const s=await getDoc(doc(db,'users',String(uid)));const d=s.data()||{};return {uid:String(uid),fullName:String(d.fullName||d.displayName||d.name||d.username||'Learner'),username:String(d.username||''),photoURL:String(d.photoURL||d.avatarUrl||d.profilePhotoURL||'')};}catch{return {uid:String(uid),fullName:'Learner',username:'',photoURL:''}}}));setMembers(rows);}catch{setMembers([])}}\n";
while(g.indexOf(memberFn)!==g.lastIndexOf(memberFn)) g=g.replace(memberFn,'\n');

fs.writeFileSync(group,g);
console.log('Community build normalization completed.');
