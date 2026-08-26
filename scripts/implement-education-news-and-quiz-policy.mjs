import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

// This deployment step must be idempotent. The dashboard JSX is compacted into
// a single return line, so do not depend on indentation-based insertion points.
let dashboard = read('app/dashboard/page.tsx');
if (!dashboard.includes("import EducationFeed from '@/components/EducationFeed';")) {
  const importMarker = "import { auth, db } from '@/lib/firebase';";
  if (!dashboard.includes(importMarker)) throw new Error('Dashboard Firebase import not found');
  dashboard = dashboard.replace(importMarker, `${importMarker}\nimport EducationFeed from '@/components/EducationFeed';`);
}
if (!dashboard.includes('<EducationFeed />')) {
  const navMarker = '<nav className="fixed bottom-0';
  if (!dashboard.includes(navMarker)) throw new Error('Dashboard bottom navigation not found');
  dashboard = dashboard.replace(navMarker, `<EducationFeed />\n${navMarker}`);
}
write('app/dashboard/page.tsx', dashboard);

// Quiz policy is enforced by the committed Quiz Studio source and runtime.
// Never rewrite app/dashboard/quiz/page.tsx in CI: that caused escaped JSX corruption.

if (!fs.existsSync('public/education-news.json')) {
  write('public/education-news.json', JSON.stringify({ generatedAt: new Date().toISOString(), items: [] }, null, 2));
}

console.log('EDUWILLS education feed implementation applied safely.');
