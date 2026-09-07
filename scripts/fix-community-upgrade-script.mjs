import fs from 'node:fs';
const p='scripts/upgrade-community-ux-v2.mjs';
let s=fs.readFileSync(p,'utf8');
const marker="const pkgPath=path.join(root,'functions/package.json');";
const i=s.indexOf(marker);
if(i>=0){s=s.slice(0,i)+"\n";fs.writeFileSync(p,s);console.log('Removed optional function/package mutation from community upgrade script.');}
