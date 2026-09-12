import fs from 'node:fs';
const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

g=g.replace(/^\s*\/\/ MESSAGE CONTROL\s*$/gm,'');

// Normalize duplicate lock-control sections produced by earlier community repair passes.
// Locate the complete section nearest each extra MESSAGE CONTROL marker rather than
// relying on one exact JSX formatting variant.
function removeExtraMessageControls(source){
  while(true){
    const first=source.indexOf('MESSAGE CONTROL');
    if(first<0)return source;
    const second=source.indexOf('MESSAGE CONTROL',first+1);
    if(second<0)return source;
    const adminStart=source.lastIndexOf('{isAdmin',second);
    const sectionStart=source.lastIndexOf('<section',second);
    if(adminStart<0||sectionStart<adminStart)throw new Error('GROUP_LOCK_DUPLICATE_UNLOCATABLE');
    const sectionEnd=source.indexOf('</section>',second);
    if(sectionEnd<0)throw new Error('GROUP_LOCK_DUPLICATE_SECTION_UNBALANCED');
    let cut=sectionEnd+'</section>'.length;
    while(/\s/.test(source[cut]||''))cut++;
    if(source[cut]==='}')cut++;
    source=source.slice(0,adminStart)+source.slice(cut);
  }
}
g=removeExtraMessageControls(g);

const textareaRe=/<textarea\b[^>]*aria-label="Write a message"[^>]*>/;
const match=g.match(textareaRe);
if(!match) throw new Error('GROUP_COMPOSER_NOT_FOUND');
let textarea=match[0];
if(!textarea.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}')){
  textarea=textarea.replace(/(<textarea\b[^>]*)(?=>)/,'$1 onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}');
}
textarea=textarea.replace(/\sstyle=\{\{[^}]*\}\}/,'');
const style=" style={{writingMode:'horizontal-tb',WebkitWritingMode:'horizontal-tb',textOrientation:'mixed',direction:'ltr',textAlign:'left',whiteSpace:'pre-wrap',wordBreak:'break-word'}}";
if(/\/>$/.test(textarea)) textarea=textarea.replace(/\/>$/,style+'/>');
else textarea=textarea.replace(/>$/,style+'>');
g=g.replace(match[0],textarea);

const lockCount=(g.match(/['"]LOCK SENDING['"]/g)||[]).length;
const controlCount=(g.match(/MESSAGE CONTROL/g)||[]).length;
if(lockCount!==1||controlCount!==1) throw new Error(`GROUP_LOCK_UI_NOT_NORMALIZED:${controlCount}:${lockCount}`);
if(!g.includes('async function toggleLock()')) throw new Error('GROUP_LOCK_TOGGLE_MISSING');
if(!g.includes('onClick={toggleLock}')) throw new Error('GROUP_LOCK_HANDLER_MISSING');
if(!g.includes("WebkitWritingMode:'horizontal-tb'")) throw new Error('GROUP_COMPOSER_HORIZONTAL_STYLE_MISSING');
if(!g.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}')) throw new Error('GROUP_COMPOSER_INPUT_HANDLER_MISSING');

fs.writeFileSync(group,g);
console.log('Community group v8 finalized safely: exactly one lock control and valid horizontal composer.');
