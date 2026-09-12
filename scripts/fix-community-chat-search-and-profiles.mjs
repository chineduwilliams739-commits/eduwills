import fs from 'fs';

function edit(path, transforms) {
  let s = fs.readFileSync(path, 'utf8');
  const before = s;
  for (const [name, fn] of transforms) {
    const next = fn(s);
    if (next !== s) console.log(`APPLIED ${path}: ${name}`);
    else console.log(`NO-OP ${path}: ${name}`);
    s = next;
  }
  if (s !== before) fs.writeFileSync(path, s);
}

edit('app/dashboard/community/chat/page.tsx', [
  ['profile people state', s => s.replace(
    "[search,setSearch]=useState(''),[results,setResults]=useState<any[]>([]),",
    "[search,setSearch]=useState(''),[results,setResults]=useState<any[]>([]),[searching,setSearching]=useState(false),[profilePeople,setProfilePeople]=useState<Record<string,any>>({}),"
  )],
  ['richer public display fields', s => s.replace(
    "const display=(d:any)=>({uid:String(d?.uid||''),username:String(d?.username||''),fullName:String(d?.fullName||d?.name||d?.username||'Learner'),photoURL:String(d?.photoURL||d?.avatarUrl||'')});",
    "const display=(d:any)=>({uid:String(d?.uid||''),username:String(d?.username||d?.usernameLower||''),fullName:String(d?.fullName||d?.displayName||d?.name||d?.username||'Learner'),photoURL:String(d?.photoURL||d?.avatarUrl||d?.profilePhotoURL||d?.profileImageUrl||d?.imageUrl||'')});"
  )],
  ['replace faulty search', s => {
    const a = s.indexOf(" useEffect(()=>{let cancelled=false;async function find(){");
    const b = s.indexOf(" const chatRows=useMemo", a);
    if (a < 0 || b < 0) return s;
    const fn = ` useEffect(()=>{let cancelled=false;async function find(){const term=search.trim().toLowerCase();setNotice('');if(!term){setResults([]);setSearching(false);return}setSearching(true);try{const out:any[]=[];const seen=new Set<string>();const add=(d:any,id?:string)=>{const uid=String(d?.uid||id||'');if(!uid||uid===user?.uid||seen.has(uid))return;const un=String(d?.username||d?.usernameLower||'').toLowerCase();const name=String(d?.fullName||d?.displayName||d?.name||'').toLowerCase();if(un.includes(term)||name.includes(term)){out.push(display({...d,uid,username:d?.username||d?.usernameLower||''}));seen.add(uid)}};const pub=await getDocs(query(collection(db,'publicUserIndex'),limit(500)));for(const x of pub.docs){add(x.data(),x.id);if(out.length>=20)break}if(out.length<20){const idx=await getDocs(query(collection(db,'usernameIndex'),limit(500)));for(const x of idx.docs){add(x.data(),x.id);if(out.length>=20)break}}if(!cancelled){setResults(out);if(!out.length)setNotice('No learner found. Check the name or username and try again.')}}catch(e:any){if(!cancelled){setResults([]);setNotice(e?.message||'User search failed.')}}finally{if(!cancelled)setSearching(false)}}find();return()=>{cancelled=true}},[search,user?.uid]);\n\n useEffect(()=>{if(!user)return;let cancelled=false;async function hydrateChatProfiles(){try{const ids=[...new Set(chats.flatMap((c:any)=>Array.isArray(c.participantIds)?c.participantIds:[]).filter((uid:string)=>uid!==user.uid))];if(!ids.length){setProfilePeople({});return}const snap=await getDocs(query(collection(db,'publicUserIndex'),limit(1000)));const map:Record<string,any>={};for(const x of snap.docs){const d=x.data()||{};const uid=String(d.uid||'');if(uid&&ids.includes(uid))map[uid]=display({...d,uid})}if(!cancelled)setProfilePeople(map)}catch{if(!cancelled)setProfilePeople({})}}hydrateChatProfiles();return()=>{cancelled=true}},[user?.uid,chats]);\n`;
    return s.slice(0, a) + fn + s.slice(b);
  }],
  ['use hydrated profile in chat rows', s => s.replace(
    "person:display(c.participantProfiles?.[other]||{uid:other,username:c.otherUsername,fullName:c.otherName,photoURL:c.otherPhotoURL})",
    "person:display(profilePeople[other]||c.participantProfiles?.[other]||{uid:other,username:c.otherUsername,fullName:c.otherName,photoURL:c.otherPhotoURL})"
  ).replace(
    "[chats,user?.uid,previews]);",
    "[chats,user?.uid,previews,profilePeople]);"
  )],
  ['search result indicator', s => s.replace(
    '<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or username…" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"/>',
    '<input value={search} onChange={e=>{setSearch(e.target.value);if(!e.target.value.trim()){setResults([]);setNotice(\'\')}}} placeholder="Search by name or username…" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"/>{searching&&<span className="text-[10px] font-black text-cyan-700">Searching…</span>}'
  )],
  ['show chat notices', s => s.replace(
    '</header>\n <div className="mx-auto grid',
    '</header>\n {notice&&<div className="mx-auto mt-3 max-w-6xl px-3 sm:px-5"><div className="rounded-2xl bg-cyan-50 px-4 py-3 text-xs font-bold text-cyan-950">{notice}</div></div>}\n <div className="mx-auto grid'
  )],
  ['incoming message avatar', s => {
    const marker = "{m.imageUrl&&<img src={m.imageUrl} className=\"mb-2 max-h-72 rounded-xl object-cover\"/>}";
    if (!s.includes(marker) || s.includes("m.senderPhotoURL&&<img src={m.senderPhotoURL}")) return s;
    return s.replace(marker, "{m.senderId!==user.uid&&m.senderPhotoURL&&<img src={m.senderPhotoURL} alt=\"\" className=\"mb-2 h-8 w-8 rounded-full object-cover\"/>}" + marker);
  }]
]);

edit('app/dashboard/personal/page.tsx', [
  ['server timestamp import', s => s.replace(
    "import {doc,getDoc,setDoc} from 'firebase/firestore';",
    "import {doc,getDoc,serverTimestamp,setDoc} from 'firebase/firestore';"
  )],
  ['mirror profile photo to public index', s => s.replace(
    "await setDoc(doc(db,'users',user.uid),{photoURL:url,avatarUrl:url,photoModerationStatus:'pending'},{merge:true});setProfile",
    "await setDoc(doc(db,'users',user.uid),{photoURL:url,avatarUrl:url,photoModerationStatus:'pending'},{merge:true});if(profile.publicId)await setDoc(doc(db,'publicUserIndex',profile.publicId),{uid:user.uid,publicId:profile.publicId,username:profile.username||'',fullName:profile.fullName||'',photoURL:url,avatarUrl:url,updatedAt:serverTimestamp()},{merge:true});setProfile"
  )]
]);

const chat = fs.readFileSync('app/dashboard/community/chat/page.tsx','utf8');
const personal = fs.readFileSync('app/dashboard/personal/page.tsx','utf8');
if (!chat.includes('setProfilePeople') || !chat.includes("publicUserIndex") || !chat.includes('profilePeople[other]')) throw new Error('Chat profile/search repair was not applied');
if (!personal.includes("publicUserIndex", personal.indexOf('async function photo'))) throw new Error('Profile photo public-index sync was not applied');
console.log('Community chat search/profile-image repair verified.');
