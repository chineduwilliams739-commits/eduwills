import fs from 'node:fs';

const path='app/dashboard/community/group/page.tsx';
const group=fs.readFileSync(path,'utf8');

// v6 is intentionally validation-only. Earlier versions rewrote React state
// declarations and could turn valid TSX into malformed comma declarations.
// The committed Group page is now the canonical implementation; this pass
// must never destructively rewrite it in the Pages build workspace.
const required=[
  ['group member state','[isMember,setIsMember]=useState(false)'],
  ['joining state','[joining,setJoining]=useState(false)'],
  ['messaging lock state','[isLocked,setIsLocked]=useState(false)'],
  ['members state','[members,setMembers]=useState<any[]>([])'],
  ['join function','async function joinGroup()'],
  ['group info panel','GROUP INFO'],
  ['members tab','>MEMBERS</button>'],
  ['group composer','aria-label="Write a message"'],
  ['composer draft binding','setDraft(e.target.value)']
];
const missing=required.filter(([,needle])=>!group.includes(needle)).map(([name])=>name);
if(missing.length)throw new Error(`GROUP_UI_V6_CANONICAL_SOURCE_INVALID:${missing.join(',')}`);
if(group.includes('capture="environment"'))throw new Error('GROUP_UI_V6_CAMERA_CAPTURE_REMAINS');
if((group.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('GROUP_UI_V6_DUPLICATE_MESSAGE_CONTROL');
if((group.match(/\[isMember\s*,\s*setIsMember\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_MEMBER_STATE_NOT_CANONICAL');
if((group.match(/\[joining\s*,\s*setJoining\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_JOINING_STATE_NOT_CANONICAL');
if((group.match(/\[isLocked\s*,\s*setIsLocked\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_LOCK_STATE_NOT_CANONICAL');
if((group.match(/\[members\s*,\s*setMembers\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_MEMBERS_STATE_NOT_CANONICAL');

console.log('Community UI v6 canonical source validation passed.');
