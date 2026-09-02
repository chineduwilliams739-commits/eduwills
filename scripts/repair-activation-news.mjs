import fs from 'node:fs';

const activationPath = 'app/dashboard/activation/page.tsx';
const dashboardPath = 'app/dashboard/page.tsx';
const feedPath = 'components/EducationFeed.tsx';

// Activation page: keep exactly one support control (the floating button).
let activation = fs.readFileSync(activationPath, 'utf8');
activation = activation.replace(/<ContactSupport\s+box\s*\/>/g, '');
fs.writeFileSync(activationPath, activation);

// Dashboard: restore the education-news feed and keep it directly below the
// Personal card, centered inside the same dashboard content column.
let dashboard = fs.readFileSync(dashboardPath, 'utf8');
if (!dashboard.includes("import EducationFeed from '@/components/EducationFeed';")) {
  const marker = "import { auth, db } from '@/lib/firebase';";
  if (!dashboard.includes(marker)) throw new Error('Dashboard Firebase import not found.');
  dashboard = dashboard.replace(marker, `${marker}\nimport EducationFeed from '@/components/EducationFeed';`);
}

// Four equal cards on the first row; Personal becomes a wider centered card
// on the second row instead of being squeezed into a fifth grid column.
dashboard = dashboard.replace(
  'className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-5"',
  'className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4"'
);

dashboard = dashboard.replace(
  'className={`rounded-2xl border p-5 text-left shadow-sm transition ${l?',
  'className={`rounded-2xl border p-5 text-left shadow-sm transition ${n===\'PERSONAL\'?\'lg:col-span-4 lg:mx-auto lg:w-1/2 \':\'\'}${l?'
);

// Put the news feed below the dashboard cards. Use the fixed bottom-nav as a
// stable anchor rather than the previous exact closing-div sequence, because
// other repair scripts may legitimately rewrite the card layout before the
// package prebuild hook runs. Repeated runs remain safe.
const feedImport = "import EducationFeed from '@/components/EducationFeed';";
const hasFeed = /<EducationFeed\s*\/>/.test(dashboard);
if (!hasFeed) {
  const navMarker = '<nav className="fixed bottom-0';
  const navIndex = dashboard.indexOf(navMarker);
  if (navIndex < 0) throw new Error('Dashboard bottom navigation insertion point not found.');
  dashboard = dashboard.slice(0, navIndex) + '<div className="mt-6 w-full"><EducationFeed /></div>' + dashboard.slice(navIndex);
} else {
  // Collapse any repeated wrappers from older runs to one feed component.
  dashboard = dashboard.replace(/(?:<div className="mt-6 w-full">\s*)+<EducationFeed\s*\/>(?:\s*<\/div>)+/g, '<div className="mt-6 w-full"><EducationFeed /></div>');
}
if (!dashboard.includes(feedImport)) throw new Error('EducationFeed import was not preserved.');
fs.writeFileSync(dashboardPath, dashboard);

// Show 20 items so the visible feed can be exactly 70% Nigerian / 30% foreign.
let feed = fs.readFileSync(feedPath, 'utf8');
feed = feed.replace(/\.slice\(0, 12\)/, '.slice(0, 20)');
fs.writeFileSync(feedPath, feed);

// Normalize an already-generated feed so an existing deployment also gets the requested mix.
const jsonPath = 'public/education-news.json';
if (fs.existsSync(jsonPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const items = Array.isArray(data.items) ? data.items : [];
    const nigeria = /\b(nigeria|nigerian|jamb|waec|neco|university of lagos|unilag|university of nigeria|unn|abu zaria|university of ibadan|ui|asuu|tetfund|federal ministry of education)\b/i;
    const ng = items.filter(x => String(x.region || '').toLowerCase() === 'nigeria' || nigeria.test(`${x.source || ''} ${x.title || ''}`));
    const foreign = items.filter(x => !ng.includes(x));
    const mixed = [];
    for (let i = 0; i < 14; i++) if (ng[i]) mixed.push({ ...ng[i], region: 'Nigeria' });
    for (let i = 0; i < 6; i++) if (foreign[i]) mixed.push({ ...foreign[i], region: 'International' });
    const ordered = [];
    for (let i = 0; i < 7; i++) { if (mixed[i]) ordered.push(mixed[i]); if (mixed[14 + i]) ordered.push(mixed[14 + i]); }
    for (let i = 7; i < 14; i++) if (mixed[i]) ordered.push(mixed[i]);
    data.items = ordered.length >= 10 ? ordered : items.slice(0, 20);
    data.mix = { nigeria: 0.70, international: 0.30, visibleItems: 20 };
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn('Could not normalize existing education-news.json:', error?.message || error);
  }
}

console.log('Activation support and dashboard Personal/news layout repair applied.');