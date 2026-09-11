import fs from 'node:fs';

const replace=(file,from,to)=>{let s=fs.readFileSync(file,'utf8');if(!s.includes(to)){const next=s.replace(from,to);if(next!==s)s=next;}fs.writeFileSync(file,s)};

// Group page: membership state, message access, lock state, and exact join CTA.
const group='app/dashboard/community/group/page.tsx';
const groupState='[isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false)';
if(!/\[isMember,setIsMember\]/.test(fs.readFileSync(group,'utf8'))){
  replace(group,
    "[memberSearch,setMemberSearch]=useState(''),[reply,setReply]=useState<any>(null),[unread,setUnread]=useState(0);",
    "[memberSearch,setMemberSearch]=useState(''),[reply,setReply]=useState<any>(null),[unread,setUnread]=useState(0),"+groupState+";"
  );
}
replace(group,
  "setG(d);setName(d.name||'');setDesc(d.description||'');setAvatar(d.avatarUrl||'');setCover(d.coverImageUrl||'');",
  "setG(d);setIsMember(d.ownerId===user.uid||d.adminIds?.includes(user.uid)||d.memberIds?.includes(user.uid));setIsLocked(d.messagingLocked===true);setName(d.name||'');setDesc(d.description||'');setAvatar(d.avatarUrl||'');setCover(d.coverImageUrl||'');"
);
replace(group,
  "useEffect(()=>{if(!g||!user||!understood)return;return onSnapshot(query(collection(db,'communityGroups',id,'messages'),orderBy('createdAt','asc'),limit(200)),s=>setMessages(s.docs.map(x=>({id:x.id,...x.data()}))))},[g?.id,understood]);",
  "useEffect(()=>{if(!g||!user||!understood||!isMember)return;return onSnapshot(query(collection(db,'communityGroups',id,'messages'),orderBy('createdAt','asc'),limit(200)),s=>setMessages(s.docs.map(x=>({id:x.id,...x.data()}))))},[g?.id,understood,isMember]);"
);
let currentGroup=fs.readFileSync(group,'utf8');
const adminAnchor="const isAdmin=!!g?.adminIds?.includes(user?.uid),isOwner=g?.ownerId===user?.uid;";
if(!currentGroup.includes('async function joinGroup()') && !currentGroup.includes('async function toggleLock()')){
  replace(group,
    adminAnchor,
    adminAnchor+"\n useEffect(()=>{if(!g||!user||!isMember)return;setDoc(doc(db,'communityGroups',id,'readState',user.uid),{unread:0,lastReadAt:serverTimestamp()},{merge:true}).catch(()=>{})},[g?.id,user?.uid,isMember]);\n async function joinGroup(){if(!user||!g||joining||isMember)return;setJoining(true);try{await updateDoc(doc(db,'communityGroups',id),{memberIds:arrayUnion(user.uid),memberCount:(Array.isArray(g.memberIds)?g.memberIds.length:0)+1,updatedAt:serverTimestamp()});setIsMember(true);setNotice('You joined the group.')}catch(e:any){setNotice(e?.message||'Could not join this group.')}finally{setJoining(false)}}\n async function toggleLock(){if(!isAdmin)return;try{await updateDoc(doc(db,'communityGroups',id),{messagingLocked:!isLocked,updatedAt:serverTimestamp()});setIsLocked(!isLocked);setNotice(!isLocked?'Sending is now locked for members.':'Sending is now unlocked.')}catch(e:any){setNotice(e?.message||'Could not change message control.')}}"
  );
}
if(!fs.readFileSync(group,'utf8').includes('async function joinGroup()')){
  replace(group,
    adminAnchor,
    adminAnchor+"\n useEffect(()=>{if(!g||!user||!isMember)return;setDoc(doc(db,'communityGroups',id,'readState',user.uid),{unread:0,lastReadAt:serverTimestamp()},{merge:true}).catch(()=>{})},[g?.id,user?.uid,isMember]);\n async function joinGroup(){if(!user||!g||joining||isMember)return;setJoining(true);try{await updateDoc(doc(db,'communityGroups',id),{memberIds:arrayUnion(user.uid),memberCount:(Array.isArray(g.memberIds)?g.memberIds.length:0)+1,updatedAt:serverTimestamp()});setIsMember(true);setNotice('You joined the group.')}catch(e:any){setNotice(e?.message||'Could not join this group.')}finally{setJoining(false)}}"
  );
}
// Ordering-safe toggleLock insertion: the earlier community-controls repair may
// already have changed the send() guard, so anchor on the stable function signature.
currentGroup=fs.readFileSync(group,'utf8');
if(!currentGroup.includes('async function toggleLock()')){
  const sendMarker='async function send(){';
  if(!currentGroup.includes(sendMarker)) throw new Error('Could not insert toggleLock: send() anchor not found');
  currentGroup=currentGroup.replace(sendMarker,"async function toggleLock(){if(!isAdmin)return;try{const next=!isLocked;await updateDoc(doc(db,'communityGroups',id),{messagingLocked:next,updatedAt:serverTimestamp()});setIsLocked(next);setNotice(next?'Sending is now locked for members.':'Sending is now unlocked.')}catch(e:any){setNotice(e?.message||'Could not change message control.')}}\n "+sendMarker);
  fs.writeFileSync(group,currentGroup);
}
const repaired=fs.readFileSync(group,'utf8');
if(!repaired.includes('async function toggleLock()')) throw new Error('Community repair failed: toggleLock was not inserted');
replace(group,
  "async function send(){if((!draft.trim()&&!image)||!user)return;",
  "async function send(){if((!draft.trim()&&!image)||!user||!isMember||isLocked)return;"
);
replace(group,
  "if(!understood)return <main",
  "if(!isMember)return <main className=\"min-h-screen bg-paper p-5 text-ink\"><div className=\"mx-auto max-w-xl\"><a href={BASE+'/dashboard/community/'} className=\"inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-black\"><ArrowLeft size={17}/> Community</a><section className=\"mt-8 rounded-3xl border bg-white p-8 text-center shadow-sm\"><Users className=\"mx-auto text-cyan-600\" size={44}/><h1 className=\"mt-4 text-2xl font-black\">{g.name}</h1><p className=\"mt-2 text-sm leading-6 text-slate-500\">Join this group to participate in the conversation and share learning resources.</p><button onClick={joinGroup} disabled={joining} className=\"mt-6 w-full rounded-xl bg-ink px-5 py-4 text-sm font-black text-white disabled:opacity-50\">{joining?'JOINING…':'CLICK TO JOIN GROUP'}</button></section></div></main>;\n if(!understood)return <main"
);
replace(group,
  "<section className=\"mx-3 mb-3 rounded-2xl border border-slate-200 bg-white shadow-sm sm:mx-0\">",
  "{isAdmin&&<section className=\"mx-3 mt-3 rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:mx-0\"><div className=\"flex items-center justify-between gap-3\"><div><p className=\"text-[10px] font-black uppercase tracking-[.18em] text-cyan-700\">MESSAGE CONTROL</p><p className=\"mt-1 text-xs font-bold text-slate-500\">{isLocked?'Members cannot send messages.':'Members can send messages.'}</p></div><button onClick={toggleLock} className=\"rounded-xl bg-ink px-4 py-2.5 text-[10px] font-black text-white\">{isLocked?'UNLOCK SENDING':'LOCK SENDING'}</button></div></section>}\n {isLocked&&<div className=\"mx-3 mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-900 sm:mx-0\">Sending is locked by a group admin. You can still read the conversation.</div>}\n <section className=\"mx-3 mb-3 rounded-2xl border border-slate-200 bg-white shadow-sm sm:mx-0\">"
);

// Community page: keep joined groups in the group section rather than Recent Chats.
const community='app/dashboard/community/page.tsx';
let c=fs.readFileSync(community,'utf8');
const cardStart=c.indexOf('function GroupCard(');
if(cardStart>=0){
 c=c.slice(0,cardStart)+`function GroupCard({g,onOpen,mine=false}:{g:CommunityGroup;onOpen:()=>void;mine?:boolean}){const photo=g.avatarUrl||g.photoURL;return <div className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"><div className="flex gap-4"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cyan-50 text-cyan-700">{photo?<img src={photo} className="h-full w-full object-cover"/>:<span className="text-xl font-black">{initials(g)}</span>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="truncate text-base font-black">{g.name}</h3>{mine&&<span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">JOINED</span>}</div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{g.description||'Focused EDUWILLS study community.'}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black text-slate-400"><span>{Array.isArray(g.memberIds)?g.memberIds.length:(g.memberCount||0)} members</span><span>•</span><span>{Array.isArray(g.adminIds)?g.adminIds.length:1} admins</span><span>•</span><span>{g.type||'study'}</span></div></div></div><button type="button" onClick={onOpen} className="mt-4 w-full rounded-xl bg-ink px-4 py-3 text-center text-xs font-black text-white">{mine?'OPEN GROUP':'CLICK TO JOIN GROUP'}</button></div>}`;
 fs.writeFileSync(community,c);
}

// Chat page: Recent Chats contains direct chats only. Unread badges are derived from
// each chat's readState plus its messages, so they work even when no counter field was
// maintained by an earlier version of the app.
const chat='app/dashboard/community/chat/page.tsx';
let h=fs.readFileSync(chat,'utf8');
h=h.replace("[busy,setBusy]=useState(false),[reply,setReply]=useState<any>(null);","[busy,setBusy]=useState(false),[reply,setReply]=useState<any>(null),[unreadMap,setUnreadMap]=useState<Record<string,number>>({});");
const oldRows=" const chatRows=useMemo(()=>chats.map((c:any)=>{const ids=Array.isArray(c.participantIds)?c.participantIds:[];const other=ids.find((x:string)=>x!==user?.uid);return {...c,otherId:other,person:display(c.participantProfiles?.[other]||{uid:other,username:c.otherUsername,fullName:c.otherName,photoURL:c.otherPhotoURL})}}),[chats,user?.uid]);";
const newRows=` useEffect(()=>{if(!user||!chats.length){setUnreadMap({});return}const cleanups=chats.slice(0,100).map((c:any)=>{let lastRead=0;let messageRows:any[]=[];const apply=()=>{const count=messageRows.filter((m:any)=>m.senderId!==user.uid&&(m.createdAt?.toMillis?.()||0)>lastRead).length;setUnreadMap(prev=>({...prev,[c.id]:count}))};const u1=onSnapshot(doc(db,'communityChats',c.id,'readState',user.uid),s=>{const d=s.data()||{};lastRead=d.lastReadAt?.toMillis?.()||0;apply()});const u2=onSnapshot(query(collection(db,'communityChats',c.id,'messages'),orderBy('createdAt','desc'),limit(100)),s=>{messageRows=s.docs.map(x=>({id:x.id,...x.data()}));apply()});return()=>{u1();u2()}});return()=>cleanups.forEach((fn:any)=>fn())},[user?.uid,chats]);\n const chatRows=useMemo(()=>chats.map((c:any)=>{const ids=Array.isArray(c.participantIds)?c.participantIds:[];const other=ids.find((x:string)=>x!==user?.uid);return {...c,otherId:other,person:display(c.participantProfiles?.[other]||{uid:other,username:c.otherUsername,fullName:c.otherName,photoURL:c.otherPhotoURL}),unreadCount:unreadMap[c.id]||0}}),[chats,user?.uid,unreadMap]);`;
if(h.includes(oldRows)) h=h.replace(oldRows,newRows);
fs.writeFileSync(chat,h);
console.log('Community controls v3 applied: member reads, admin deletes, direct-chat recents and unread badges hardened.');
