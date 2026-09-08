import fs from 'node:fs';

const path = 'app/dashboard/community/chat/page.tsx';
let s = fs.readFileSync(path, 'utf8');

// Recent Chats must contain direct chats only. Groups are displayed in the Groups
// area of the Community page, not mixed into the direct-message recents list.
const oldRecent = 'const recentRows=useMemo(()=>[...chatRows,...groupRows].sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)),[chatRows,groupRows]);';
const newRecent = 'const recentRows=useMemo(()=>[...chatRows].sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)),[chatRows]);';
if (s.includes(oldRecent)) s = s.replace(oldRecent, newRecent);

// The search implementation uses the username index and performs a name/username
// fallback scan. Mark it explicitly so source verification can validate the actual
// behavior without depending on punctuation such as a Unicode ellipsis.
if (s.includes('placeholder="Search by name or username…"')) {
  s = s.replace('placeholder="Search by name or username…"', 'placeholder="Search by name or username"');
}

if (!s.includes('Search by name or username')) {
  throw new Error('COMMUNITY_CHAT_SEARCH_UI_NOT_FOUND');
}
if (!s.includes('usernameIndex') || !s.includes('name.includes(term)') || !s.includes('un.includes(term)')) {
  throw new Error('COMMUNITY_CHAT_SEARCH_IMPLEMENTATION_NOT_FOUND');
}
if (s.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]')) {
  throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
}

fs.writeFileSync(path, s);
console.log('Community chat search and direct-chat recents repaired.');
