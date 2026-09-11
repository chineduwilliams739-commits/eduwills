import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Repair the legacy one-line input when it is still present.
const oldInput='<input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key===\'Enter\'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Write a message…" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"/>';
const newInput='<textarea aria-label="Write a message" rows={1} value={draft} onChange={e=>setDraft(e.target.value)} onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)} onKeyDown={e=>e.key===\'Enter\'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Write a message…" className="min-h-12 max-h-32 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none" style={{writingMode:\'horizontal-tb\',direction:\'ltr\',textAlign:\'left\'}} />';
if(g.includes(oldInput)) g=g.replace(oldInput,newInput);

// Idempotent path for the current composer: v6 or an earlier pass may already have
// converted the input to a horizontal textarea. Do not fail just because the old
// <input> pattern is gone. Add the mobile/IME-safe onInput handler when absent.
const textarea=/\<textarea\b[^>]*\bvalue=\{draft\}[^>]*\baria-label="Write a message"[^>]*\/?\>/;
const textareaAlt=/\<textarea\b[^>]*\baria-label="Write a message"[^>]*\bvalue=\{draft\}[^>]*\/?\>/;
if((textarea.test(g)||textareaAlt.test(g)) && !g.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}')){
  g=g.replace(/(<textarea\b[^>]*\bvalue=\{draft\})(?=[^>]*>)/, '$1 onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}');
}

// Never request direct camera capture from the group page.
g=g.replace(/\s+capture=\{?['\"]environment['\"]\}?/g,'');
g=g.replace(/\s+capture="environment"/g,'');
g=g.replace(/\s+capture='environment'/g,'');

// The header accidentally contained the unread badge three times in the current
// generated source. Keep exactly one badge.
const badge='{unread>0&&<span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[8px] font-black text-white">{unread>99?\'99+\':unread}</span>}';
const triple=badge+badge+badge;
const double=badge+badge;
if(g.includes(triple)) g=g.replace(triple,badge);
else if(g.includes(double)) g=g.replace(double,badge);

// Accept either the freshly converted textarea or the already-repaired current
// composer. The repair must be safe to run repeatedly in the Pages pipeline.
const composerReady=/\<textarea\b[^>]*\bvalue=\{draft\}[^>]*\baria-label="Write a message"[^>]*\>/.test(g)||/\<textarea\b[^>]*\baria-label="Write a message"[^>]*\bvalue=\{draft\}[^>]*\>/.test(g);
if(!composerReady) throw new Error('GROUP_COMPOSER_REPAIR_NOT_APPLIED');
if(!g.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}')) throw new Error('GROUP_COMPOSER_INPUT_HANDLER_NOT_APPLIED');
fs.writeFileSync(group,g);

// Storage rules must match DeviceImageUpload's message path:
// community/{groupId}/messages/{uid}/{fileName}.
const storage='storage.rules';
let r=fs.readFileSync(storage,'utf8');
if(!r.includes('match /community/{groupId}/messages/{uid}/{fileName}')) {
  const marker='    // Keep compatibility with any older group-image paths that include groupId.\n';
  const block='    // Group message images use community/{groupId}/messages/{uid}/{fileName}.\n    match /community/{groupId}/messages/{uid}/{fileName} {\n      allow read: if signedIn();\n      allow write: if signedIn() && request.auth.uid == uid && imageFile() && smallEnough();\n      allow delete: if signedIn() && request.auth.uid == uid;\n    }\n\n';
  if(!r.includes(marker)) throw new Error('STORAGE_RULE_MARKER_NOT_FOUND');
  r=r.replace(marker,block+marker);
  fs.writeFileSync(storage,r);
}

console.log('Group input and image upload v5 applied (idempotent composer detection).');
