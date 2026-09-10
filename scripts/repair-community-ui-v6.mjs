import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

const groupOpen='export default function Group(){';
const authEffect='useEffect(()=>onAuthStateChanged';
const open=g.indexOf(groupOpen);
const auth=g.indexOf(authEffect,open);
if(open<0)throw new Error('GROUP_COMPONENT_MISSING');
if(auth<0)throw new Error('GROUP_AUTH_EFFECT_MISSING');

g=g.replace(/,isLocked=g\?\.messagingLocked===true(?=;)/g,'');
g=g.replace(/,\s*isLocked\s*=\s*g\?\.messagingLocked===true(?=;)/g,'');

let header=g.slice(open+groupOpen.length,auth);
header=header.replace(/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,'');
header=header.replace(/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,'');
header=header.replace(/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,'');
header=header.replace(/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)\s*,?/g,'');
header=header.replace(/,\s*,/g,',').replace(/\(\s*,/g,'(').replace(/,\s*;/g,';');
header=header.replace(/\bconst\s*;\s*/g,'');
header=header.replace(/\s*const\s+\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*;?/g,'');
header=header.replace(/\s*const\s+\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*;?/g,'');
header=header.replace(/\s*const\s+\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*;?/g,'');
header=header.replace(/\s*const\s+\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)\s*;?/g,'');

const canonical='\n const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);\n ';
g=g.slice(0,open+groupOpen.length)+canonical+header+g.slice(auth);

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

// Final Community UI normalization: repair the v7 inline-info JSX closer,
// force horizontal composer flow, and remove duplicate MESSAGE CONTROL cards.
g=g.replace(/<\/section><header/g,'</section>}<header');
g=g.replace(/(<textarea\b[^>]*aria-label="Write a message"[^>]*)\sstyle=\{\{[^}]*\}\}/g,'$1');
if(g.includes('aria-label="Write a message"') && !g.includes("style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}")){
  g=g.replace(/(<textarea\b[^>]*aria-label="Write a message"[^>]*)>/g,"$1 style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}>");
}
function removeDuplicateMessageControls(source){
  const marker='MESSAGE CONTROL';
  const first=source.indexOf(marker);
  if(first<0)return source;
  while(true){
    const second=source.indexOf(marker,first+marker.length);
    if(second<0)break;
    const start=source.lastIndexOf('<section',second);
    if(start<0)throw new Error('MESSAGE_CONTROL_PARENT_NOT_FOUND');
    const tokenRe=/<\/?section\b[^>]*>/g;
    tokenRe.lastIndex=start;
    let depth=0,end=-1,m;
    while((m=tokenRe.exec(source))){
      if(m[0][1]==='/')depth--;else depth++;
      if(depth===0){end=m.index+m[0].length;break;}
    }
    if(end<0)throw new Error('MESSAGE_CONTROL_SECTION_UNBALANCED');
    source=source.slice(0,start)+source.slice(end);
  }
  return source;
}
g=removeDuplicateMessageControls(g);

const count=(needle)=>(g.match(needle)||[]).length;
if(count(/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_MEMBER_STATE_NOT_CANONICAL');
if(count(/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_JOINING_STATE_NOT_CANONICAL');
if(count(/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_LOCK_STATE_NOT_CANONICAL');
if(count(/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g)!==1)throw new Error('GROUP_MEMBERS_STATE_NOT_CANONICAL');
if(/\bisLocked\s*=\s*g\?\.messagingLocked===true/.test(g))throw new Error('GROUP_DERIVED_LOCK_COLLISION');
if(!g.includes('async function joinGroup'))throw new Error('GROUP_JOIN_FUNCTION_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('DUPLICATE_MESSAGE_CONTROL_CARD');
if(/<\/section><header/.test(g))throw new Error('GROUP_INFO_JSX_CLOSER_MISSING');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
fs.writeFileSync(chat,c);
console.log('Community UI v6 source normalization, lock-collision cleanup, JSX normalization, duplicate lock-card cleanup, and validation passed.');
