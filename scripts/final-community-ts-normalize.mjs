import fs from 'node:fs';

const path='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(path,'utf8');

// Earlier community repair passes can each add the same state when they see a
// different marker. Normalize the final generated source to exactly one copy.
g=g.replace(/\n\s*const \[isMember,setIsMember\]=useState\(false\),\[joining,setJoining\]=useState\(false\)(?:,\[isLocked,setIsLocked\]=useState\(false\))?(?:,\[members,setMembers\]=useState<any\[\]>\(\[\]\))?;\n/g,'\n');

const stateMarker='[unread,setUnread]=useState(0);';
if(!g.includes('[isMember,setIsMember]')){
  if(!g.includes(stateMarker)) throw new Error('FINAL_GROUP_STATE_MARKER_NOT_FOUND');
  g=g.replace(stateMarker,stateMarker+'\n const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);');
} else {
  // If a prior pass left a partial canonical state, ensure the lock/member state
  // variables used by the community UI are present without creating duplicates.
  if(!g.includes('[isLocked,setIsLocked]')){
    g=g.replace('[isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),','[isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),');
  }
  if(!g.includes('[members,setMembers]=useState<any[]>([])')){
    const marker='[isLocked,setIsLocked]=useState(false),';
    if(g.includes(marker)) g=g.replace(marker,marker+'[members,setMembers]=useState<any[]>([]),');
  }
}

// Remove every one-line legacy joinGroup implementation, then keep one
// membership-safe implementation. This catches variants emitted by controls-v2.
g=g.replace(/\n\s*async function joinGroup\(\)\{[^\n]*\}\n/g,'\n');
const join=" async function joinGroup(){if(!user||!g||joining||isMember)return;setJoining(true);setNotice('');try{await updateDoc(doc(db,'communityGroups',id),{memberIds:arrayUnion(user.uid),updatedAt:serverTimestamp()});setIsMember(true);setG((x:any)=>({...x,memberIds:Array.from(new Set([...(Array.isArray(x?.memberIds)?x.memberIds:[]),user.uid]))}));setNotice('You joined this group.')}catch(e:any){setNotice(e?.message||'Could not join this group.')}finally{setJoining(false)}}\n";
if(!g.includes('async function joinGroup')){
  const marker=' async function acknowledge(){';
  if(!g.includes(marker)) throw new Error('FINAL_JOIN_MARKER_NOT_FOUND');
  g=g.replace(marker,join+marker);
}

// A prior v4/v6 pass can coexist with another member loader. Remove duplicate
// global one-line loaders while preserving the dedicated useEffect loader.
const loaderRegex=/\n\s*async function loadMembers\(ids:any\[\]\)\{[^\n]*\}\n/g;
g=g.replace(loaderRegex,'\n');
if(!g.includes('async function loadMembers')){
  const marker=' async function acknowledge(){';
  if(!g.includes(marker)) throw new Error('FINAL_MEMBER_MARKER_NOT_FOUND');
  const fn=" async function loadMembers(ids:any[]){const list=Array.isArray(ids)?[...new Set(ids.filter(Boolean))].slice(0,100):[];try{const rows=await Promise.all(list.map(async uid=>{try{const s=await getDoc(doc(db,'users',String(uid)));const d=s.data()||{};return {uid:String(uid),fullName:String(d.fullName||d.displayName||d.name||d.username||'Learner'),username:String(d.username||''),photoURL:String(d.photoURL||d.avatarUrl||d.profilePhotoURL||'')};}catch{return {uid:String(uid),fullName:'Learner',username:'',photoURL:''}}}));setMembers(rows);}catch{setMembers([])}}\n";
  g=g.replace(marker,fn+marker);
}

if(!g.includes('GROUP MEMBERS')) throw new Error('FINAL_GROUP_INFO_MISSING');
if(!g.includes('aria-label="Write a message"')) throw new Error('FINAL_GROUP_COMPOSER_MISSING');
fs.writeFileSync(path,g);
console.log('Final community TypeScript normalization passed.');
