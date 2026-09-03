import fs from 'node:fs';

const activationPath = 'app/dashboard/activation/page.tsx';
const dashboardPath = 'app/dashboard/page.tsx';
const feedPath = 'components/EducationFeed.tsx';

let activation = fs.readFileSync(activationPath, 'utf8');
activation = activation.replace(/<ContactSupport\s+box\s*\/>/g, '');
fs.writeFileSync(activationPath, activation);

let dashboard = fs.readFileSync(dashboardPath, 'utf8');
const feedImport = "import EducationFeed from '@/components/EducationFeed';";
const dynamicImport = "import dynamic from 'next/dynamic';";
const feedDeclaration = "const EducationFeed = dynamic(() => import('@/components/EducationFeed'), { ssr: false });";
const feedMarker = "function categoryLabel(v:any){";
const feedFunction = `function EducationFeed(){
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{fetch(\`/eduwills/education-news.json?v=\${Date.now()}\`,{cache:'no-store'}).then(r=>r.ok?r.json():{items:[]}).then(d=>setItems(Array.isArray(d.items)?d.items.slice(0,20):[])).catch(()=>setItems([])).finally(()=>setLoading(false));},[]);
 return <section className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-600">EDUWILLS feed</p><h2 className="mt-1 text-2xl font-black text-slate-950">Education news & updates</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Fresh education stories collected daily from education and news sources.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">Updated daily</span></div>{loading?<div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="h-24 animate-pulse rounded-2xl bg-slate-100"/><div className="h-24 animate-pulse rounded-2xl bg-slate-100"/></div>:items.length?<div className="mt-6 grid gap-4 md:grid-cols-2">{items.map((item,i)=><a key={\`\${item.link}-\${i}\`} href={item.link} target="_blank" rel="noreferrer" className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-white"><div className="flex items-start justify-between gap-4"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-700">{item.source||'Education news'}</span><span className="text-[10px] font-bold text-slate-400">{item.publishedAt||''}</span></div><h3 className="mt-3 font-black leading-6 text-slate-900 group-hover:text-cyan-700">{item.title}</h3>{item.description&&<p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.description}</p>}<p className="mt-4 text-xs font-black text-cyan-700">Read source →</p></a>)}</div>:<div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">The daily feed is preparing its next update. Please check back shortly.</div>}</section>;
}
`;

// DashboardPage is already a Client Component. Keep the feed in that same
// client module instead of importing another client component into the page's
// static-export graph. This avoids the Next 14 prerender boundary failure.
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(feedImport)}\\s*\\n?`, 'm'), '');
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(dynamicImport)}\\s*\\n?`, 'm'), '');
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(feedDeclaration)}\\s*\\n?`, 'm'), '');
if (!dashboard.includes(feedMarker)) throw new Error('Dashboard categoryLabel marker not found.');
if (!dashboard.includes('function EducationFeed(){')) {
  dashboard = dashboard.replace(feedMarker, feedFunction + '\n' + feedMarker);
}

dashboard = dashboard.replace(
  'className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-5"',
  'className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4"'
);

dashboard = dashboard.replace(
  'className={`rounded-2xl border p-5 text-left shadow-sm transition ${l?',
  'className={`rounded-2xl border p-5 text-left shadow-sm transition ${n===\'PERSONAL\'?\'lg:col-span-4 lg:mx-auto lg:w-1/2 \':\'\'}${l?'
);

const hasFeed = /<EducationFeed\s*\/>/.test(dashboard);
if (!hasFeed) {
  const navMarker = '<nav className="fixed bottom-0';
  const navIndex = dashboard.indexOf(navMarker);
  const feed = '<div className="mt-6 w-full"><EducationFeed /></div>';
  if (navIndex >= 0) dashboard = dashboard.slice(0, navIndex) + feed + dashboard.slice(navIndex);
  else {
    const mainEnd = dashboard.lastIndexOf('</main>');
    if (mainEnd < 0) throw new Error('Dashboard main closing point not found.');
    dashboard = dashboard.slice(0, mainEnd) + feed + dashboard.slice(mainEnd);
  }
} else {
  dashboard = dashboard.replace(/(?:<div className="mt-6 w-full">\s*)+<EducationFeed\s*\/>\s*(?:<\/div>)+/g, '<div className="mt-6 w-full"><EducationFeed /></div>');
}
if (!dashboard.includes('function EducationFeed(){')) throw new Error('Inline EducationFeed function was not installed.');
if (dashboard.includes(feedImport) || dashboard.includes(dynamicImport) || dashboard.includes(feedDeclaration)) throw new Error('External EducationFeed import/declaration remains.');
fs.writeFileSync(dashboardPath, dashboard);

let feed = fs.readFileSync(feedPath, 'utf8');
feed = feed.replace(/\.slice\(0, 12\)/, '.slice(0, 20)');
fs.writeFileSync(feedPath, feed);

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log('Activation support and dashboard Personal/news layout repair applied.');
