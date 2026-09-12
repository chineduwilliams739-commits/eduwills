import fs from 'node:fs';

const path = 'app/dashboard/community/chat/page.tsx';
let s = fs.readFileSync(path, 'utf8');

// Recent Chats must contain direct chats only. Groups are displayed in the Groups
// area of the Community page, not mixed into the direct-message recents list.
const oldRecent = 'const recentRows=useMemo(()=>[...chatRows,...groupRows].sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)),[chatRows,groupRows]);';
const newRecent = 'const recentRows=useMemo(()=>[...chatRows].sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)),[chatRows]);';
if (s.includes(oldRecent)) s = s.replace(oldRecent, newRecent);

// The search implementation uses the username index and performs a name/username
// fallback scan. Normalize the placeholder without depending on Unicode punctuation.
s = s.replace(/placeholder="Search by name or username(?:…|\.\.\.)?"/g, 'placeholder="Search by name or username"');

// CI repair ordering can cause the legacy community-controls repair to insert the
// searching state more than once. Normalize the declaration structurally instead of
// relying on one exact surrounding state string. Remove every existing declaration,
// then insert exactly one immediately before profilePeople. This is idempotent.
const searchingState = '[searching,setSearching]=useState(false)';
const escapedSearchingState = searchingState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
s = s.replace(new RegExp(escapedSearchingState + ',?', 'g'), '');
const profileStateAnchor = '[profilePeople,setProfilePeople]';
if (s.includes(profileStateAnchor)) {
  s = s.replace(profileStateAnchor, `${searchingState},${profileStateAnchor}`);
} else {
  throw new Error('COMMUNITY_CHAT_SEARCH_STATE_ANCHOR_MISSING');
}

// Resolve chat participants from publicUserIndex first, then fall back to the
// users collection. This keeps profile images visible even for older accounts
// whose public index entry is incomplete.
const profileStart=s.indexOf(" useEffect(()=>{if(!user)return;let cancelled=false;async function hydrateChatProfiles()");
const profileEndMarker="},[user?.uid,chats]);";
const profileEnd=profileStart>=0?s.indexOf(profileEndMarker,profileStart):-1;
if(profileStart>=0&&profileEnd>profileStart){
  const profileBlock=` useEffect(()=>{if(!user)return;let cancelled=false;async function hydrateChatProfiles(){try{const ids=[...new Set(chats.flatMap((c:any)=>Array.isArray(c.participantIds)?c.participantIds:[]).filter((uid:string)=>uid!==user.uid))];if(!ids.length){setProfilePeople({});return}const map:Record<string,any>={};const pub=await getDocs(query(collection(db,'publicUserIndex'),limit(1000)));for(const x of pub.docs){const d=x.data()||{};const uid=String(d.uid||x.id||'');if(uid&&ids.includes(uid))map[uid]=display({...d,uid})}const missing=ids.filter(uid=>!map[uid]);if(missing.length){const users=await getDocs(query(collection(db,'users'),limit(1000)));for(const x of users.docs){if(!missing.includes(x.id))continue;const d=x.data()||{};map[x.id]=display({...d,uid:x.id})}}if(!cancelled)setProfilePeople(map)}catch{if(!cancelled)setProfilePeople({})}}hydrateChatProfiles();return()=>{cancelled=true}}`;
  s=s.slice(0,profileStart)+profileBlock+s.slice(profileEnd+profileEndMarker.length);
}

if (!s.includes('Search by name or username')) throw new Error('COMMUNITY_CHAT_SEARCH_UI_NOT_FOUND');
if (!s.includes('usernameIndex') || !s.includes('name.includes(term)') || !s.includes('un.includes(term)')) throw new Error('COMMUNITY_CHAT_SEARCH_IMPLEMENTATION_NOT_FOUND');
if (s.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]')) throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
if ((s.split(searchingState).length-1) !== 1) throw new Error('COMMUNITY_CHAT_SEARCH_STATE_DUPLICATED');
if (!s.includes('publicUserIndex') || !s.includes("collection(db,'users')")) throw new Error('COMMUNITY_CHAT_PROFILE_FALLBACK_MISSING');

fs.writeFileSync(path, s);
console.log('Community chat search, direct-chat recents, and participant profile hydration repaired.');
