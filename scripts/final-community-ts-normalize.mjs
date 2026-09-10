import fs from 'node:fs';

const path='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(path,'utf8');
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Final safety pass: remove every declaration variant for the four community
// state variables, then install one canonical declaration. This must remain
// tolerant of the preceding repair scripts' different formatting.
const bindings=[
  /\[isMember\s*,\s*setIsMember\]\s*=\s*useState\s*\(\s*false\s*\)/g,
  /\[joining\s*,\s*setJoining\]\s*=\s*useState\s*\(\s*false\s*\)/g,
  /\[isLocked\s*,\s*setIsLocked\]\s*=\s*useState\s*\(\s*false\s*\)/g,
  /\[members\s*,\s*setMembers\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g
];
for(const re of bindings)g=g.replace(re,'');
g=g.replace(/,\s*,/g,',').replace(/\[unread,setUnread\]=useState\(0\)\s*,\s*;/g,'[unread,setUnread]=useState(0);');
const canonical='const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);';
if(!g.includes(canonical)){
  const lines=g.split('\n'); let added=false;
  for(let i=0;i<lines.length;i++){
    if(lines[i].includes('[unread,setUnread]=useState(0)')){lines.splice(i+1,0,canonical);added=true;break;}
  }
  if(!added)throw new Error('FINAL_GROUP_STATE_MARKER_NOT_FOUND');
  g=lines.join('\n');
}

// Preserve exactly one joinGroup implementation if an earlier pass left a
// one-line duplicate. Do not require a particular formatting style.
const joins=[...g.matchAll(/async function joinGroup\(\)/g)].map(m=>m.index||0);
if(joins.length===0)throw new Error('FINAL_JOIN_FUNCTION_MISSING');
if(joins.length>1){
  const re=/\n\s*async function joinGroup\(\)\{[^\n]*\}\n/g;
  let first=true;
  g=g.replace(re,m=>{if(first){first=false;return m}return '\n'});
}

// The member loader is allowed once; older v4/v5 passes may have emitted a
// duplicate one-line implementation.
const loaderRe=/\n\s*async function loadMembers\(ids:any\[\]\)\{[^\n]*\}\n/g;
let firstLoader=true;
g=g.replace(loaderRe,m=>{if(firstLoader){firstLoader=false;return m}return '\n'});
if(!g.includes('async function loadMembers'))throw new Error('FINAL_MEMBER_LOADER_MISSING');

if(!g.includes('GROUP INFO'))throw new Error('FINAL_GROUP_INFO_MISSING');
if(!g.includes('>MEMBERS</button>'))throw new Error('FINAL_MEMBERS_TAB_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('FINAL_GROUP_COMPOSER_MISSING');
if(g.includes('fixed inset-0 z-50')&&g.includes('>Group info</h2>'))throw new Error('FINAL_FLOATING_GROUP_INFO_REMAINS');
if(/onChange=\{e=\s*style=/.test(g))throw new Error('FINAL_MALFORMED_TEXTAREA_HANDLER_REMAINS');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('FINAL_DUPLICATE_MESSAGE_CONTROL');

fs.writeFileSync(path,g);
console.log('Final community TypeScript normalization passed.');
