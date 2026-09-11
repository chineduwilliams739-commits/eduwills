import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');
g=g.replace(/onChange=\{e=\s*style=\{\{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'\}\}>setDesc\(e\.target\.value\)\}/g,'onChange={e=>setDesc(e.target.value)}');
g=g.replace(/\s+capture=\{?['\"]environment['\"]\}?/g,'');

const messageControlCard=/<section\b[^>]*>(?:(?!<section\b)[\s\S])*?MESSAGE CONTROL[\s\S]*?<\/section>/g;
const cards=[...g.matchAll(messageControlCard)];
if(cards.length>1){let kept=false;g=g.replace(messageControlCard,m=>{if(kept)return '';kept=true;return m;});}

// Canonical Group state replacement. Earlier repair passes may place these
// bindings in one combined const or in separate const declarations. Instead of
// trying to delete individual fragments and guessing an anchor, normalize the
// entire state block between Group() and its first useEffect, then insert one
// canonical declaration at the end of that block.
const groupState=/export default function Group\(\)\{([\s\S]*?)(?=\n\s*useEffect\()/;
const match=g.match(groupState);
if(!match)throw new Error('GROUP_UI_V6_GROUP_STATE_BLOCK_MISSING');

let stateBlock=match[1];
const stateBindings=[
  /\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,
  /\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,
  /\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,
  /\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)\s*,?/g,
];
for(const re of stateBindings)stateBlock=stateBlock.replace(re,'');
stateBlock=stateBlock.replace(/\n\s*const\s*;\s*/g,'\n');
stateBlock=stateBlock.replace(/,\s*;/g,';');
stateBlock=stateBlock.replace(/\n\s*\n\s*\n/g,'\n\n');

const canonical='\n const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);';
stateBlock=stateBlock.replace(/;\s*$/,';'+canonical);
if(!stateBlock.includes(canonical.trim()))throw new Error('GROUP_UI_V6_CANONICAL_STATE_INSERT_FAILED');
g=g.replace(groupState,`export default function Group(){${stateBlock}`);

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
for(const [name,re] of required){if(!re.test(g))throw new Error(`GROUP_UI_V6_REQUIRED_MISSING:${name}`);}

if(g.includes('fixed inset-0 z-50')&&g.includes('>Group info</h2>'))throw new Error('OBSOLETE_GROUP_INFO_POPUP_REMAINS');
if(g.includes('capture="environment"'))throw new Error('GROUP_CAMERA_CAPTURE_REMAINS');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('DUPLICATE_MESSAGE_CONTROL_CARD');
if(/onChange=\{e=\s*style=/.test(g))throw new Error('MALFORMED_TEXTAREA_HANDLER_REMAINS');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
const c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');

console.log('Community UI v6 canonical Group state replacement passed.');