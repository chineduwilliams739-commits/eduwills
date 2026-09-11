import fs from 'node:fs';
const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');
const line=/\n\s*const \[isMember,setIsMember\]=useState\(false\),\[joining,setJoining\]=useState\(false\),\[isLocked,setIsLocked\]=useState\(false\),\[members,setMembers\]=useState<any\[\]>\(\[\]\);/g;
const found=[...g.matchAll(line)];
if(!found.length)throw new Error('GROUP_UI_V6_CANONICAL_STATE_MISSING');
if(found.length>1){let kept=false;g=g.replace(line,m=>{if(kept)return '';kept=true;return m;});}
if((g.match(/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\(false\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_MEMBER_STATE_NOT_CANONICAL');
if((g.match(/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\(false\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_JOINING_STATE_NOT_CANONICAL');
if((g.match(/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\(false\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_LOCK_STATE_NOT_CANONICAL');
if((g.match(/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState<any\[\]>\(\[\]\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_MEMBERS_STATE_NOT_CANONICAL');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_UI_V6_COMPOSER_MISSING');
if(g.includes('capture="environment"'))throw new Error('GROUP_CAMERA_CAPTURE_REMAINS');
fs.writeFileSync(group,g);
console.log('Community UI v6 standalone state deduplication passed.');
