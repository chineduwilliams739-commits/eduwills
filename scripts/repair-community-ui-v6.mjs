import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Normalize accidental literal backslash+n separators left by older deterministic repairs.
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Older repairs could leave a nested member loader immediately before the canonical
// standalone loader. Remove only that known nested loader block.
const nestedStart=' useEffect(()=>{let cancelled=false;const loadMembers=async()=>';
const nestedEnd='\n async function joinGroup';
const ns=g.indexOf(nestedStart);
const ne=ns>=0?g.indexOf(nestedEnd,ns):-1;
if(ns>=0&&ne>ns)g=g.slice(0,ns)+g.slice(ne+1);

// Validate semantic source markers rather than requiring a particular whitespace style.
const count=(needle)=>g.split(needle).length-1;
if(count('async function loadMembers')!==1)throw new Error('GROUP_MEMBER_LOADER_NOT_CANONICAL');
if(count('async function joinGroup')!==1)throw new Error('GROUP_JOIN_FUNCTION_NOT_CANONICAL');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');

fs.writeFileSync(chat,c);
console.log('Community UI v6 source normalization and validation passed.');
