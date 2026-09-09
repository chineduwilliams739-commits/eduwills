import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Ensure the group page can load member profiles.
g=g.replace("collection,doc,getDoc,onSnapshot", "collection,doc,getDoc,getDocs,onSnapshot");
if(!g.includes('getDocs')) throw new Error('GROUP_GETDOCS_IMPORT_FAILED');

// Add stable membership/member state if absent.
if(!g.includes('[isMember,setIsMember]')){
  const marker="[loading,setLoading]=useState(true),[understood,setUnderstood]=useState(false),";
  if(!g.includes(marker)) throw new Error('GROUP_STATE_MARKER_NOT_FOUND');
  g=g.replace(marker,marker+"[isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[members,setMembers]=useState<any[]>([]),");
}

// Derive membership from the live group document.
if(!g.includes('setIsMember(d.ownerId===')){
  const marker="setG(d);setName(d.name||'');setDesc(d.description||'');setAvatar(d.avatarUrl||'');setCover(d.coverImageUrl||'');";
  if(!g.includes(marker)) throw new Error('GROUP_DERIVE_MARKER_NOT_FOUND');
  g=g.replace(marker,"setG(d);setIsMember(d.ownerId===user.uid||d.adminIds?.includes(user.uid)||d.memberIds?.includes(user.uid));setName(d.name||'');setDesc(d.description||'');setAvatar(d.avatarUrl||'');setCover(d.coverImageUrl||'');
");
}

// Load all member profiles from users/{uid}; do not depend on member count only.
if(!g.includes('const loadMembers=async')){
  const marker=" const isAdmin=!!g?.adminIds?.includes(user?.uid),isOwner=g?.ownerId===user?.uid;";
  if(!g.includes(marker)) throw new Error('GROUP_ADMIN_MARKER_NOT_FOUND');
  const block=` const isAdmin=!!g?.adminIds?.includes(user?.uid),isOwner=g?.ownerId===user?.uid;
 useEffect(()=>{let cancelled=false;const loadMembers=async()=>{const ids=Array.isArray(g?.memberIds)?[...new Set(g.memberIds.filter(Boolean))].slice(0,100):[];if(!ids.length){setMembers([]);return}try{const rows=await Promise.all(ids.map(async(uid:string)=>{try{const s=await getDoc(doc(db,'users',uid));const d=s.data()||{};return {uid,fullName:d.fullName||d.displayName||d.name||d.username||'Learner',username:d.username||'',photoURL:d.photoURL||d.avatarUrl||d.profilePhotoURL||''}}catch{return {uid,fullName:'Learner',username:'',photoURL:''}}}));if(!cancelled)setMembers(rows)}catch{if(!cancelled)setMembers([])}};loadMembers();return()=>{cancelled=true}},[g?.id,g?.memberIds]);
`;
  g=g.replace(marker,block);
}

// Join action for users who are viewing a public/suggested group.
if(!g.includes('async function joinGroup(){')){
  const marker=' async function acknowledge(){';
  if(!g.includes(marker)) throw new Error('GROUP_ACK_MARKER_NOT_FOUND');
  const fn=` async function joinGroup(){if(!user||!g||joining)return;setJoining(true);setNotice('');try{await updateDoc(doc(db,'communityGroups',id),{memberIds:arrayUnion(user.uid),updatedAt:serverTimestamp()});setIsMember(true);setG((x:any)=>({...x,memberIds:Array.from(new Set([...(Array.isArray(x?.memberIds)?x.memberIds:[]),user.uid]))}));setNotice('You joined this group.')}catch(e:any){setNotice(e?.message||'Could not join this group.')}finally{setJoining(false)}}
`;
  g=g.replace(marker,fn+marker);
}

// Do not open message/read-state listeners until membership is confirmed.
g=g.replace("if(!g||!user||!understood)return;return onSnapshot(query(collection(db,'communityGroups',id,'messages')", "if(!g||!user||!understood||!isMember)return;return onSnapshot(query(collection(db,'communityGroups',id,'messages')");
g=g.replace("if(!g||!user||!understood)return;return onSnapshot(doc(db,'communityGroups',id,'readState'", "if(!g||!user||!understood||!isMember)return;return onSnapshot(doc(db,'communityGroups',id,'readState'");

// Put a real join gate before the owner-rules gate.
if(!g.includes('You must join this group before you can view or send messages.')){
  const marker=' if(!understood)return <main';
  if(!g.includes(marker)) throw new Error('GROUP_UNDERSTOOD_GATE_NOT_FOUND');
  const gate=` if(!isMember)return <main className="min-h-screen bg-paper p-5 text-ink"><div className="mx-auto max-w-xl"><a href={BASE+'/dashboard/community/'} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-black"><ArrowLeft size={17}/> Community</a><section className="mt-5 rounded-[2rem] bg-white p-8 text-center shadow-sm"><Users className="mx-auto text-cyan-600" size={42}/><h1 className="mt-4 text-2xl font-black">Join {g.name}</h1><p className="mt-2 text-sm leading-6 text-slate-500">You must join this group before you can view or send messages.</p><button type="button" onClick={joinGroup} disabled={joining} className="mt-5 rounded-xl bg-ink px-6 py-3 text-sm font-black text-white disabled:opacity-50">{joining?'Joining…':'JOIN GROUP'}</button></section></div></main>;
`;
  g=g.replace(marker,gate+marker);
}

// Remove duplicate unread badges from previously layered repairs.
const badgeRe=/<span className="ml-1 rounded-full bg-cyan-600 px-1\.5 py-0\.5 text-\[8px\] font-black text-white">\{unread>99\?'99\\+':unread\}<\/span>/g;
g=g.replace(badgeRe,(match,_offset,whole)=>match);
const badgeToken="{unread>0&&<span className=\"ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[8px] font-black text-white\">{unread>99?'99+':unread}</span>}";
while((g.match(new RegExp(badgeToken.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length>1){
  const first=g.indexOf(badgeToken);const next=g.indexOf(badgeToken,first+badgeToken.length);if(next<0)break;g=g.slice(0,next)+g.slice(next+badgeToken.length);
}

// Replace the group info surface with a guaranteed member list if the existing page has no member list.
if(!g.includes('GROUP MEMBERS')){
  const modal=`{info&&<div className="fixed inset-0 z-[80] bg-black/50 p-4" onClick={()=>setInfo(false)}><section className="mx-auto mt-10 max-h-[80vh] max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">GROUP MEMBERS</p><h2 className="mt-1 text-xl font-black">{g.name}</h2><p className="mt-1 text-xs text-slate-500">{members.length} member{members.length===1?'':'s'}</p></div><button type="button" onClick={()=>setInfo(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button></div><div className="mt-4 space-y-2">{members.length?members.map((m:any)=><div key={m.uid} className="flex items-center gap-3 rounded-2xl border p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-sm font-black text-white">{m.photoURL?<img src={m.photoURL} className="h-full w-full object-cover"/>:String(m.fullName||'L').charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black">{m.fullName}</p><p className="truncate text-xs text-slate-400">{m.username?'@'+m.username:'Member'}</p></div></div>):<p className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">No member profiles could be loaded.</p>}</div></section></div>}`;
  const pos=g.lastIndexOf('</main>');
  if(pos<0) throw new Error('GROUP_MAIN_END_NOT_FOUND');
  g=g.slice(0,pos)+modal+g.slice(pos);
}

fs.writeFileSync(group,g);

// Make the direct-chat search deterministic and explicit enough for mobile use.
const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username')) throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(!c.includes('const recentRows=useMemo(()=>[...chatRows]')){
  c=c.replace(/const recentRows=useMemo\(\(\)=>\[\.\.\.chatRows,\.\.\.groupRows\][^;]+;/, "const recentRows=useMemo(()=>[...chatRows].filter((c:any)=>Boolean(c.lastMessage||previews[\`chat:${c.id}\`])).sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,50),[chatRows,previews]);");
}
fs.writeFileSync(chat,c);
console.log('Community UI v6 applied.');
