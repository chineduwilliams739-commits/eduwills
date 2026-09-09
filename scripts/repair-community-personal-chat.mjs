import fs from 'fs';
function edit(path, transforms){let s=fs.readFileSync(path,'utf8');const before=s;for(const[name,fn]of transforms){const next=fn(s);if(next!==s){console.log(`APPLIED ${path}: ${name}`);s=next}else console.log(`NO-OP ${path}: ${name}`)}if(s!==before)fs.writeFileSync(path,s)}

edit('app/dashboard/personal/page.tsx',[]);

edit('app/dashboard/community/chat/page.tsx',[
 ['search state',s=>s.replace("[search,setSearch]=useState(''),[results,setResults]=useState<any[]>([]),","[search,setSearch]=useState(''),[results,setResults]=useState<any[]>([]),[searching,setSearching]=useState(false),")],
 ['search implementation',s=>{
   const a=s.indexOf(" useEffect(()=>{let cancelled=false;async function find(){");
   const b=s.indexOf(" const chatRows=useMemo",a);
   if(a<0||b<0)return s;
   const fn=" useEffect(()=>{let cancelled=false;async function find(){const term=search.trim().toLowerCase();setNotice('');if(!term){setResults([]);setSearching(false);return}setSearching(true);try{const out:any[]=[];const seen=new Set<string>();const add=(d:any,id?:string)=>{const uid=String(d?.uid||id||'');if(!uid||uid===user?.uid||seen.has(uid))return;const un=String(d?.username||d?.usernameLower||'').toLowerCase();const name=String(d?.fullName||d?.displayName||d?.name||'').toLowerCase();if(un.includes(term)||name.includes(term)) {out.push(display({...d,uid,username:d?.username||d?.usernameLower||''}));seen.add(uid)}};const publicSnap=await getDocs(query(collection(db,'publicUserIndex'),limit(500)));for(const x of publicSnap.docs){add(x.data(),x.id);if(out.length>=20)break}if(out.length<20){const snap=await getDocs(query(collection(db,'usernameIndex'),limit(500)));for(const x of snap.docs){add(x.data(),x.id);if(out.length>=20)break}}if(!cancelled){setResults(out);if(!out.length)setNotice('No learner found. Check the name or username and try again.')}}catch(e:any){if(!cancelled){setResults([]);setNotice(e?.message||'User search failed.')}}finally{if(!cancelled)setSearching(false)}}find();return()=>{cancelled=true}},[search,user?.uid]);\n";
   return s.slice(0,a)+fn+s.slice(b)
 }],
 ['search input',s=>s.replace('<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or username…" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"/>','<input value={search} onChange={e=>{setSearch(e.target.value);if(!e.target.value.trim()){setResults([]);setNotice(\'\')}}} onKeyDown={e=>{if(e.key===\'Enter\'){e.preventDefault();}}} placeholder="Search by name or username…" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"/>{searching&&<span className="text-[10px] font-black text-cyan-700">Searching…</span>}')],
 ['search notice',s=>s.replace('</header>\n <div className="mx-auto grid','</header>\n {notice&&<div className="mx-auto mt-3 max-w-6xl px-3 sm:px-5"><div className="rounded-2xl bg-cyan-50 px-4 py-3 text-xs font-bold text-cyan-950">{notice}</div></div>}\n <div className="mx-auto grid')],
 ['direct recent only',s=>s.replace("const recentRows=useMemo(()=>[...chatRows,...groupRows].sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)),[chatRows,groupRows]);","const recentRows=useMemo(()=>[...chatRows].filter((c:any)=>Boolean(c.lastMessage||previews[`chat:${c.id}`])).sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,50),[chatRows,previews]);")]
]);

edit('app/dashboard/community/page.tsx',[
 ['joined groups heading',s=>s.replace('YOUR GROUPS</p><h2 className="text-2xl font-black">Your communities</h2>','JOINED GROUPS</p><h2 className="text-2xl font-black">Joined Groups</h2>')],
 ['joined groups empty copy',s=>s.replace('You have no groups yet. Create one and it will appear here immediately.','You have not joined any groups yet. Join a suggested group or create one and it will appear here immediately.')]
]);

edit('app/dashboard/community/group/page.tsx',[]);
edit('components/DeviceImageUpload.tsx',[]);
