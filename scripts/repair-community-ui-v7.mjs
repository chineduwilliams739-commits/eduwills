import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8').replace(/\\n(?=\s*(?:const|useEffect|async|if|return|<))/g,'\n');

// Force the group composer to use normal horizontal text flow on mobile/desktop.
const textareaRe=/<textarea\b([^>]*aria-label="Write a message"[^>]*)>/g;
g=g.replace(textareaRe,(full,attrs)=>{
  const clean=attrs.replace(/\sstyle=\{\{[^}]*\}\}/g,'');
  return `<textarea${clean} style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}>`;
});

// Group Info is an inline workspace section. Members are shown only after MEMBERS is selected;
// the member list itself is never rendered as a second popup/modal.
if(!g.includes("[membersOpen,setMembersOpen]")){
  g=g.replace("[info,setInfo]=useState(false),", "[info,setInfo]=useState(false),[membersOpen,setMembersOpen]=useState(false),");
}
const modalRe=/\{info&&<div className="fixed inset-0 z-\[80\][\s\S]*?<\/div>\}<header/;
if(!modalRe.test(g))throw new Error('GROUP_INFO_MODAL_NOT_FOUND');
const inline=`{info&&<section className="border-b border-slate-200 bg-white shadow-sm"><div className="mx-auto max-w-5xl p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">GROUP INFO</p><h2 className="mt-1 text-xl font-black">{g.name}</h2><p className="mt-1 text-xs text-slate-500">{g.memberIds?.length||1} members</p></div><button type="button" onClick={()=>{setInfo(false);setMembersOpen(false)}} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X size={17}/></button></div><div className="mt-4 flex gap-2"><button type="button" onClick={()=>setMembersOpen(false)} className={\`rounded-xl px-4 py-2 text-xs font-black \${!membersOpen?'bg-ink text-white':'bg-slate-100 text-slate-600'}\`}>INFO</button><button type="button" onClick={()=>setMembersOpen(true)} className={\`rounded-xl px-4 py-2 text-xs font-black \${membersOpen?'bg-ink text-white':'bg-slate-100 text-slate-600'}\`}>MEMBERS</button></div>{membersOpen?<div className="mt-4 space-y-2">{members.length?members.map((m:any)=><div key={m.uid} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-sm font-black text-white">{m.photoURL?<img src={m.photoURL} alt="" className="h-full w-full object-cover"/>:String(m.fullName||'L').charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black">{m.fullName}</p><p className="truncate text-xs text-slate-400">{m.username?'@'+m.username:'Member'}</p></div></div>):<p className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-500">No member profiles could be loaded.</p>}</div>:<div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-sm leading-6 text-slate-600">{g.description||'A focused EDUWILLS learning community.'}</p><p className="mt-3 text-xs font-semibold text-slate-500">Use MEMBERS to view everyone in this group.</p></div>}</div></section><header`;
g=g.replace(modalRe,inline);

if(!g.includes("style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}"))throw new Error('GROUP_COMPOSER_HORIZONTAL_FLOW_MISSING');
if(!g.includes('MEMBERS'))throw new Error('GROUP_MEMBERS_TAB_MISSING');
if(!g.includes('[membersOpen,setMembersOpen]'))throw new Error('GROUP_MEMBERS_TAB_STATE_MISSING');
if(g.includes('fixed inset-0 z-[80]'))throw new Error('GROUP_MEMBER_POPUP_STILL_PRESENT');

fs.writeFileSync(group,g);
console.log('Community UI v7: horizontal composer text flow and inline Group Info/MEMBERS view applied.');
