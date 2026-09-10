import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// This script is the final community normalizer. Earlier repair scripts may have
// changed formatting or inserted state/helpers in different places, so normalization
// must not depend on one exact source marker.
const removeAll=(re)=>{g=g.replace(re,'');};

// Remove standalone declarations and comma-fragment declarations for every state
// owned by this final normalizer, regardless of whitespace/line placement.
removeAll(/\s*const\s*\[isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\(false\)\s*;?/g);
removeAll(/\s*const\s*\[joining\s*,\s*setJoining\s*\]\s*=\s*useState\(false\)\s*;?/g);
removeAll(/\s*const\s*\[isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\(false\)\s*;?/g);
removeAll(/\s*const\s*\[members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\(\[\]\)\s*;?/g);
removeAll(/,?\s*\[isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\(false\)/g);
removeAll(/,?\s*\[joining\s*,\s*setJoining\s*\]\s*=\s*useState\(false\)/g);
removeAll(/,?\s*\[isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\(false\)/g);
removeAll(/,?\s*\[members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\(\[\]\)/g);

// Remove every duplicate helper implementation with brace-aware scanning.
// Match the function name first, then locate its opening brace. This handles both
// zero-argument helpers and parameterized helpers such as loadMembers(ids:any[]).
function removeAllFunctions(source,name){
  const signature=new RegExp(`async\\s+function\\s+${name}\\s*\\(`,'g');
  let match=signature.exec(source);
  while(match){
    const first=match.index;
    let brace=source.indexOf('{',signature.lastIndex);
    if(brace<0)throw new Error(`MISSING_${name.toUpperCase()}_FUNCTION_BRACE`);
    let pos=brace+1,depth=1,quote='';
    for(;pos<source.length;pos++){
      const ch=source[pos],prev=source[pos-1];
      if(quote){if(ch===quote&&prev!=='\\\\')quote='';continue;}
      if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
      if(ch==='{')depth++;
      else if(ch==='}'){
        depth--;
        if(depth===0){pos++;break;}
      }
    }
    if(depth!==0)throw new Error(`UNBALANCED_${name.toUpperCase()}_FUNCTION`);
    source=source.slice(0,first)+source.slice(pos);
    signature.lastIndex=0;
    match=signature.exec(source);
  }
  return source;
}

g=removeAllFunctions(g,'joinGroup');
g=removeAllFunctions(g,'loadMembers');

// Insert exactly one canonical state declaration after the existing group state
// declaration. This fallback deliberately does not depend on memberSearch formatting.
const stateAnchor=/([\[\s,]reply\s*,\s*setReply\s*\]\s*=\s*useState<any>\(null\)\s*,\s*\[unread\s*,\s*setUnread\s*\]\s*=\s*useState\(0\)\s*;)/;
const canonicalState='\n const [isMember,setIsMember]=useState(false);\n const [joining,setJoining]=useState(false);\n const [isLocked,setIsLocked]=useState(false);\n const [members,setMembers]=useState<any[]>([]);';
if(!stateAnchor.test(g))throw new Error('GROUP_STATE_ANCHOR_NOT_FOUND');
g=g.replace(stateAnchor,m=>m+canonicalState);

// The live group snapshot must derive membership/lock and load member profiles.
if(!g.includes('setIsMember(d.ownerId===user.uid||d.adminIds?.includes(user.uid)||d.memberIds?.includes(user.uid))')){
  const marker='setG(d);';
  if(!g.includes(marker))throw new Error('GROUP_DOCUMENT_STATE_MARKER_NOT_FOUND');
  g=g.replace(marker,marker+'setIsMember(d.ownerId===user.uid||d.adminIds?.includes(user.uid)||d.memberIds?.includes(user.uid));');
}
if(!g.includes('setIsLocked(d.messagingLocked===true)')){
  const marker='setIsMember(d.ownerId===user.uid||d.adminIds?.includes(user.uid)||d.memberIds?.includes(user.uid));';
  g=g.replace(marker,marker+'setIsLocked(d.messagingLocked===true);');
}

// Remove the redundant runtime-v4 local member loader effect, if present.
g=g.replace(/\s*useEffect\(\(\)=>\{let cancelled=false;const loadMembers=async\(\)=>\{[\s\S]*?\};loadMembers\(\);return\(\)=>\{cancelled=true\}\},\[g\?\.id,g\?\.memberIds\]\);/g,'');

// Insert canonical helpers before acknowledge().
const ackMarker=' async function acknowledge(){';
if(!g.includes(ackMarker))throw new Error('GROUP_ACK_MARKER_NOT_FOUND');
const helpers=` async function loadMembers(ids:any[]){const list=Array.isArray(ids)?[...new Set(ids.filter(Boolean))].slice(0,100):[];try{const rows=await Promise.all(list.map(async uid=>{try{const s=await getDoc(doc(db,'users',String(uid)));const d=s.data()||{};return {uid:String(uid),fullName:String(d.fullName||d.displayName||d.name||d.username||'Learner'),username:String(d.username||''),photoURL:String(d.photoURL||d.avatarUrl||d.profilePhotoURL||'')}}catch{return {uid:String(uid),fullName:'Learner',username:'',photoURL:''}}}));setMembers(rows)}catch{setMembers([])}}\n async function joinGroup(){if(!user||!g||joining||isMember)return;setJoining(true);setNotice('');try{await updateDoc(doc(db,'communityGroups',id),{memberIds:arrayUnion(user.uid),updatedAt:serverTimestamp()});setIsMember(true);setG((x:any)=>({...x,memberIds:Array.from(new Set([...(Array.isArray(x?.memberIds)?x.memberIds:[]),user.uid]))}));setNotice('You joined this group.')}catch(e:any){setNotice(e?.message||'Could not join this group.')}finally{setJoining(false)}}\n`;
g=g.replace(ackMarker,helpers+ackMarker);

// Ensure the live snapshot refreshes member profiles.
if(!g.includes('loadMembers(d.memberIds||[])')){
  const marker='setG(d);';
  if(g.includes(marker))g=g.replace(marker,marker+'loadMembers(d.memberIds||[]);');
}

// Member-only subscriptions must not expose group messages/read state to non-members.
g=g.replace(/if\(!g\|\|!user\|\|!understood\)return;return onSnapshot\(query\(collection\(db,'communityGroups',id,'messages'\)/g,"if(!g||!user||!understood||!isMember)return;return onSnapshot(query(collection(db,'communityGroups',id,'messages')");
g=g.replace(/if\(!g\|\|!user\|\|!understood\)return;return onSnapshot\(doc\(db,'communityGroups',id,'readState'/g,"if(!g||!user||!understood||!isMember)return;return onSnapshot(doc(db,'communityGroups',id,'readState'");

// Ensure the join gate exists before the owner-rules acknowledgement gate.
if(!g.includes('You must join this group before you can view or send messages.')){
  const marker='if(!understood)return <main';
  if(!g.includes(marker))throw new Error('GROUP_UNDERSTOOD_GATE_NOT_FOUND');
  const gate=`if(!isMember)return <main className="min-h-screen bg-paper p-5 text-ink"><div className="mx-auto max-w-xl"><a href={BASE+'/dashboard/community/'} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-black"><ArrowLeft size={17}/> Community</a><section className="mt-5 rounded-[2rem] bg-white p-8 text-center shadow-sm"><Users className="mx-auto text-cyan-600" size={42}/><h1 className="mt-4 text-2xl font-black">Join {g.name}</h1><p className="mt-2 text-sm leading-6 text-slate-500">You must join this group before you can view or send messages.</p><button type="button" onClick={joinGroup} disabled={joining} className="mt-5 rounded-xl bg-ink px-6 py-3 text-sm font-black text-white disabled:opacity-50">{joining?'Joining…':'JOIN GROUP'}</button></section></div></main>`;
  g=g.replace(marker,gate+marker);
}

// Group Info/member modal.
if(!g.includes('GROUP MEMBERS')){
  const marker='return <main className="min-h-screen bg-[#eef3f7] text-ink">';
  if(!g.includes(marker))throw new Error('GROUP_WORKSPACE_MARKER_NOT_FOUND');
  const modal=`return <main className="min-h-screen bg-[#eef3f7] text-ink">{info&&<div className="fixed inset-0 z-[80] bg-black/50 p-4" onClick={()=>setInfo(false)}><section className="mx-auto mt-10 max-h-[80vh] max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">GROUP MEMBERS</p><h2 className="mt-1 text-xl font-black">{g.name}</h2><p className="mt-1 text-xs text-slate-500">{members.length} member{members.length===1?'':'s'}</p></div><button type="button" onClick={()=>setInfo(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button></div><div className="mt-4 space-y-2">{members.length?members.map((m:any)=><div key={m.uid} className="flex items-center gap-3 rounded-2xl border p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-sm font-black text-white">{m.photoURL?<img src={m.photoURL} className="h-full w-full object-cover"/>:String(m.fullName||'L').charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black">{m.fullName}</p><p className="truncate text-xs text-slate-400">{m.username?'@'+m.username:'Member'}</p></div></div>):<p className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">No member profiles could be loaded.</p>}</div></section></div>}<header`;
  g=g.replace(marker,modal);
}

// Collapse duplicate unread badge markup if an earlier repair produced adjacent copies.
const badge="{unread>0&&<span className=\"ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[8px] font-black text-white\">{unread>99?'99+':unread}</span>}";
while(g.includes(badge+badge))g=g.replace(badge+badge,badge);

if(!g.includes('aria-label="Write a message"')){
  if(!g.includes('<textarea'))throw new Error('GROUP_COMPOSER_MISSING');
  g=g.replace('<textarea','<textarea aria-label="Write a message"');
}

// Deterministic source assertions: exactly one state declaration and one helper each.
const counts=(re)=>{const m=g.match(re);return m?m.length:0};
if(counts(/const \[isMember,setIsMember\]=useState\(false\);/g)!==1)throw new Error('GROUP_ISMEMBER_STATE_NOT_CANONICAL');
if(counts(/const \[joining,setJoining\]=useState\(false\);/g)!==1)throw new Error('GROUP_JOINING_STATE_NOT_CANONICAL');
if(counts(/const \[isLocked,setIsLocked\]=useState\(false\);/g)!==1)throw new Error('GROUP_LOCK_STATE_NOT_CANONICAL');
if(counts(/const \[members,setMembers\]=useState<any\[\]>\(\[\]\);/g)!==1)throw new Error('GROUP_MEMBERS_STATE_NOT_CANONICAL');
if(counts(/async function joinGroup\(\)\{/g)!==1)throw new Error('GROUP_JOIN_FUNCTION_NOT_CANONICAL');
if(counts(/async function loadMembers\(ids:any\[\]\)\{/g)!==1)throw new Error('GROUP_MEMBER_LOADER_NOT_CANONICAL');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
const oldRecent="const recentRows=useMemo(()=>[...chatRows,...groupRows].sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)),[chatRows,groupRows]);";
const newRecent="const recentRows=useMemo(()=>[...chatRows].filter((c:any)=>Boolean(c.lastMessage||previews[`chat:${c.id}`])).sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,50),[chatRows,previews]);";
if(c.includes(oldRecent))c=c.replace(oldRecent,newRecent);
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
fs.writeFileSync(chat,c);

console.log('Community UI v6 applied with resilient deterministic normalization.');
