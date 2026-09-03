import fs from 'node:fs';

const dashboardPath = 'app/dashboard/page.tsx';
const adminPath = 'app/admin/page.tsx';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

// Dashboard: make the first four navigation cards a stable four-column row,
// put Personal on its own centered row, and keep the news feed below it.
let dashboard = read(dashboardPath);

// repair-activation-news owns the inline client-side EducationFeed function.
// Do not add an imported client component here: the previous import caused
// Next 14 static export to cross the client/server module boundary incorrectly.
const feedImport = "import EducationFeed from '@/components/EducationFeed';";
const dynamicImport = "import dynamic from 'next/dynamic';";
const feedDeclaration = "const EducationFeed = dynamic(() => import('@/components/EducationFeed'), { ssr: false });";
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(feedImport)}\\s*\\n?`, 'm'), '');
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(dynamicImport)}\\s*\\n?`, 'm'), '');
dashboard = dashboard.replace(new RegExp(`^${escapeRegExp(feedDeclaration)}\\s*\\n?`, 'm'), '');

const marker = "import { auth, db } from '@/lib/firebase';";
if (!dashboard.includes(marker)) throw new Error('Dashboard Firebase import not found');

// repair-activation-news inserts the local EducationFeed function. If an older
// checkout has no function yet, fail clearly instead of reintroducing an import.
if (!dashboard.includes('function EducationFeed(){')) {
  throw new Error('Inline EducationFeed function is missing after news repair.');
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

if (dashboard.includes(feedImport) || dashboard.includes(dynamicImport) || dashboard.includes(feedDeclaration)) throw new Error('External EducationFeed import/declaration remains.');
write(dashboardPath, dashboard);

// Admin: activation status must be derived from a currently valid WilliToken.
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
