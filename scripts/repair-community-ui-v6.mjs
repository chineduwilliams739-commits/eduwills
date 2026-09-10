import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Normalize accidental literal newline sequences first.
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// The previous Community repairs left the group snapshot hook with the dependency
// array attached to onSnapshot instead of to useEffect. Repair that exact shape.
g=g.replace(
  /setUnderstood\(d\.creatorRulesAccepted===true\|\|d\.ownerId!==user\.uid\)\},\[id,user\?\.uid\]\);/,
  'setUnderstood(d.creatorRulesAccepted===true||d.ownerId!==user.uid);});},[id,user?.uid]);'
);

// Never allow a second derived isLocked binding to coexist with React state.
g=g.replace(/,isLocked=g\?\.messagingLocked===true(?=;)/g,'');
g=g.replace(/,\s*isLocked\s*=\s*g\?\.messagingLocked===true(?=;)/g,'');

// Remove duplicate MESSAGE CONTROL cards by balancing section tags.
function dedupeMessageControl(source){
  const marker='MESSAGE CONTROL';
  const first=source.indexOf(marker);
  if(first<0)return source;
  while(true){
    const second=source.indexOf(marker,first+marker.length);
    if(second<0)break;
    const start=source.lastIndexOf('<section',second);
    if(start<0)break;
    const tags=/<\/?section\b[^>]*>/g;
    tags.lastIndex=start;
    let depth=0,end=-1,m;
    while((m=tags.exec(source))){
      depth += m[0][1]==='/' ? -1 : 1;
      if(depth===0){end=m.index+m[0].length;break;}
    }
    if(end<0)break;
    source=source.slice(0,start)+source.slice(end);
  }
  return source;
}
g=dedupeMessageControl(g);

// Remove the obsolete floating Group Info popup if an earlier repair reintroduced it.
const popupStart=g.indexOf('{info&&<div className="fixed inset-0 z-50');
const settingsStart=g.indexOf('{isAdmin&&settings&&',popupStart);
if(popupStart>=0&&settingsStart>popupStart)g=g.slice(0,popupStart)+g.slice(settingsStart);

// Ensure the real message composer is a horizontal textarea and never camera capture.
const input=/<input value=\{draft\} onChange=\{e=>setDraft\(e\.target\.value\)\} onKeyDown=\{e=>e\.key==='Enter'&&!e\.shiftKey&&\(e\.preventDefault\(\),send\(\)\)\} placeholder="Write a message…" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"\/>/;
if(input.test(g))g=g.replace(input,'<textarea aria-label="Write a message" rows={1} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key===\'Enter\'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Write a message…" className="min-h-12 max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none" style={{writingMode:\'horizontal-tb\',direction:\'ltr\',textAlign:\'left\'}}/>');
g=g.replace(/capture="environment"/g,'');

// Remove malformed v7 settings textarea mutations if present.
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
console.log('Community UI v6 finalized: hook syntax, horizontal composer, inline Group Info MEMBERS view, canonical lock control, and source validation passed.');
