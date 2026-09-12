import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// The Pages build runs several legacy community repairs in sequence. Normalize the
// final generated source so MESSAGE CONTROL / LOCK SENDING can only exist once.
const lockBlock=/\{isAdmin&&<section[^>]*>[\s\S]*?MESSAGE CONTROL[\s\S]*?<\/section>\}\s*/g;
g=g.replace(lockBlock,'');

const lockUi=`{isAdmin&&<section className="mx-3 mt-3 rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:mx-0"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">MESSAGE CONTROL</p><p className="mt-1 text-xs font-bold text-slate-500">{isLocked?'Members cannot send messages.':'Members can send messages.'}</p></div><button type="button" onClick={toggleLock} className="rounded-xl bg-ink px-4 py-2.5 text-[10px] font-black text-white">{isLocked?'UNLOCK SENDING':'LOCK SENDING'}</button></div></section>}`;

const rulesAnchor='<section className="mx-3 my-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:mx-0">';
if(!g.includes(rulesAnchor)) throw new Error('GROUP_RULES_ANCHOR_NOT_FOUND');
g=g.replace(rulesAnchor,lockUi+'\n '+rulesAnchor);

// Force the composer to use normal horizontal text flow even if an inherited/global
// writing-mode rule affects form controls on the deployed site.
const textareaRe=/<textarea\b[^>]*aria-label="Write a message"[^>]*>/;
const match=g.match(textareaRe);
if(!match) throw new Error('GROUP_COMPOSER_NOT_FOUND');
let textarea=match[0];
textarea=textarea.replace(/\sstyle=\{\{[^}]*\}\}/,'');
const style=" style={{writingMode:'horizontal-tb',WebkitWritingMode:'horizontal-tb',textOrientation:'mixed',direction:'ltr',textAlign:'left',whiteSpace:'pre-wrap',wordBreak:'break-word'}}";
textarea=textarea.replace(/>$/,style+'>');
g=g.replace(match[0],textarea);

const lockCount=(g.match(/LOCK SENDING/g)||[]).length;
const controlCount=(g.match(/MESSAGE CONTROL/g)||[]).length;
if(lockCount!==1||controlCount!==1) throw new Error(`GROUP_LOCK_UI_NOT_NORMALIZED:${controlCount}:${lockCount}`);
if(!g.includes("WebkitWritingMode:'horizontal-tb'")) throw new Error('GROUP_COMPOSER_HORIZONTAL_STYLE_MISSING');

fs.writeFileSync(group,g);
console.log('Community group v8 finalized: exactly one lock-sending control and forced horizontal composer flow.');
