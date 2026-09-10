import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');
g=g.replace(/setUnderstood\(d\.creatorRulesAccepted===true\|\|d\.ownerId!==user\.uid\)\},\[id,user\?\.uid\]\);/,'setUnderstood(d.creatorRulesAccepted===true||d.ownerId!==user.uid);});},[id,user?.uid]);');

// Remove community state bindings wherever an earlier repair pass placed them.
// Do not depend on one exact declaration layout: controls-v2 may keep several
// state variables on the same const line.
const stateNames=['isMember','joining','isLocked','members'];
const statePatterns={
  isMember:/\[isMember\s*,\s*setIsMember\]\s*=\s*useState\s*\(\s*false\s*\)/g,
  joining:/\[joining\s*,\s*setJoining\]\s*=\s*useState\s*\(\s*false\s*\)/g,
  isLocked:/\[isLocked\s*,\s*setIsLocked\]\s*=\s*useState\s*\(\s*false\s*\)/g,
  members:/\[members\s*,\s*setMembers\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g
};
for(const name of stateNames){
  g=g.replace(statePatterns[name],'');
}
// Clean separators left behind after removing a binding from a combined const.
g=g.replace(/,\s*,/g,',').replace(/\[unread,setUnread\]=useState\(0\)\s*,\s*;/g,'[unread,setUnread]=useState(0);');
// Remove any derived binding that conflicts with the React lock state.
g=g.replace(/,\s*isLocked\s*=\s*g\?\.messagingLocked===true(?=;)/g,'');
g=g.replace(/,isLocked=g\?\.messagingLocked===true(?=;)/g,'');

// Insert exactly one canonical community state declaration after the unread state.
const canonical=' const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);';
if(!g.includes(canonical)){
  const lines=g.split('\n');
  let inserted=false;
  for(let i=0;i<lines.length;i++){
    if(lines[i].includes('[unread,setUnread]=useState(0)')){
      lines.splice(i+1,0,canonical.trimStart());
      inserted=true;
      break;
    }
  }
  if(!inserted)throw new Error('GROUP_STATE_MARKER_NOT_FOUND');
  g=lines.join('\n');
}

// Remove duplicate message-control sections.
function dedupeMessageControl(source){
  const marker='MESSAGE CONTROL'; const first=source.indexOf(marker); if(first<0)return source;
  while(true){const second=source.indexOf(marker,first+marker.length);if(second<0)break;const start=source.lastIndexOf('<section',second);if(start<0)break;const tags=/<\/?section\b[^>]*>/g;tags.lastIndex=start;let depth=0,end=-1,m;while((m=tags.exec(source))){depth+=m[0][1]==='/'?-1:1;if(depth===0){end=m.index+m[0].length;break}}if(end<0)break;source=source.slice(0,start)+source.slice(end)}return source;
}
g=dedupeMessageControl(g);

// Remove any obsolete floating Group Info implementation.
const popupStart=g.indexOf('{info&&<div className="fixed inset-0 z-50');
const settingsStart=g.indexOf('{isAdmin&&settings&&',popupStart);
if(popupStart>=0&&settingsStart>popupStart)g=g.slice(0,popupStart)+g.slice(settingsStart);

// Force the actual message composer to be horizontal and camera-free.
const input=/<input value=\{draft\} onChange=\{e=>setDraft\(e\.target\.value\)\} onKeyDown=\{e=>e\.key==='Enter'&&!e\.shiftKey&&\(e\.preventDefault\(\),send\(\)\)\} placeholder="Write a message…" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"\/>/;
if(input.test(g))g=g.replace(input,'<textarea aria-label="Write a message" rows={1} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key===\'Enter\'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Write a message…" className="min-h-12 max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none" style={{writingMode:\'horizontal-tb\',direction:\'ltr\',textAlign:\'left\'}}/>');
g=g.replace(/capture="environment"/g,'');
g=g.replace(/onChange=\{e=\s*style=\{\{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'\}\}>setDesc\(e\.target\.value\)\}/g,'onChange={e=>setDesc(e.target.value)}');

const count=(re)=>(g.match(re)||[]).length;
if(count(/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_MEMBER_STATE_NOT_CANONICAL');
if(count(/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_JOINING_STATE_NOT_CANONICAL');
if(count(/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_LOCK_STATE_NOT_CANONICAL');
if(count(/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g)!==1)throw new Error('GROUP_MEMBERS_STATE_NOT_CANONICAL');
if(/\bisLocked\s*=\s*g\?\.messagingLocked===true/.test(g))throw new Error('GROUP_DERIVED_LOCK_COLLISION');
if(!g.includes('async function joinGroup'))throw new Error('GROUP_JOIN_FUNCTION_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP INFO')||!g.includes('>MEMBERS</button>'))throw new Error('GROUP_MEMBERS_VIEW_MISSING');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('DUPLICATE_MESSAGE_CONTROL_CARD');
if(g.includes('fixed inset-0 z-50')&&g.includes('>Group info</h2>'))throw new Error('OBSOLETE_GROUP_INFO_POPUP_REMAINS');
if(/onChange=\{e=\s*style=/.test(g))throw new Error('MALFORMED_TEXTAREA_HANDLER_REMAINS');
if(!/setUnderstood\(d\.creatorRulesAccepted===true\|\|d\.ownerId!==user\.uid\);\}\);\},\[id,user\?\.uid\]\);/.test(g))throw new Error('GROUP_AUTH_SNAPSHOT_HOOK_NOT_CANONICAL');

fs.writeFileSync(group,g);
const chat='app/dashboard/community/chat/page.tsx';
const c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
console.log('Community UI v6 final normalization passed.');
