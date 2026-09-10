import fs from 'node:fs';

const group='app/dashboard/community/group/page.tsx';
let g=fs.readFileSync(group,'utf8');
const bad="onChange={e= style={{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'}}>setDesc(e.target.value)}";
const good="onChange={e=>setDesc(e.target.value)}";
if(g.includes(bad)) g=g.replaceAll(bad,good);
// Repair any equivalent malformed handler emitted by the old UI v7 rewrite.
g=g.replace(/onChange=\{e=\s*style=\{\{writingMode:'horizontal-tb',direction:'ltr',textAlign:'left'\}\}>setDesc\(e\.target\.value\)\}/g,good);
if(g.includes('onChange={e= style=')) throw new Error('MALFORMED_GROUP_SETTINGS_TEXTAREA');
// The description field must never masquerade as the message composer.
g=g.replace(/<textarea aria-label="Write a message" value=\{desc\}/g,'<textarea value={desc}');
fs.writeFileSync(group,g);
console.log('Community UI post-v6 syntax repair applied.');
