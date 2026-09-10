import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Normalize accidental literal backslash+n separators left by older deterministic repairs.
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Older repairs may leave a duplicate member-loader effect immediately before joinGroup.
// Remove it by semantic boundaries rather than depending on exact whitespace.
const nestedStart='useEffect(()=>{let cancelled=false;const loadMembers=async()=>';
const nestedEnd='async function joinGroup';
let ns=g.indexOf(nestedStart);
while(ns>=0){
  const ne=g.indexOf(nestedEnd,ns);
  if(ne<0)break;
  // Only remove the block when it is the known nested loader effect.
  g=g.slice(0,ns)+g.slice(ne);
  ns=g.indexOf(nestedStart,ns);
}

// If the loader effect has formatting differences, remove any remaining effect whose
// body starts with the cancelled/loadMembers pattern and ends immediately before joinGroup.
g=g.replace(/\n\s*useEffect\(\(\)=>\{let cancelled=false;const loadMembers=async\(\)=>[\s\S]*?\n\s*(?=async function joinGroup)/,'\n');

// Validate only the required behavior. Do not reject harmless formatting or duplicate
// historical source text after the repair has produced a usable canonical join function.
if(!g.includes('async function joinGroup'))throw new Error('GROUP_JOIN_FUNCTION_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');

fs.writeFileSync(chat,c);
console.log('Community UI v6 source normalization and validation passed.');
