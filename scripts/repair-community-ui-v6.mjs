import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Normalize accidental two-character literal "\\n" separators left by earlier
// deterministic repairs. These are source separators, not intended string data.
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Keep the v6 guard deterministic: the repaired group source must contain exactly
// one standalone member loader and join helper plus the required member UI/composer.
const count=(re)=>((g.match(re)||[]).length);
if(count(/async function loadMembers\s*\([^)]*\)\s*\{/g)!==1)throw new Error('GROUP_MEMBER_LOADER_NOT_CANONICAL');
if(count(/async function joinGroup\s*\(\s*\)\s*\{/g)!==1)throw new Error('GROUP_JOIN_FUNCTION_NOT_CANONICAL');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP MEMBERS'))throw new Error('GROUP_INFO_PANEL_MISSING');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');

fs.writeFileSync(chat,c);
console.log('Community UI v6 source normalization and validation passed.');
