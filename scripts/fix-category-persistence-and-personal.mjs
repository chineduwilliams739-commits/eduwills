import fs from 'node:fs';
const categoryPath='app/dashboard/category/page.tsx';
let c=fs.readFileSync(categoryPath,'utf8');
const before=c;
c=c.replaceAll('`${BASE}/dashboard/`','`${BASE}/dashboard/?category=${category}`');
if(c===before) throw new Error('Category dashboard links were not found; refusing to make a no-op change.');
fs.writeFileSync(categoryPath,c);
console.log('Category dashboard links now preserve the selected category.');
