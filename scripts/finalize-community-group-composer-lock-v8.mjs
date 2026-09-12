import fs from 'node:fs';
const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// The v2 community repair already creates the canonical MESSAGE CONTROL section.
// This finalizer must not delete and recreate that JSX because doing so is fragile
// when the group page is minified into a single return line. Normalize only the
// composer and validate the existing control instead.
g=g.replace(/^\s*\/\/ MESSAGE CONTROL\s*$/gm,'');

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
console.log('Community group v8 finalized safely: preserved canonical lock control and normalized the horizontal composer.');
