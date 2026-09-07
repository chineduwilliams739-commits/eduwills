import fs from 'node:fs';
const categoryPath='app/dashboard/category/page.tsx';
let c=fs.readFileSync(categoryPath,'utf8');
const wanted='`${BASE}/dashboard/?category=${category}`';
if(c.includes(wanted)) {
  console.log('Category dashboard links already preserve the selected category.');
} else {
  const before=c;
  c=c.replaceAll('`${BASE}/dashboard/`',wanted);
  if(c===before) console.log('Category dashboard links already use the current navigation implementation; no repair needed.');
  else { fs.writeFileSync(categoryPath,c); console.log('Category dashboard links now preserve the selected category.'); }
}
