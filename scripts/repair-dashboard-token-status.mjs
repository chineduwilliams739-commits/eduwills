import fs from 'node:fs';

const dashboardPath = 'app/dashboard/page.tsx';
const adminPath = 'app/admin/page.tsx';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

let dashboard = read(dashboardPath);

const feedImport = "import EducationFeed from '@/components/EducationFeed';";
const dynamicImport = "import dynamic from 'next/dynamic';";
const feedDeclaration = "const EducationFeed = dynamic(() => import('@/components/EducationFeed'), { ssr: false });";
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(feedImport)}\\s*\\n?`, 'm'), '');
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(dynamicImport)}\\s*\\n?`, 'm'), '');
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(feedDeclaration)}\\s*\\n?`, 'm'), '');

const marker = "import { auth, db } from '@/lib/firebase';";
if (!dashboard.includes(marker)) throw new Error('Dashboard Firebase import not found');

// Keep the news feed entirely inside the already-client dashboard module.
// This makes the repair idempotent and avoids the previous client/server
// dynamic-import failure during Next static export.
if (!dashboard.includes('function EducationFeed(){')) {
  const feedFunction = `function EducationFeed(){
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{fetch(\`/eduwills/education-news.json?v=\${Date.now()}\`,{cache:'no-store'}).then(r=>r.ok?r.json():{items:[]}).then(d=>setItems(Array.isArray(d.items)?d.items.slice(0,20):[])).catch(()=>setItems([])).finally(()=>setLoading(false));},[]);
 return <section className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-600">EDUWILLS feed</p><h2 className="mt-1 text-2xl font-black text-slate-950">Education news & updates</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Fresh education stories collected daily from education and news sources.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">Updated daily</span></div>{loading?<div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="h-24 animate-pulse rounded-2xl bg-slate-100"/><div className="h-24 animate-pulse rounded-2xl bg-slate-100"/></div>:items.length?<div className="mt-6 grid gap-4 md:grid-cols-2">{items.map((item,i)=><a key={\`\${item.link}-\${i}\`} href={item.link} target="_blank" rel="noreferrer" className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-white"><div className="flex items-start justify-between gap-4"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-700">{item.source||'Education news'}</span><span className="text-[10px] font-bold text-slate-400">{item.publishedAt||''}</span></div><h3 className="mt-3 font-black leading-6 text-slate-900 group-hover:text-cyan-700">{item.title}</h3>{item.description&&<p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.description}</p>}<p className="mt-4 text-xs font-black text-cyan-700">Read source →</p></a>)}</div>:<div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">The daily feed is preparing its next update. Please check back shortly.</div>}</section>;
}
`;
  const categoryMarker = 'function categoryLabel(v:any){';
  if (dashboard.includes(categoryMarker)) dashboard = dashboard.replace(categoryMarker, feedFunction + '\n' + categoryMarker);
  else {
    const functionInsert = dashboard.indexOf('\nexport default');
    if (functionInsert < 0) throw new Error('Dashboard function insertion point not found.');
    dashboard = dashboard.slice(0, functionInsert) + '\n' + feedFunction + dashboard.slice(functionInsert);
  }
}

const dashboardPattern = /\n<div className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-(?:4|5)">[\s\S]*?(?=<nav className="fixed bottom-0)/;
if (!dashboardPattern.test(dashboard)) {
  const hasExpectedGrid = dashboard.includes('className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4"');
  const hasBottomNav = dashboard.includes('<nav className="fixed bottom-0');
  if (!hasExpectedGrid || !hasBottomNav) throw new Error('Dashboard navigation grid block not found after previous repair.');
} else {
  const dashboardReplacement = `\n<div className="mt-7 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">{nav.filter(({name:n})=>n!=='PERSONAL').map(({name:n,icon:Icon,href})=>{const l=locked(n);return <button type="button" key={n} onClick={()=>go(href,n)} className={\`min-h-[150px] rounded-2xl border p-5 text-left shadow-sm transition \${l?'border-slate-200 bg-white/70 opacity-60':'border-slate-200 bg-white hover:-translate-y-0.5'}\`}><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><Icon size={19}/></span>{l?<LockKeyhole size={16}/>:<CheckCircle2 size={16} className="text-emerald-500"/>}</div><p className="mt-4 text-sm font-black">{n}</p><p className="mt-1 text-xs text-slate-400">{l?'Locked until activation':n==='QUIZ'?\`Create a personalized \${category} quiz\`:'Open section'}</p></button>})}</div>\n<div className="mt-4 flex justify-center">{nav.filter(({name:n})=>n==='PERSONAL').map(({name:n,icon:Icon,href})=>{const l=locked(n);return <button type="button" key={n} onClick={()=>go(href,n)} className={\`w-full max-w-md min-h-[150px] rounded-2xl border p-5 text-left shadow-sm transition \${l?'border-slate-200 bg-white/70 opacity-60':'border-slate-200 bg-white hover:-translate-y-0.5'}\`}><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Icon size={19}/></span>{l?<LockKeyhole size={16}/>:<CheckCircle2 size={16} className="text-emerald-500"/>}</div><p className="mt-4 text-sm font-black">{n}</p><p className="mt-1 text-xs text-slate-400">Open your personal learning profile and switch category</p></button>})}</div>\n<div className="mt-8 flex justify-center"><div className="w-full max-w-5xl"><EducationFeed /></div></div></div>`;
  dashboard = dashboard.replace(dashboardPattern, dashboardReplacement);
}

if (!dashboard.includes('function EducationFeed(){')) throw new Error('Inline EducationFeed function is missing after dashboard repair.');
if (dashboard.includes(feedImport) || dashboard.includes(dynamicImport) || dashboard.includes(feedDeclaration)) throw new Error('External EducationFeed import/declaration remains.');
write(dashboardPath, dashboard);

let admin = read(adminPath);
const activeFn = /function isUserActive\(user: User, tokens: WilliToken\[\]\): boolean \{[\s\S]*?\n\}/;
if (!activeFn.test(admin)) throw new Error('Admin isUserActive function not found');
admin = admin.replace(activeFn, `function isUserActive(user: User, tokens: WilliToken[]): boolean {\n  const uid = user.uid || user.id;\n  return tokens.some(token => {\n    const owner = token.userId || token.uid;\n    const expiry = expiryDate(token);\n    return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > Date.now();\n  });\n}`);

const revokeOld = `const uid = t.userId || t.uid || '';\n      if (!uid) throw new Error('Token has no owner');\n\n      await deleteDoc(doc(db, 'williTokens', t.id));\n\n      const remainingSnapshot = await getDocs(collection(db, 'williTokens'));\n      const now = Date.now();\n      const remainingTokens = remainingSnapshot.docs\n        .map(x => ({ id: x.id, ...x.data() } as WilliToken))\n        .filter(token => {\n          const owner = token.userId || token.uid;\n          const expiry = expiryDate(token);\n          return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > now;\n        });`;
const revokeNew = `const uid = t.userId || t.uid || '';\n      if (!uid) throw new Error('Token has no owner');\n      const userDocId = users.find(user => (user.uid || user.id) === uid)?.id || uid;\n\n      await deleteDoc(doc(db, 'williTokens', t.id));\n\n      const remainingSnapshot = await getDocs(collection(db, 'williTokens'));\n      const now = Date.now();\n      const remainingTokens = remainingSnapshot.docs\n        .map(x => ({ id: x.id, ...x.data() } as WilliToken))\n        .filter(token => {\n          const owner = token.userId || token.uid;\n          const expiry = expiryDate(token);\n          return owner === uid && token.revoked !== true && token.cancelled !== true && !!expiry && expiry.getTime() > now;\n        });`;
if (!admin.includes(revokeOld)) throw new Error('Admin revoke block not found');
admin = admin.replace(revokeOld, revokeNew);
admin = admin.replaceAll("updateDoc(doc(db, 'users', uid), {", "updateDoc(doc(db, 'users', userDocId), {");
admin = admin.replace("          activationExpiresAt: null,\n        });", "          activationExpiresAt: null,\n          activeWilliToken: null,\n        });");
write(adminPath, admin);

console.log('Dashboard layout and WilliToken-derived Admin status repair applied.');
