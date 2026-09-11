import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// v6 must never destructively rebuild the React state declaration. Earlier
// versions could corrupt valid TSX when spacing or declaration layout changed.
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Repair only the known malformed settings textarea handler if an older pass left it.
g=g.replace(/onChange=\{e=\s*style=\{\{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'\}\}>setDesc\(e\.target\.value\)\}/g,'onChange={e=>setDesc(e.target.value)}');

// Keep the group composer camera-free.
g=g.replace(/\s+capture=\{?['\"]environment['\"]\}?/g,'');

// If earlier passes duplicated MESSAGE CONTROL, keep the first complete card.
const messageControlCard=/<section\b[^>]*>(?:(?!<section\b)[\s\S])*?MESSAGE CONTROL[\s\S]*?<\/section>/g;
const cards=[...g.matchAll(messageControlCard)];
if(cards.length>1){
  let kept=false;
  g=g.replace(messageControlCard,m=>{if(kept)return '';kept=true;return m;});
}

// Validate state semantically, allowing harmless whitespace/layout differences.
const statePatterns=[
  ['group member state',/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g],
  ['group joining state',/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g],
  ['group lock state',/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g],
  ['group members state',/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g],
];
for(const [name,re] of statePatterns){
  const count=(g.match(re)||[]).length;
  if(count!==1)throw new Error(`GROUP_UI_V6_STATE_INVALID:${name}:${count}`);
}

const required=[
  ['join function',/async\s+function\s+joinGroup\s*\(\s*\)/],
  ['group info panel',/GROUP INFO/],
  ['members tab',/>MEMBERS<\/button>/],
  ['group composer',/aria-label="Write a message"/],
  ['group composer input handler',/onChange=\{e=>setDraft\(e\.target\.value\)\}/],
];
for(const [name,re] of required){
  if(!re.test(g))throw new Error(`GROUP_UI_V6_REQUIRED_MISSING:${name}`);
}

if(g.includes('fixed inset-0 z-50')&&g.includes('>Group info</h2>'))throw new Error('OBSOLETE_GROUP_INFO_POPUP_REMAINS');
if(g.includes('capture="environment"'))throw new Error('GROUP_CAMERA_CAPTURE_REMAINS');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('DUPLICATE_MESSAGE_CONTROL_CARD');
if(/onChange=\{e=\s*style=/.test(g))throw new Error('MALFORMED_TEXTAREA_HANDLER_REMAINS');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
const c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');

console.log('Community UI v6 tolerant normalization passed.');
