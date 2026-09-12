import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Normalize all legacy/admin MESSAGE CONTROL JSX before inserting the canonical block.
// Locate every MESSAGE CONTROL marker, walk back to its nearest admin section wrapper,
// and remove the complete balanced section regardless of whitespace/attribute changes.
function findBalancedSectionEnd(source, sectionStart){
  const tokenRe=/<\/?section\b[^>]*>/g;
  tokenRe.lastIndex=sectionStart;
  let depth=0;
  let m;
  while((m=tokenRe.exec(source))){
    if(m[0].startsWith('</')){
      depth--;
      if(depth===0) return m.index+m[0].length;
    }else{
      depth++;
    }
  }
  return -1;
}

while(true){
  const marker=g.indexOf('MESSAGE CONTROL');
  if(marker<0) break;
  const adminStart=g.lastIndexOf('{isAdmin&&',marker);
  const sectionStart=adminStart>=0?g.indexOf('<section',adminStart): -1;
  if(adminStart<0||sectionStart<0||sectionStart>marker||marker-adminStart>2000){
    const commentStart=g.lastIndexOf('//',marker);
    const lineEnd=g.indexOf('\n',marker);
    if(commentStart>=0&&commentStart<marker&&(lineEnd<0||commentStart<lineEnd)){
      g=g.slice(0,commentStart)+g.slice(lineEnd<0?g.length:lineEnd+1);
      continue;
    }
    throw new Error('GROUP_LOCK_UI_BLOCK_NOT_LOCATABLE');
  }
  const endSection=findBalancedSectionEnd(g,sectionStart);
  if(endSection<0) throw new Error('GROUP_LOCK_UI_SECTION_UNBALANCED');
  let end=endSection;
  while(/\s/.test(g[end]||'')) end++;
  if(g[end]==='}') end++;
  g=g.slice(0,adminStart)+g.slice(end);
}

g=g.replace(/^\s*\/\/ MESSAGE CONTROL\s*$/gm,'');

g=g.replace(/<button\b[\s\S]*?<\/button>/g,(button)=>
  /(?:UNLOCK SENDING|LOCK SENDING)/.test(button)?'':button
);

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
if(!textarea.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}')){
  textarea=textarea.replace(/(<textarea\b[^>]*)(?=>)/, '$1 onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}');
}
textarea=textarea.replace(/\sstyle=\{\{[^}]*\}\}/,'');
const style=" style={{writingMode:'horizontal-tb',WebkitWritingMode:'horizontal-tb',textOrientation:'mixed',direction:'ltr',textAlign:'left',whiteSpace:'pre-wrap',wordBreak:'break-word'}}";
// Preserve self-closing JSX correctly. The previous /\/>$/ mutation inserted the
// style after the slash, producing invalid TSX such as `<textarea .../> style=...>`.
if(/\/>$/.test(textarea)) textarea=textarea.replace(/\/>$/,style+'/>');
else textarea=textarea.replace(/>$/,style+'>');
g=g.replace(match[0],textarea);

const lockCount=(g.match(/['"]LOCK SENDING['"]/g)||[]).length;
const controlCount=(g.match(/MESSAGE CONTROL/g)||[]).length;
if(lockCount!==1||controlCount!==1) throw new Error(`GROUP_LOCK_UI_NOT_NORMALIZED:${controlCount}:${lockCount}`);
if(!g.includes("WebkitWritingMode:'horizontal-tb'")) throw new Error('GROUP_COMPOSER_HORIZONTAL_STYLE_MISSING');
if(!g.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}')) throw new Error('GROUP_COMPOSER_INPUT_HANDLER_MISSING');

fs.writeFileSync(group,g);
console.log('Community group v8 finalized: exactly one lock-sending control, horizontal composer flow, and mobile-safe input handling.');
