import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Normalize accidental literal backslash+n separators left by older deterministic repairs.
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Earlier community-control repairs could add membership/lock state to the main
// useState declaration even though a dedicated declaration already exists below it.
// Keep the dedicated declaration and remove only the duplicate fields from the main
// declaration. This is the root cause of the TS2451 failures seen after v6.
g=g.replace(/(\[unread,setUnread\]=useState\(0\)),\[isMember,setIsMember\]=useState\(false\),\[joining,setJoining\]=useState\(false\),\[isLocked,setIsLocked\]=useState\(false\);/g,'$1;');
g=g.replace(/(\[unread,setUnread\]=useState\(0\)),\[isMember,setIsMember\]=useState\(false\),\[joining,setJoining\]=useState\(false\);/g,'$1;');

// Remove a duplicate named async function while preserving its first implementation.
// These repairs only target the small named handlers on this page; balanced braces keep
// object literals and nested blocks inside the retained implementation intact.
function dedupeAsync(name){
  const marker=`async function ${name}(`;
  let first=g.indexOf(marker);
  if(first<0)return;
  let from=first+marker.length;
  let brace=g.indexOf('{',from);
  if(brace<0)return;
  const endOf=(start)=>{
    let depth=0,quote='',escape=false,lineComment=false,blockComment=false;
    for(let i=start;i<g.length;i++){
      const ch=g[i],next=g[i+1];
      if(lineComment){if(ch==='\n')lineComment=false;continue}
      if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++}continue}
      if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote='';continue}
      if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
      if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
      if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
      if(ch==='{')depth++;
      else if(ch==='}'&&--depth===0)return i+1;
    }
    return -1;
  };
  const firstEnd=endOf(brace);
  if(firstEnd<0)return;
  while(true){
    const next=g.indexOf(marker,firstEnd);
    if(next<0)break;
    const nextBrace=g.indexOf('{',next+marker.length);
    if(nextBrace<0)break;
    const nextEnd=endOf(nextBrace);
    if(nextEnd<0)break;
    g=g.slice(0,next)+g.slice(nextEnd);
  }
}

['joinGroup','loadMembers','toggleLock','acknowledge'].forEach(dedupeAsync);

// Remove any legacy nested member-loader effect left immediately before joinGroup.
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

if(!g.includes('async function joinGroup'))throw new Error('GROUP_JOIN_FUNCTION_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
fs.writeFileSync(chat,c);
console.log('Community UI v6 source normalization, duplicate cleanup, and validation passed.');
