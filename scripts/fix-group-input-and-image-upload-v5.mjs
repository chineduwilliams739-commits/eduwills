import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// Replace the fragile one-line message input with a real textarea.  It uses both
// onChange and onInput so mobile keyboards/IME input cannot get stuck.
const oldInput='<input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key===\'Enter\'&&!e.shiftKey&&(e.preventDefault(),send())} placeholder="Write a message…" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"/>';
const newInput='<textarea value={draft} onChange={e=>setDraft(e.target.value)} onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)} onKeyDown={e=>e.key===\'Enter\'&&!e.shiftKey&&(e.preventDefault(),send())} rows={1} placeholder="Write a message…" aria-label="Write a message" className="min-h-[44px] max-h-32 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-3 text-sm leading-5 outline-none" />';
if(g.includes(oldInput)) g=g.replace(oldInput,newInput);

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

if(!g.includes('aria-label="Write a message"') || !g.includes('onInput={e=>setDraft((e.target as HTMLTextAreaElement).value)}')) {
  throw new Error('GROUP_COMPOSER_REPAIR_NOT_APPLIED');
}
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

console.log('Group input and image upload v5 applied.');
