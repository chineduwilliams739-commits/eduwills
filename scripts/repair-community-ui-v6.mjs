import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Earlier community passes can emit the same React state declarations with different
// whitespace or as separate lines. Normalize the known state declarations by removing
// every occurrence, then add one canonical declaration inside Group.
function resetState(name, setter, initializer){
  const re=new RegExp(`\\[\\s*${name}\\s*,\\s*${setter}\\s*\\]\\s*=\\s*useState\\s*\\(\\s*${initializer}\\s*\\)`,'g');
  g=g.replace(re,'');
  // Clean separators left when a state was part of a combined declaration.
  g=g.replace(/,\\s*,/g,',').replace(/const\\s*;/g,'');
}
resetState('isMember','setIsMember','false');
resetState('joining','setJoining','false');
resetState('isLocked','setIsLocked','false');
resetState('members','setMembers','\\[\\]');

const groupOpen='export default function Group(){';
if(!g.includes(groupOpen))throw new Error('GROUP_COMPONENT_MISSING');
g=g.replace(groupOpen,`${groupOpen}\n const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);`);

// Remove duplicate async handlers while preserving the first complete implementation.
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

// Remove legacy nested member-loader effects left by older repairs.
g=g.replace(/\n\s*useEffect\(\(\)=>\{let cancelled=false;const loadMembers=async\(\)=>[\s\S]*?\n\s*(?=async function joinGroup)/,'\n');

if(!g.includes('async function joinGroup'))throw new Error('GROUP_JOIN_FUNCTION_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');
if((g.match(/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_LOCK_STATE_NOT_CANONICAL');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
fs.writeFileSync(chat,c);
console.log('Community UI v6 source normalization, state canonicalization, duplicate cleanup, and validation passed.');
