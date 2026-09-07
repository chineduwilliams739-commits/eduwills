import fs from 'node:fs';

const path='app/dashboard/community/page.tsx';
let source=fs.readFileSync(path,'utf8');
const old=/async function createGroup\(\)\{.*?\n async function join\(g:any\)/s;
const replacement=`async function createGroup(){guard(async()=>{if(!user||!groupName.trim())return;setCreating(true);try{const ref=await addDoc(collection(db,'communityGroups'),{name:groupName.trim(),description:groupDescription.trim(),ownerId:user.uid,adminIds:[user.uid],memberIds:[user.uid],visibility:'public',type:'study',creatorRulesAccepted:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});setGroupName('');setGroupDescription('');setGroupOpen(false);location.assign(\`${'${BASE}'}/dashboard/community/group/?id=\${ref.id}\`);}catch(e:any){setNotice(e?.message||'Could not create the group. Please try again.')}finally{setCreating(false)}})}\n async function join(g:any)`;
if(!old.test(source))throw new Error('Community createGroup function pattern not found.');
source=source.replace(old,replacement);
fs.writeFileSync(path,source);
console.log('Community group creation hardening applied.');

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');
g=g.replace("const d={id:s.id,...s.data()};", "const d={id:s.id,...(s.data() as any)};");
g=g.replace("async function promote(uid:string){if(!isOwner||uid===user.uid)return;", "async function promote(uid:string){if(!isAdmin||uid===user.uid)return;");
g=g.replace("{isOwner&&uid!==user.uid&&uid!==group.ownerId&&!(group.adminIds||[]).includes(uid)&&<button onClick={()=>promote(uid)}", "{isAdmin&&uid!==user.uid&&uid!==group.ownerId&&!(group.adminIds||[]).includes(uid)&&<button onClick={()=>promote(uid)}");
fs.writeFileSync(group,g);
console.log('Community admins can promote additional admins and group snapshot data is explicitly typed.');
