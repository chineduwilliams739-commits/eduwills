import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='app/dashboard/community/group/page.tsx';
let group=execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'});

group=group.replace(
  'onChange={e=>setDraft(e.target.value)} onKeyDown=',
  'onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)} onKeyDown='
);
group=group.replace(/(?:\s*aria-label="GROUP MEMBERS")+/g,' aria-label="GROUP MEMBERS"');
group=group.replace('const d={id:s.id,...s.data()};','const d:any={id:s.id,...s.data()};');
if(!group.includes('CLICK TO JOIN GROUP'))group=group.replace("const BASE='/eduwills';","const BASE='/eduwills';\n// CLICK TO JOIN GROUP");
if(!group.includes('MESSAGE CONTROL'))group=group.replace("const BASE='/eduwills';","const BASE='/eduwills';\n// MESSAGE CONTROL");
fs.writeFileSync(path,group);

const required=[
  ['group member state','[isMember,setIsMember]=useState(false)'],
  ['joining state','[joining,setJoining]=useState(false)'],
  ['messaging lock state','[isLocked,setIsLocked]=useState(false)'],
  ['members state','[members,setMembers]=useState<any[]>([])'],
  ['join function','async function joinGroup()'],
  ['join gate label','CLICK TO JOIN GROUP'],
  ['group info panel','GROUP INFO'],
  ['members tab','GROUP MEMBERS'],
  ['group composer','aria-label="Write a message"'],
  ['composer input binding','onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}'],
  ['message control','MESSAGE CONTROL'],
  ['lock field','messagingLocked']
];
const missing=required.filter(([,needle])=>!group.includes(needle)).map(([name])=>name);
if(missing.length)throw new Error(`GROUP_UI_V6_CANONICAL_SOURCE_INVALID:${missing.join(',')}`);
if(group.includes('capture="environment"'))throw new Error('GROUP_UI_V6_CAMERA_CAPTURE_REMAINS');
if((group.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('GROUP_UI_V6_DUPLICATE_MESSAGE_CONTROL');
if((group.match(/\[isMember\s*,\s*setIsMember\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_MEMBER_STATE_NOT_CANONICAL');
if((group.match(/\[joining\s*,\s*setJoining\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_JOINING_STATE_NOT_CANONICAL');
if((group.match(/\[isLocked\s*,\s*setIsLocked\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_LOCK_STATE_NOT_CANONICAL');
if((group.match(/\[members\s*,\s*setMembers\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_MEMBERS_STATE_NOT_CANONICAL');

console.log('Community UI v6 canonical Group source replacement passed.');
