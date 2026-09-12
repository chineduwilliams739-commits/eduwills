import fs from 'node:fs';
const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

g=g.replace(/^\s*\/\/ MESSAGE CONTROL\s*$/gm,'');

function findMessageControlBlock(source){
  const marker=source.indexOf('MESSAGE CONTROL');
  if(marker<0)return null;
  const adminStart=source.lastIndexOf('{isAdmin',marker);
  const sectionStart=source.lastIndexOf('<section',marker);
  const sectionEnd=source.indexOf('</section>',marker);
  if(adminStart<0||sectionStart<adminStart||sectionEnd<0)throw new Error('GROUP_LOCK_CONTROL_BLOCK_UNLOCATABLE');
  let end=sectionEnd+'</section>'.length;
  while(/\s/.test(source[end]||''))end++;
  if(source[end]==='}')end++;
  return {start:adminStart,end};
}

// Earlier repair passes can emit multiple lock sections and their inline ternaries
// are fragile in the minified group return. Replace them with one parser-simple,
// deterministic control block. toggleLock still performs the real lock/unlock action.
while((g.match(/MESSAGE CONTROL/g)||[]).length>0){
  const block=findMessageControlBlock(g);
  if(!block)break;
  g=g.slice(0,block.start)+g.slice(block.end);
}
const lockUi=`{isAdmin&&<section className="mx-3 mt-3 rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm sm:mx-0"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-700">MESSAGE CONTROL</p><p className="mt-1 text-xs font-bold text-slate-500">Use this control to lock or unlock member sending.</p></div><button type="button" onClick={toggleLock} className="rounded-xl bg-ink px-4 py-2.5 text-[10px] font-black text-white">{'LOCK SENDING'}</button></div></section>}`;
const rulesAnchor='<section className="mx-3 my-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:mx-0">';
if(!g.includes(rulesAnchor))throw new Error('GROUP_RULES_ANCHOR_NOT_FOUND');
g=g.replace(rulesAnchor,lockUi+'\n '+rulesAnchor);

const textareaRe=/<textarea\b[^>]*aria-label="Write a message"[^>]*>/;
const match=g.match(textareaRe);
if(!match)throw new Error('GROUP_COMPOSER_NOT_FOUND');
let textarea=match[0];
if(!textarea.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}')){
  textarea=textarea.replace(/(<textarea\b[^>]*)(?=>)/,'$1 onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}');
}
textarea=textarea.replace(/\sstyle=\{\{[^}]*\}\}/,'');
const style=" style={{writingMode:'horizontal-tb',WebkitWritingMode:'horizontal-tb',textOrientation:'mixed',direction:'ltr',textAlign:'left',whiteSpace:'pre-wrap',wordBreak:'break-word'}}";
if(/\/>$/.test(textarea))textarea=textarea.replace(/\/>$/,style+'/>');
else textarea=textarea.replace(/>$/,style+'>');
g=g.replace(match[0],textarea);

const lockCount=(g.match(/['"]LOCK SENDING['"]/g)||[]).length;const controlCount=(g.match(/MESSAGE CONTROL/g)||[]).length;
if(lockCount!==1||controlCount!==1)throw new Error(`GROUP_LOCK_UI_NOT_NORMALIZED:${controlCount}:${lockCount}`);
if(!g.includes('async function toggleLock()'))throw new Error('GROUP_LOCK_TOGGLE_MISSING');
if(!g.includes('onClick={toggleLock}'))throw new Error('GROUP_LOCK_HANDLER_MISSING');
if(!g.includes("WebkitWritingMode:'horizontal-tb'"))throw new Error('GROUP_COMPOSER_HORIZONTAL_STYLE_MISSING');
if(!g.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}'))throw new Error('GROUP_COMPOSER_INPUT_HANDLER_MISSING');

fs.writeFileSync(group,g);
console.log('Community group v8 finalized safely: one parser-simple lock control and valid horizontal composer.');
