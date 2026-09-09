import fs from 'node:fs';

// Cloudinary is used for all client-side EduWills image uploads. These values are
// intentionally public browser configuration (cloud name + unsigned preset), not
// Cloudinary API credentials or secrets.
const envPath='.env.production';
let env=fs.existsSync(envPath)?fs.readFileSync(envPath,'utf8'):'';
const setEnv=(key,value)=>{
  const line=`${key}=${value}`;
  const re=new RegExp(`^${key}=.*$`,'m');
  env=re.test(env)?env.replace(re,line):`${env}${env.endsWith('\n')||!env?'':'\n'}${line}\n`;
};
setEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME','ds7zf362');
setEnv('NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET','EDUWILLS');
fs.writeFileSync(envPath,env);

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// A group admin must still be able to type/send while member sending is locked.
g=g.replace(
  "async function send(){if((!draft.trim()&&!image)||!user||!isMember||isLocked)return;",
  "async function send(){if((!draft.trim()&&!image)||!user||!isMember||(isLocked&&!isAdmin))return;"
);
g=g.replace(/disabled=\{isLocked\}/g,'disabled={isLocked&&!isAdmin}');
g=g.replace(/disabled=\{isLocked === true\}/g,'disabled={isLocked&&!isAdmin}');
if (g.includes('placeholder="Write a message') && g.includes('onChange={e=>setDraft(e.target.value)}')) {
  g=g.replace('readOnly={isLocked}', 'readOnly={isLocked&&!isAdmin}');
}

// Restore real member names in Group Info. UIDs are resolved against the users
// collection and missing profiles get a safe Learner fallback.
if(!g.includes('[members,setMembers]')){
  const marker="const[user,setUser]=useState<any>(null),[profile,setProfile]=useState<any>({}),[g,setG]=useState<any>(null),";
  if(g.includes(marker)) g=g.replace(marker,marker+"[members,setMembers]=useState<any[]>([]),");
}
if(!g.includes('async function loadMembers')){
  const marker=' async function acknowledge(){';
  const fn=" async function loadMembers(ids:any[]){const list=Array.isArray(ids)?ids.filter(Boolean):[];try{const rows=await Promise.all(list.map(async uid=>{try{const s=await getDoc(doc(db,'users',String(uid)));const d=s.data()||{};return {uid:String(uid),fullName:String(d.fullName||d.name||d.username||'Learner'),username:String(d.username||''),photoURL:String(d.photoURL||d.avatarUrl||'')};}catch{return {uid:String(uid),fullName:'Learner',username:'',photoURL:''}}}));setMembers(rows);}catch{setMembers([])}}\n";
  if(g.includes(marker)) g=g.replace(marker,fn+marker);
}
if(g.includes('setG(d);setName(') && !g.includes('loadMembers(d.memberIds||[])')){
  g=g.replace('setG(d);setName(', 'setG(d);loadMembers(d.memberIds||[]);setName(');
}

// Remove stacked unread badges from earlier repairs; keep one live badge.
const badge=/<span className="ml-1 rounded-full bg-cyan-600 px-1\.5 py-0\.5 text-\[8px\] font-black text-white">\{unread>99\?'99\+':unread\}<\/span>/g;
let badgeMatches=g.match(badge)||[];
if(badgeMatches.length>1){
  let kept=false;
  g=g.replace(badge,m=>{if(!kept){kept=true;return m}return ''});
}

// Add a deterministic member list overlay to the existing Group Info action.
if(!g.includes('GROUP MEMBERS') && g.lastIndexOf('</main>')>=0){
  const panel=`{info&&<div className="fixed inset-0 z-[80] bg-black/40 p-4" onClick={()=>setInfo(false)}><div className="mx-auto mt-16 max-h-[75vh] max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">GROUP MEMBERS</p><h2 className="mt-1 text-xl font-black">{g.name}</h2></div><button onClick={()=>setInfo(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button></div><div className="mt-4 space-y-2">{members.length?members.map((m:any)=><div key={m.uid} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-white">{m.photoURL?<img src={m.photoURL} className="h-full w-full object-cover"/>:String(m.fullName||'L')[0]}</div><div className="min-w-0"><p className="truncate text-sm font-black">{m.fullName}</p>{m.username&&<p className="truncate text-xs text-slate-400">@{m.username}</p>}</div></div>):<p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">No member profiles are available yet.</p>}</div></div></div>}`;
  const pos=g.lastIndexOf('</main>');
  g=g.slice(0,pos)+panel+g.slice(pos);
}
fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
const oldRecent='const recentRows=useMemo(()=>[...chatRows,...groupRows].sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)),[chatRows,groupRows]);';
const newRecent='const recentRows=useMemo(()=>[...chatRows].sort((a:any,b:any)=>(b.updatedAt||0)-(a.updatedAt||0)),[chatRows]);';
if(c.includes(oldRecent)) c=c.replace(oldRecent,newRecent);
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]')) throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
fs.writeFileSync(chat,c);

// Storage path verification: retain the legacy Firebase rule while all new browser
// uploads use Cloudinary.
const storage='storage.rules';
let r=fs.readFileSync(storage,'utf8');
if(!r.includes('match /community/{uid}/{fileName}')) {
  const marker="    match /community/{groupId}/{uid}/{fileName} {";
  const block="    match /community/{uid}/{fileName} {\n      allow read: if signedIn();\n      allow write: if signedIn() && request.auth.uid == uid && imageFile() && smallEnough();\n      allow delete: if signedIn() && request.auth.uid == uid;\n    }\n\n";
  if(!r.includes(marker)) throw new Error('COMMUNITY_STORAGE_RULE_MARKER_NOT_FOUND');
  r=r.replace(marker,block+marker);
  fs.writeFileSync(storage,r);
}

console.log('Community runtime v4 hardened: Cloudinary config, direct-only recents, and group member info.');
