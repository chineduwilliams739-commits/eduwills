import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');
g=g.replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');
const groupOpen='export default function Group(){';
const authEffect='useEffect(()=>onAuthStateChanged';
const open=g.indexOf(groupOpen),auth=g.indexOf(authEffect,open);
if(open<0)throw new Error('GROUP_COMPONENT_MISSING');
if(auth<0)throw new Error('GROUP_AUTH_EFFECT_MISSING');
g=g.replace(/,isLocked=g\?\.messagingLocked===true(?=;)/g,'');
g=g.replace(/,\s*isLocked\s*=\s*g\?\.messagingLocked===true(?=;)/g,'');
let header=g.slice(open+groupOpen.length,auth);
for(const re of [
 /\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,
 /\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,
 /\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)\s*,?/g,
 /\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)\s*,?/g
]) header=header.replace(re,'');
header=header.replace(/,\s*,/g,',').replace(/\(\s*,/g,'(').replace(/,\s*;/g,';').replace(/\bconst\s*;\s*/g,'');
const canonical='\n const [isMember,setIsMember]=useState(false),[joining,setJoining]=useState(false),[isLocked,setIsLocked]=useState(false),[members,setMembers]=useState<any[]>([]);\n ';
g=g.slice(0,open+groupOpen.length)+canonical+header+g.slice(auth);

function dedupeAsync(name){
 const marker=`async function ${name}(`,first=g.indexOf(marker); if(first<0)return;
 const brace=g.indexOf('{',first+marker.length); if(brace<0)return;
 const endOf=(start)=>{let depth=0,quote='',escape=false,line=false,block=false;for(let i=start;i<g.length;i++){const ch=g[i],n=g[i+1];if(line){if(ch==='\n')line=false;continue}if(block){if(ch==='*'&&n==='/'){block=false;i++}continue}if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote='';continue}if(ch==='/'&&n==='/'){line=true;i++;continue}if(ch==='/'&&n==='*'){block=true;i++;continue}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return i+1}return-1};
 const firstEnd=endOf(brace);if(firstEnd<0)return;let searchFrom=firstEnd;
 while(true){const next=g.indexOf(marker,searchFrom);if(next<0)break;const nb=g.indexOf('{',next+marker.length);if(nb<0)break;const ne=endOf(nb);if(ne<0)break;g=g.slice(0,next)+g.slice(ne);}
}
['joinGroup','loadMembers','toggleLock','acknowledge'].forEach(dedupeAsync);
g=g.replace(/\n\s*useEffect\(\(\)=>\{let cancelled=false;const loadMembers=async\(\)=>[\s\S]*?\n\s*(?=async function joinGroup)/,'\n');

// Replace the obsolete floating Group Info popup with the requested inline INFO/MEMBERS view.
const popupStart=g.indexOf('{info&&<div className="fixed inset-0 z-50');
const settingsStart=g.indexOf('{isAdmin&&settings&&',popupStart);
if(popupStart>=0 && settingsStart>popupStart){
 const inline=`{info&&<section className="border-b border-slate-200 bg-white shadow-sm"><div className="mx-auto max-w-5xl p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">GROUP INFO</p><h2 className="mt-1 text-xl font-black">{g.name}</h2><p className="mt-1 text-xs text-slate-500">{g.memberIds?.length||1} members</p></div><button type="button" onClick={()=>{setInfo(false);setMembersOpen(false)}} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button></div><div className="mt-4 flex gap-2"><button type="button" onClick={()=>setMembersOpen(false)} className={\`rounded-xl px-4 py-2 text-xs font-black \${!membersOpen?'bg-ink text-white':'bg-slate-100 text-slate-600'}\`}>INFO</button><button type="button" onClick={()=>setMembersOpen(true)} className={\`rounded-xl px-4 py-2 text-xs font-black \${membersOpen?'bg-ink text-white':'bg-slate-100 text-slate-600'}\`}>MEMBERS</button></div>{membersOpen?<div className="mt-4 space-y-2">{members.length?members.map((m:any)=><div key={m.uid} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-sm font-black text-white">{m.photoURL?<img src={m.photoURL} alt="" className="h-full w-full object-cover"/>:String(m.fullName||'L').charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black">{m.fullName}</p><p className="truncate text-xs text-slate-400">{m.username?'@'+m.username:'Member'}</p></div></div>):<p className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">No member profiles could be loaded.</p>}</div>:<div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-sm leading-6 text-slate-600">{g.description||'A focused EDUWILLS learning community.'}</p><p className="mt-3 text-xs font-semibold text-slate-500">Use MEMBERS to view everyone in this group.</p></div>}</div></section>}`;
 g=g.slice(0,popupStart)+inline+g.slice(settingsStart);
}

// Repair the malformed v7 settings textarea, then make the actual message composer a textarea.
g=g.replace(/<textarea aria-label="Write a message" value=\{desc\} onChange=\{e= style=\{\{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'\}\}>setDesc\(e\.target\.value\)\}/g,'<textarea value={desc} onChange={e=>setDesc(e.target.value)}');
g=g.replace(/<textarea aria-label="Write a message" value=\{desc\}/g,'<textarea value={desc}');
const composerInput=/<input value=\{draft\} onChange=\{e=>setDraft\(e\.target\.value\)\} onKeyDown=\{e=>e\.key==='Enter'&&!e\.shiftKey&&\(e\.preventDefault\(\),send\(\)\)\} placeholder="Write a message…" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"\/>/;
if(composerInput.test(g)) g=g.replace(composerInput,'<textarea aria-label="Write a message" rows={1} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key===\'Enter\'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Write a message…" className="min-h-12 max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none" style={{writingMode:\'horizontal-tb\',direction:\'ltr\',textAlign:\'left\'}}/>');

// The controls v3 and v2 scripts can both inject a semantically identical lock card.
// Keep exactly one MESSAGE CONTROL card; the separate amber locked-state notice is retained.
function removeDuplicateMessageControls(source){
 const marker='MESSAGE CONTROL'; const first=source.indexOf(marker); if(first<0)return source;
 while(true){const second=source.indexOf(marker,first+marker.length);if(second<0)break;const start=source.lastIndexOf('<section',second);if(start<0)throw new Error('MESSAGE_CONTROL_PARENT_NOT_FOUND');const tokenRe=/<\/?section\b[^>]*>/g;tokenRe.lastIndex=start;let depth=0,end=-1,m;while((m=tokenRe.exec(source))){if(m[0][1]==='/')depth--;else depth++;if(depth===0){end=m.index+m[0].length;break}}if(end<0)throw new Error('MESSAGE_CONTROL_SECTION_UNBALANCED');source=source.slice(0,start)+source.slice(end)}return source;
}
g=removeDuplicateMessageControls(g);

const count=(needle)=>(g.match(needle)||[]).length;
if(count(/\[\s*isMember\s*,\s*setIsMember\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_MEMBER_STATE_NOT_CANONICAL');
if(count(/\[\s*joining\s*,\s*setJoining\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_JOINING_STATE_NOT_CANONICAL');
if(count(/\[\s*isLocked\s*,\s*setIsLocked\s*\]\s*=\s*useState\s*\(\s*false\s*\)/g)!==1)throw new Error('GROUP_LOCK_STATE_NOT_CANONICAL');
if(count(/\[\s*members\s*,\s*setMembers\s*\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g)!==1)throw new Error('GROUP_MEMBERS_STATE_NOT_CANONICAL');
if(/\bisLocked\s*=\s*g\?\.messagingLocked===true/.test(g))throw new Error('GROUP_DERIVED_LOCK_COLLISION');
if(!g.includes('async function joinGroup'))throw new Error('GROUP_JOIN_FUNCTION_MISSING');
if(!g.includes('aria-label="Write a message"'))throw new Error('GROUP_COMPOSER_MISSING');
if(!g.includes('GROUP INFO')||!g.includes('>MEMBERS</button>'))throw new Error('GROUP_MEMBERS_VIEW_MISSING');
if((g.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('DUPLICATE_MESSAGE_CONTROL_CARD');
if(g.includes('fixed inset-0 z-50') && g.includes('>Group info</h2>'))throw new Error('OBSOLETE_GROUP_INFO_POPUP_REMAINS');
if(/onChange=\{e= style=/.test(g))throw new Error('MALFORMED_TEXTAREA_HANDLER_REMAINS');

fs.writeFileSync(group,g);

const chat='app/dashboard/community/chat/page.tsx';
let c=fs.readFileSync(chat,'utf8');
if(!c.includes('Search by name or username'))throw new Error('CHAT_SEARCH_INPUT_MISSING');
if(c.includes('const recentRows=useMemo(()=>[...chatRows,...groupRows]'))throw new Error('GROUPS_STILL_IN_RECENT_CHATS');
fs.writeFileSync(chat,c);
console.log('Community UI v6 finalized: valid horizontal composer, inline Group Info MEMBERS view, canonical lock control, and source validation passed.');
