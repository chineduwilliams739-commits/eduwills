import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Normalize duplicate community state declarations introduced by earlier repair passes.
// Keep the first declaration and remove later duplicates for the known state variables.
const stateNames=['isMember','joining','isLocked','members'];
for(const name of stateNames){
  const re=new RegExp(`,\\[${name},set${name.charAt(0).toUpperCase()+name.slice(1)}\\]=useState\\([^;]+\\);`,'g');
  let matches=[...g.matchAll(re)];
  if(matches.length>1){
    for(let i=matches.length-1;i>0;i--)g=g.slice(0,matches[i].index)+g.slice(matches[i].index+matches[i][0].length);
  }
}
// Specific legacy combined declaration variants.
g=g.replace(/(\[unread,setUnread\]=useState\(0\)),\[isMember,setIsMember\]=useState\(false\),\[joining,setJoining\]=useState\(false\),\[isLocked,setIsLocked\]=useState\(false\);/g,'$1;');
g=g.replace(/(\[unread,setUnread\]=useState\(0\)),\[isMember,setIsMember\]=useState\(false\),\[joining,setJoining\]=useState\(false\);/g,'$1;');

// Remove duplicate named async handlers while preserving the first complete implementation.
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

// Remove legacy nested member-loader effect immediately before joinGroup.
const nestedStart='useEffect(()=>{let cancelled=false;const loadMembers=async()=>';
const nestedEnd='async function joinGroup';
let ns=g.indexOf(nestedStart);
while(ns>=0){
  const ne=g.indexOf(nestedEnd,ns);
  if(ne<0)break;
  g=g.slice(0,ns)+g.slice(ne);
  ns=g.indexOf(nestedStart,ns);
}
g=g.replace(/\n\s*useEffect\(\(\)=>\{let cancelled=false;const loadMembers=async\(\)=>[\s\S]*?\n\s*(?=async function joinGroup)/,'\n');

// Explicitly guarantee exactly one lock state declaration. If an earlier pass left
// duplicates in a combined declaration, retain the first occurrence and normalize it.
const lockDecl='[isLocked,setIsLocked]=useState(false)';
let lockAt=g.indexOf(lockDecl);
if(lockAt>=0){
  let after=lockAt+lockDecl.length;
  while((after=g.indexOf(lockDecl,after))>=0){
    const commaStart=g.lastIndexOf(',',after);
    const semicolon=g.indexOf(';',after);
    if(commaStart>=0&&commaStart>g.lastIndexOf('\n',after))g=g.slice(0,commaStart)+g.slice(after+lockDecl.length);
    else g=g.slice(0,after)+g.slice(after+lockDecl.length);
  }
}

if(!g.includes('async function joinGroup'))throw new Error('GROUP_JOIN_FUNCTION_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');
if((g.match(/\[isLocked,setIsLocked\]=useState\(false\)/g)||[]).length!==1)throw new Error('GROUP_LOCK_STATE_NOT_CANONICAL');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
fs.writeFileSync(chat,c);
console.log('Community UI v6 source normalization, duplicate cleanup, and validation passed.');
