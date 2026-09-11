import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Remove duplicate standalone canonical state declarations only. Do not rewrite
// the surrounding Group function or JSX; this avoids the corruption caused by
// the older broad state-block regex.
const canonical=/\n\s*const \[isMember,setIsMember\]=useState\(false\),\[joining,setJoining\]=useState\(false\),\[isLocked,setIsLocked\]=useState\(false\),\[members,setMembers\]=useState<any\[\]>\(\[\]\);/g;
const matches=[...g.matchAll(canonical)];
if(matches.length===0)throw new Error('GROUP_UI_V6_CANONICAL_STATE_MISSING');
if(matches.length>1){let kept=false;g=g.replace(canonical,m=>{if(kept)return '';kept=true;return m;});}

// Preserve the repaired horizontal composer and add its mobile/IME-safe input
// handler without replacing the textarea or its surrounding JSX.
const composer=/<textarea\b[^>]*aria-label="Write a message"[^>]*>/;
if(!composer.test(g))throw new Error('GROUP_UI_V6_COMPOSER_MISSING');
if(!g.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}') ){
  g=g.replace(/(<textarea\b[^>]*aria-label="Write a message"[^>]*value=\{draft\})(?=[^>]*>)/,'$1 onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}');
}

g=g.replace(/\s+capture=\{?['\"]environment['\"]\}?/g,'');

const stateChecks=[
  ['member',/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g],
  ['joining',/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g],
  ['lock',/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g],
  ['members',/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g]
];
for(const [name,re] of stateChecks){const count=(g.match(re)||[]).length;if(count!==1)throw new Error(`GROUP_UI_V6_STATE_NOT_CANONICAL:${name}:${count}`);}

for(const [name,re] of [
 ['join',/async\s+function\s+joinGroup\s*\(\s*\)/],
 ['info',/GROUP INFO/],
 ['members tab',/>MEMBERS<\/button>/],
 ['composer',/aria-label="Write a message"/],
 ['draft handler',/onChange=\{e=>setDraft\(e\.target\.value\)\}/],
 ['input handler',/onInput=\{e=>setDraft\(\(e\.target as HTMLTextAreaElement\)\.value\)\}/]
])if(!re.test(g))throw new Error(`GROUP_UI_V6_REQUIRED_MISSING:${name}`);

if(g.includes('capture="environment"'))throw new Error('GROUP_CAMERA_CAPTURE_REMAINS');
if(/onChange=\{e=\s*style=/.test(g))throw new Error('MALFORMED_TEXTAREA_HANDLER_REMAINS');
fs.writeFileSync(group,g);
console.log('Community UI v6 safe standalone deduplication passed.');
