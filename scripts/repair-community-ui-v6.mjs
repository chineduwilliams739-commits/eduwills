import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Earlier community repairs run before this script. They are intentionally allowed to
// be additive, but the final source must contain exactly one copy of each group state
// variable and helper. Do the cleanup here, after all earlier repairs have finished.
const stripLineState=(name)=>{
  const re=new RegExp(`\\n const \\[${name},set${name.charAt(0).toUpperCase()+name.slice(1)}\\]=[^;]+;\\n`,'g');
  g=g.replace(re,'\\n');
};
stripLineState('isMember');
stripLineState('joining');
stripLineState('isLocked');
stripLineState('members');

// Remove additive state fragments that may have been inserted into the large initial
// useState declaration by older repair scripts.
g=g.replace(/,?\\[isMember,setIsMember\\]=useState\\(false\\)(?:,\\[joining,setJoining\\]=useState\\(false\\))?(?:,\\[isLocked,setIsLocked\\]=useState\\(false\\))?(?:,\\[members,setMembers\\]=useState<any\\[\\]\\>\\(\\[\\]\\))?/g,'');
g=g.replace(/,?\\[joining,setJoining\\]=useState\\(false\\)/g,'');
g=g.replace(/,?\\[isLocked,setIsLocked\\]=useState\\(false\\)/g,'');
g=g.replace(/,?\\[members,setMembers\\]=useState<any\\[\\]\\>\\(\\[\\]\\)/g,'');

const stateMarker="[memberSearch,setMemberSearch]=useState(''),[reply,setReply]=useState<any>(null),[unread,setUnread]=useState(0);";
if(!g.includes(stateMarker)) throw new Error('GROUP_STATE_NORMALIZATION_MARKER_NOT_FOUND');
if(!g.includes('const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);')){
  g=g.replace(stateMarker,stateMarker+"\n const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);");
}

// Keep membership and lock state derived from the live group document.
if(!g.includes('setIsMember(d.ownerId===user.uid||d.adminIds?.includes(user.uid)||d.memberIds?.includes(user.uid))')){
  const marker='setG(d);';
  if(!g.includes(marker)) throw new Error('GROUP_DOCUMENT_STATE_MARKER_NOT_FOUND');
  g=g.replace(marker,marker+'setIsMember(d.ownerId===user.uid||d.adminIds?.includes(user.uid)||d.memberIds?.includes(user.uid));');
}
if(!g.includes('setIsLocked(d.messagingLocked===true)')){
  const marker='setIsMember(d.ownerId===user.uid||d.adminIds?.includes(user.uid)||d.memberIds?.includes(user.uid));';
  g=g.replace(marker,marker+'setIsLocked(d.messagingLocked===true);');
}

// Remove the redundant local member-loader effect added by runtime-v4. The canonical
// function below is shared by the group snapshot and the Group Members panel.
g=g.replace(/\\n useEffect\\(\\(\\)=>\\{let cancelled=false;const loadMembers=async\\(\\)=>\\{[\\s\\S]*?\\};loadMembers\\(\\);return\\(\\)=>\\{cancelled=true\\}\\},\\[g\\?\\.id,g\\?\\.memberIds\\]\\);/g,'');

function removeDuplicateFunctions(source,name){
  const needle=`async function ${name}(){`;
  let first=source.indexOf(needle);
  if(first<0)return source;
  let pos=first+needle.length;
  let depth=1;
  let quote='';
  for(;pos<source.length;pos++){
    const ch=source[pos];
    const prev=source[pos-1];
    if(quote){
      if(ch===quote && prev!=='\\\\')quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'){
      depth--;
      if(depth===0){pos++;break;}
    }
  }
  if(depth!==0)throw new Error(`UNBALANCED_${name.toUpperCase()}_FUNCTION`);
  let out=source.slice(0,pos);
  let rest=source.slice(pos);
  while((first=rest.indexOf(needle))>=0){
    let p=first+needle.length,d=1,q='';
    for(;p<rest.length;p++){
      const ch=rest[p],prev=rest[p-1];
      if(q){if(ch===q&&prev!=='\\\\')q='';continue;}
      if(ch==='"'||ch==="'"||ch==='`'){q=ch;continue;}
      if(ch==='{')d++;
      else if(ch==='}'){d--;if(d===0){p++;break;}}
    }
    if(d!==0)throw new Error(`UNBALANCED_${name.toUpperCase()}_DUPLICATE`);
    rest=rest.slice(0,first)+rest.slice(p);
  }
  return out+rest;
}

g=removeDuplicateFunctions(g,'joinGroup');
g=removeDuplicateFunctions(g,'loadMembers');

// Ensure the canonical member loader and join action exist when an older script left
// neither implementation behind.
if(!g.includes('async function loadMembers')){
  const marker=' async function acknowledge(){';
  if(!g.includes(marker))throw new Error('GROUP_ACK_MARKER_NOT_FOUND');
  g=g.replace(marker," async function loadMembers(ids:any[]){const list=Array.isArray(ids)?[...new Set(ids.filter(Boolean))].slice(0,100):[];try{const rows=await Promise.all(list.map(async uid=>{try{const s=await getDoc(doc(db,'users',String(uid)));const d=s.data()||{};return {uid:String(uid),fullName:String(d.fullName||d.displayName||d.name||d.username||'Learner'),username:String(d.username||''),photoURL:String(d.photoURL||d.avatarUrl||d.profilePhotoURL||'')}}catch{return {uid:String(uid),fullName:'Learner',username:'',photoURL:''}}}));setMembers(rows)}catch{setMembers([])}}\n"+marker);
}
if(!g.includes('async function joinGroup')){
  const marker=' async function acknowledge(){';
  if(!g.includes(marker))throw new Error('GROUP_ACK_MARKER_NOT_FOUND_FOR_JOIN');
  g=g.replace(marker," async function joinGroup(){if(!user||!g||joining||isMember)return;setJoining(true);setNotice('');try{await updateDoc(doc(db,'communityGroups',id),{memberIds:arrayUnion(user.uid),updatedAt:serverTimestamp()});setIsMember(true);setG((x:any)=>({...x,memberIds:Array.from(new Set([...(Array.isArray(x?.memberIds)?x.memberIds:[]),user.uid]))}));setNotice('You joined this group.')}catch(e:any){setNotice(e?.message||'Could not join this group.')}finally{setJoining(false)}}\n"+marker);
}

// Reconnect the live group snapshot to the canonical member loader.
if(!g.includes('loadMembers(d.memberIds||[])')){
  const marker='setG(d);';
  if(g.includes(marker))g=g.replace(marker,marker+'loadMembers(d.memberIds||[]);');
}

// Member-only message/read subscriptions and the join gate must remain enforced.
g=g.replace("if(!g||!user||!understood)return;return onSnapshot(query(collection(db,'communityGroups',id,'messages')", "if(!g||!user||!understood||!isMember)return;return onSnapshot(query(collection(db,'communityGroups',id,'messages')");
g=g.replace("if(!g||!user||!understood)return;return onSnapshot(doc(db,'communityGroups',id,'readState'", "if(!g||!user||!understood||!isMember)return;return onSnapshot(doc(db,'communityGroups',id,'readState'");

if(!g.includes('You must join this group before you can view or send messages.')){
  const marker='if(!understood)return <main';
  if(!g.includes(marker))throw new Error('GROUP_UNDERSTOOD_GATE_NOT_FOUND');
  const gate=`if(!isMember)return <main className="min-h-screen bg-paper p-5 text-ink"><div className="mx-auto max-w-xl"><a href={BASE+'/dashboard/community/'} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-black"><ArrowLeft size={17}/> Community</a><section className="mt-5 rounded-[2rem] bg-white p-8 text-center shadow-sm"><Users className="mx-auto text-cyan-600" size={42}/><h1 className="mt-4 text-2xl font-black">Join {g.name}</h1><p className="mt-2 text-sm leading-6 text-slate-500">You must join this group before you can view or send messages.</p><button type="button" onClick={joinGroup} disabled={joining} className="mt-5 rounded-xl bg-ink px-6 py-3 text-sm font-black text-white disabled:opacity-50">{joining?'Joining…':'JOIN GROUP'}</button></section></div></main>;
`;
  g=g.replace(marker,gate+marker);
}

if(!g.includes('GROUP MEMBERS')){
  const marker='return <main className="min-h-screen bg-[#eef3f7] text-ink">';
  if(!g.includes(marker))throw new Error('GROUP_WORKSPACE_MARKER_NOT_FOUND');
  const modal=`return <main className="min-h-screen bg-[#eef3f7] text-ink">{info&&<div className="fixed inset-0 z-[80] bg-black/50 p-4" onClick={()=>setInfo(false)}><section className="mx-auto mt-10 max-h-[80vh] max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">GROUP MEMBERS</p><h2 className="mt-1 text-xl font-black">{g.name}</h2><p className="mt-1 text-xs text-slate-500">{members.length} member{members.length===1?'':'s'}</p></div><button type="button" onClick={()=>setInfo(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button></div><div className="mt-4 space-y-2">{members.length?members.map((m:any)=><div key={m.uid} className="flex items-center gap-3 rounded-2xl border p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-sm font-black text-white">{m.photoURL?<img src={m.photoURL} className="h-full w-full object-cover"/>:String(m.fullName||'L').charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black">{m.fullName}</p><p className="truncate text-xs text-slate-400">{m.username?'@'+m.username:'Member'}</p></div></div>):<p className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">No member profiles could be loaded.</p>}</div></section></div>`;
  g=g.replace(marker,modal);
}

g=g.replace('</section></div><header className="sticky','</section></div>}<header className="sticky');
const badge="{unread>0&&<span className=\"ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[8px] font-black text-white\">{unread>99?'99+':unread}</span>}";
while(g.includes(badge+badge))g=g.replace(badge+badge,badge);
if(!g.includes('aria-label="Write a message"')){
  if(!/<textarea\\b/.test(g))throw new Error('GROUP_COMPOSER_MISSING');
  g=g.replace(/<textarea\\b/,'<textarea aria-label="Write a message"');
}
if(!g.includes('async function loadMembers'))throw new Error('GROUP_MEMBER_LOADER_MISSING');
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

console.log('Community UI v6 applied with deterministic final-source normalization.');
