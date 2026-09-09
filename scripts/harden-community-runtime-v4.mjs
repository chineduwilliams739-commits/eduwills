import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');

// A group admin must still be able to type/send while member sending is locked.
g=g.replace(
  "async function send(){if((!draft.trim()&&!image)||!user||!isMember||isLocked)return;",
  "async function send(){if((!draft.trim()&&!image)||!user||!isMember||(isLocked&&!isAdmin))return;"
);
g=g.replace(/disabled=\{isLocked\}/g,'disabled={isLocked&&!isAdmin}');
g=g.replace(/disabled=\{isLocked === true\}/g,'disabled={isLocked&&!isAdmin}');

// Make the group composer explicitly interactive and avoid a stale lock flag making
// the textarea appear usable while silently rejecting every keystroke/send action.
if (g.includes('placeholder="Write a message') && g.includes('onChange={e=>setDraft(e.target.value)}')) {
  g=g.replace('readOnly={isLocked}', 'readOnly={isLocked&&!isAdmin}');
}

if (!g.includes('onChange={e=>setDraft(e.target.value)}')) {
  throw new Error('GROUP_COMPOSER_INPUT_NOT_FOUND');
}
if (!g.includes('onChange={e=>setDraft(e.target.value)}')) {
  throw new Error('GROUP_COMPOSER_ONCHANGE_NOT_FOUND');
}
fs.writeFileSync(group,g);

// Storage path verification: DeviceImageUpload("community") writes community/{uid}/{file},
// so the deployed Storage rules must include that exact path.
const storage='storage.rules';
let r=fs.readFileSync(storage,'utf8');
if(!r.includes('match /community/{uid}/{fileName}')) {
  const marker="    match /community/{groupId}/{uid}/{fileName} {";
  const block="    match /community/{uid}/{fileName} {\n      allow read: if signedIn();\n      allow write: if signedIn() && request.auth.uid == uid && imageFile() && smallEnough();\n      allow delete: if signedIn() && request.auth.uid == uid;\n    }\n\n";
  if(!r.includes(marker)) throw new Error('COMMUNITY_STORAGE_RULE_MARKER_NOT_FOUND');
  r=r.replace(marker,block+marker);
  fs.writeFileSync(storage,r);
}

console.log('Community runtime v4 hardened: group composer/admin lock behavior and community image path verified.');
