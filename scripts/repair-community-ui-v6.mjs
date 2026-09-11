import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// The current group page is already in the canonical inline INFO/MEMBERS form.
// Avoid destructive regex rewrites: earlier versions could remove pieces of
// combined declarations and leave syntactically invalid TSX.
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Repair only the known malformed textarea handler if an older pass left it.
g=g.replace(/onChange=\{e=\s*style=\{\{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'\}\}>setDesc\(e\.target\.value\)\}/g,'onChange={e=>setDesc(e.target.value)}');

// Keep the current composer camera-free and horizontal.
g=g.replace(/capture="environment"/g,'');

// Earlier Community control passes could inject the MESSAGE CONTROL card more
// than once. Normalize those existing cards instead of treating them as a fatal
// condition. The card itself contains no nested <section>, so this pattern safely
// captures each complete card and preserves the first canonical copy.
const messageControlCard=/<section\b[^>]*>(?:(?!<section\b)[\s\S])*?MESSAGE CONTROL[\s\S]*?<\/section>/g;
const messageControlCards=[...g.matchAll(messageControlCard)];
if(messageControlCards.length>1){
  let kept=false;
  g=g.replace(messageControlCard,match=>{
    if(kept)return '';
    kept=true;
    return match;
  });
}

const required=[
  ['group member state','[isMember,setIsMember]=useState(false)'],
  ['group joining state','[joining,setJoining]=useState(false)'],
  ['group lock state','[isLocked,setIsLocked]=useState(false)'],
  ['group members state','[members,setMembers]=useState<any[]>([])'],
  ['join function','async function joinGroup()'],
  ['group info panel','GROUP INFO'],
  ['members tab','>MEMBERS</button>'],
  ['group composer','aria-label="Write a message"'],
  ['group composer input handler','onChange={e=>setDraft(e.target.value)}'],
];
for(const [name,needle] of required){
  if(!g.includes(needle))throw new Error(`GROUP_UI_V6_REQUIRED_MISSING:${name}`);
}

if(g.includes('fixed inset-0 z-50')&&g.includes('>Group info</h2>'))throw new Error('OBSOLETE_GROUP_INFO_POPUP_REMAINS');
if(g.includes('capture="environment"'))throw new Error('GROUP_CAMERA_CAPTURE_REMAINS');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('DUPLICATE_MESSAGE_CONTROL_CARD');
if(/onChange=\{e=\s*style=/.test(g))throw new Error('MALFORMED_TEXTAREA_HANDLER_REMAINS');
if((g.match(/\[isMember\s*,\s*setIsMember\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_MEMBER_STATE_NOT_CANONICAL');
if((g.match(/\[joining\s*,\s*setJoining\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_JOINING_STATE_NOT_CANONICAL');
if((g.match(/\[isLocked\s*,\s*setIsLocked\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_LOCK_STATE_NOT_CANONICAL');
if((g.match(/\[members\s*,\s*setMembers\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g)||[]).length!==1)throw new Error('GROUP_MEMBERS_STATE_NOT_CANONICAL');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
const c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');

console.log('Community UI v6 safe normalization passed.');
