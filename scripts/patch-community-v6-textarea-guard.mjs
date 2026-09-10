import fs from 'node:fs';

const path='scripts/repair-community-ui-v6.mjs';
let s=fs.readFileSync(path,'utf8');
const marker="g=g.replace(/<textarea aria-label=\"Write a message\" value=\\{desc\\} onChange=";
const guard="g=g.replace(/onChange=\\{e=\\s*style=\\{\\{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'\\}\\}>setDesc\\(e\\.target\\.value\\)\\}/g,'onChange={e=>setDesc(e.target.value)}');\n";
if(!s.includes(guard)){
 const anchor="// Repair the malformed v7 settings textarea, then make the actual message composer a textarea.\n";
 if(!s.includes(anchor)) throw new Error('COMMUNITY_V6_TEXTAREA_ANCHOR_MISSING');
 s=s.replace(anchor,anchor+guard);
}
if(!s.includes("onChange=\\{e=\\s*style")) throw new Error('COMMUNITY_V6_TEXTAREA_GUARD_MISSING');
fs.writeFileSync(path,s);
console.log('Community v6 broad textarea guard installed.');
// Trigger deployment from the connector-authored commit after the bot repair.
