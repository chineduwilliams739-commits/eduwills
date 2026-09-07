import fs from 'node:fs';

const path='app/dashboard/community/page.tsx';
let s=fs.readFileSync(path,'utf8');

s=s.replace(
  "useEffect(()=>{if(!user||!activated)return onSnapshot(query(collection(db,'communityGroups'),where('visibility','==','public'),limit(50)),s=>setGroups(s.docs.map(d=>({id:d.id,...d.data()}))),()=>setGroups([]))},[user,activated]);",
  "useEffect(()=>{if(!user||!activated){setGroups([]);return;}return onSnapshot(query(collection(db,'communityGroups'),where('visibility','==','public'),limit(50)),s=>setGroups(s.docs.map(d=>({id:d.id,...d.data()}))),()=>setGroups([]))},[user,activated]);"
);
s=s.replace(
  "useEffect(()=>{if(!user||!activated)return onSnapshot(query(collection(db,'communityGroups'),where('memberIds','array-contains',user.uid),limit(50)),s=>setMyGroups(s.docs.map(d=>({id:d.id,...d.data()}))),()=>setMyGroups([]))},[user,activated]);",
  "useEffect(()=>{if(!user||!activated){setMyGroups([]);return;}return onSnapshot(query(collection(db,'communityGroups'),where('memberIds','array-contains',user.uid),limit(50)),s=>setMyGroups(s.docs.map(d=>({id:d.id,...d.data()}))),()=>setMyGroups([]))},[user,activated]);"
);

const oldCreate=/async function createGroup\(\)\{.*?\n async function join\(g:any\)/s;
const replacement=`async function createGroup(){guard(async()=>{if(!user||!groupName.trim())return;setCreating(true);try{const ref=await addDoc(collection(db,'communityGroups'),{name:groupName.trim(),description:groupDescription.trim(),ownerId:user.uid,adminIds:[user.uid],memberIds:[user.uid],visibility:'public',type:'study',creatorRulesAccepted:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});setGroupName('');setGroupDescription('');setGroupOpen(false);location.assign(\`${'${BASE}'}/dashboard/community/group/?id=\${ref.id}\`);}catch(e){setNotice(e?.message||'Could not create the group. Please try again.')}finally{setCreating(false)}})}
 async function join(g:any)`;
if(oldCreate.test(s)) s=s.replace(oldCreate,replacement);

fs.writeFileSync(path,s);
console.log('Community runtime source fixed.');
