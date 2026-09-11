import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const path='app/dashboard/community/group/page.tsx';
let group=execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'});

group=group.replace('onChange={e=>setDraft(e.target.value)} onKeyDown=','onInput={e=>setDraft((e.target as HTMLInputElement).value)} onKeyDown=');

if(!group.includes('GROUP_MESSAGE_INPUT_HARDENING')){
  group=group.replace('return <main className="min-h-screen bg-[#eef3f7] text-ink">','return <main className="min-h-screen bg-[#eef3f7] text-ink"><style id="GROUP_MESSAGE_INPUT_HARDENING">{`textarea[aria-label="Write a message"]{writing-mode:horizontal-tb !important;text-orientation:mixed !important;direction:ltr !important;white-space:pre-wrap !important;unicode-bidi:plaintext !important;}`}</style>');
}

const saveAnchor='<button onClick={save} className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3.5 text-sm font-black text-white"><Save size={16}/>Save changes</button>';

if(!group.includes('Rules & regulations')){
  const info=/<div className="mt-4 rounded-2xl bg-slate-50 p-4">[\s\S]*?<\/div>/;
  group=group.replace(info,'<div className="mt-4 space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm leading-6 text-slate-600">{g.description||"A focused EDUWILLS learning community."}</p><p className="mt-3 text-xs font-semibold text-slate-500">Use MEMBERS to view everyone in this group.</p></div><div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4"><div className="flex items-center gap-2"><Shield size={16} className="text-cyan-700"/><p className="text-sm font-black text-cyan-950">Rules & regulations</p></div><div className="mt-3 space-y-2">{rules.map((r,i)=><div key={r[0]} className="rounded-xl bg-white/80 p-3"><p className="text-xs font-black text-slate-800">{i+1}. {r[0]}</p><p className="mt-1 text-[11px] leading-5 text-slate-600">{r[1]}</p></div>)}</div></div></div>');
}

if(!group.includes('LOCK SENDING')){
  const lockControl='<section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-amber-700">MESSAGE CONTROL</p><p className="mt-1 text-sm font-black text-slate-900">LOCK SENDING</p><p className="mt-1 text-[11px] leading-5 text-slate-600">When enabled, members can still read the group but only admins can send messages.</p></div><button type="button" onClick={async()=>{const next=!isLocked;await updateDoc(doc(db,"communityGroups",id),{messagingLocked:next,updatedAt:serverTimestamp()});setIsLocked(next);setG((x:any)=>x?{...x,messagingLocked:next}:x);setNotice(next?"Message sending is locked for members.":"Message sending is unlocked for members.")}} className="rounded-full bg-amber-600 px-4 py-2 text-xs font-black text-white" aria-label="LOCK SENDING">{isLocked?"UNLOCK":"LOCK"}</button></div></section>';
  if(!group.includes(saveAnchor)) throw new Error('GROUP_UI_FIX_SAVE_ANCHOR_MISSING');
  group=group.replace(saveAnchor,lockControl+saveAnchor);
}

group=group.replace('async function send(){if((!draft.trim()&&!image)||!user)return;','async function send(){if((isLocked&&!isAdmin)||((!draft.trim()&&!image)||!user))return;');

group=group.replace('<button onClick={send} disabled={!draft.trim()&&!image} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-30"><Send size={17}/></button>','<button onClick={send} disabled={(isLocked&&!isAdmin)||(!draft.trim()&&!image)} title={isLocked&&!isAdmin?"Sending is locked by an admin":"Send message"} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-30"><Send size={17}/></button>');

if(!group.includes('MESSAGING IS LOCKED')){
  const composerStart='<div className="flex items-end gap-2 border-t border-slate-100 bg-white p-2.5">';
  const banner='<>{isLocked&&!isAdmin&&<div className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-center text-[10px] font-black text-amber-900">MESSAGING IS LOCKED · Only group admins can send messages.</div>}</>';
  if(!group.includes(composerStart)) throw new Error('GROUP_UI_FIX_COMPOSER_ANCHOR_MISSING');
  group=group.replace(composerStart,banner+composerStart);
}

const required=[['member state','[isMember,setIsMember]=useState(false)'],['joining state','[joining,setJoining]=useState(false)'],['lock state','[isLocked,setIsLocked]=useState(false)'],['members state','[members,setMembers]=useState<any[]>([])'],['join function','async function joinGroup()'],['join gate','CLICK TO JOIN GROUP'],['group info','GROUP INFO'],['members tab','GROUP MEMBERS'],['composer','aria-label="Write a message"'],['input hardening','GROUP_MESSAGE_INPUT_HARDENING'],['rules','Rules & regulations'],['lock control','LOCK SENDING'],['lock field','messagingLocked'],['lock enforcement','isLocked&&!isAdmin']];
const missing=required.filter(([,needle])=>!group.includes(needle)).map(([name])=>name);
if(missing.length)throw new Error(`GROUP_UI_V6_CANONICAL_SOURCE_INVALID:${missing.join(',')}`);
if(group.includes('capture="environment"'))throw new Error('GROUP_UI_V6_CAMERA_CAPTURE_REMAINS');
if((group.match(/MESSAGE CONTROL/g)||[]).length>1)throw new Error('GROUP_UI_V6_DUPLICATE_MESSAGE_CONTROL');
if((group.match(/\[isMember\s*,\s*setIsMember\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_MEMBER_STATE_NOT_CANONICAL');
if((group.match(/\[joining\s*,\s*setJoining\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_JOINING_STATE_NOT_CANONICAL');
if((group.match(/\[isLocked\s*,\s*setIsLocked\]\s*=\s*useState\s*\(\s*false\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_LOCK_STATE_NOT_CANONICAL');
if((group.match(/\[members\s*,\s*setMembers\]\s*=\s*useState\s*<\s*any\[\]\s*>\s*\(\s*\[\]\s*\)/g)||[]).length!==1)throw new Error('GROUP_UI_V6_MEMBERS_STATE_NOT_CANONICAL');

fs.writeFileSync(path,group);
console.log('Community UI v6 follow-up fixes applied.');
