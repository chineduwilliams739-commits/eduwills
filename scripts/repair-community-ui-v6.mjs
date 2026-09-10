import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Normalize accidental literal backslash+n separators left by older deterministic repairs.
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

const groupOpen='export default function Group(){';
const authEffect='useEffect(()=>onAuthStateChanged';
const open=g.indexOf(groupOpen);
const auth=g.indexOf(authEffect,open);
if(open<0)throw new Error('GROUP_COMPONENT_MISSING');
if(auth<0)throw new Error('GROUP_AUTH_EFFECT_MISSING');

// Older Community passes have two different meanings for "isLocked": v2 creates the
// React state, while implement-community-controls adds a derived const with the same
// name. TypeScript rejects that collision. Keep the React state as the single source
// of truth and remove only the derived binding.
g=g.replace(/,isLocked=g\?\.messagingLocked===true(?=;)/g,'');
g=g.replace(/,\s*isLocked\s*=\s*g\?\.messagingLocked===true(?=;)/g,'');

// Canonicalize the four community state declarations in the component header.
let header=g.slice(open+groupOpen.length,auth);
header=header.replace(/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,'');
header=header.replace(/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,'');
header=header.replace(/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,'');
header=header.replace(/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)\s*,?/g,'');
header=header.replace(/,\s*,/g,',').replace(/\(\s*,/g,'(').replace(/,\s*;/g,';');
header=header.replace(/\bconst\s*;\s*/g,'');

// Remove standalone variants of these states from the header as well.
header=header.replace(/\s*const\s+\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*;?/g,'');
header=header.replace(/\s*const\s+\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*;?/g,'');
header=header.replace(/\s*const\s+\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*;?/g,'');
header=header.replace(/\s*const\s+\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)\s*;?/g,'');

const canonical='\n const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);\n ';
g=g.slice(0,open+groupOpen.length)+canonical+header+g.slice(auth);

// Keep only the first complete copy of each async handler.
function dedupeAsync(name){
  const marker=`async function ${name}(`;
  const first=g.indexOf(marker);
  if(first<0)return;
  const brace=g.indexOf('{',first+marker.length);
  if(brace<0)return;
  const endOf=(start)=>{
    let depth=0,quote='',escape=false,line=false,block=false;
    for(let i=start;i<g.length;i++){
      const ch=g[i],next=g[i+1];
      if(line){if(ch==='\n')line=false;continue}
      if(block){if(ch==='*'&&next==='/'){block=false;i++}continue}
      if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote='';continue}
      if(ch==='/'&&next==='/'){line=true;i++;continue}
      if(ch==='/'&&next==='*'){block=true;i++;continue}
      if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
      if(ch==='{')depth++;
      else if(ch==='}'&&--depth===0)return i+1;
    }
    return -1;
  };
  const firstEnd=endOf(brace);
  if(firstEnd<0)return;
  let searchFrom=firstEnd;
  while(true){
    const next=g.indexOf(marker,searchFrom);
    if(next<0)break;
    const nextBrace=g.indexOf('{',next+marker.length);
    if(nextBrace<0)break;
    const nextEnd=endOf(nextBrace);
    if(nextEnd<0)break;
    g=g.slice(0,next)+g.slice(nextEnd);
  }
}
['joinGroup','loadMembers','toggleLock','acknowledge'].forEach(dedupeAsync);

g=g.replace(/\n\s*useEffect\(\(\)=>\{let cancelled=false;const loadMembers=async\(\)=>[\s\S]*?\n\s*(?=async function joinGroup)/,'\n');

// Validation checks both the React state declaration and the absence of the old
// derived-name collision, so a future repair cannot silently recreate TS2451.
const count=(needle)=>(g.match(needle)||[]).length;
if(count(/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_MEMBER_STATE_NOT_CANONICAL');
if(count(/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_JOINING_STATE_NOT_CANONICAL');
if(count(/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_LOCK_STATE_NOT_CANONICAL');
if(count(/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g)!==1)throw new Error('GROUP_MEMBERS_STATE_NOT_CANONICAL');
if(/\bisLocked\s*=\s*g\?\.messagingLocked===true/.test(g))throw new Error('GROUP_DERIVED_LOCK_COLLISION');
if(!g.includes('async function joinGroup'))throw new Error('GROUP_JOIN_FUNCTION_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
fs.writeFileSync(chat,c);
console.log('Community UI v6 source normalization, lock-collision cleanup, canonical header rebuild, duplicate cleanup, and validation passed.');
