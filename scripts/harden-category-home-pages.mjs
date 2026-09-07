import fs from 'node:fs';
const path='app/dashboard/category/page.tsx';
let s=fs.readFileSync(path,'utf8');
if(!s.includes("import EducationFeed from '@/components/EducationFeed';")) s=s.replace("import { auth, db } from '@/lib/firebase';","import { auth, db } from '@/lib/firebase';\nimport EducationFeed from '@/components/EducationFeed';");
if(!s.includes('const homeActive =')) s=s.replace('const config = CATEGORIES[category];',"const config = CATEGORIES[category];\n  const currentPath = window.location.pathname;\n  const homeActive = currentPath === `${BASE}/dashboard/` || currentPath === `${BASE}/dashboard`;\n  const examActive = currentPath.includes('/dashboard/exam');\n  const quizActive = currentPath.includes('/dashboard/category-quiz') || currentPath.includes('/dashboard/quiz');\n  const communityActive = currentPath.includes('/dashboard/community');\n  const recordsActive = currentPath.includes('/dashboard/history') || currentPath.includes('/dashboard/category-records');\n  const personalActive = currentPath.includes('/dashboard/personal');");
s=s.replace("navItem(`${BASE}/dashboard/`,'HOME',GraduationCap)","navItem(`${BASE}/dashboard/`,'HOME',GraduationCap,homeActive)");
s=s.replace("navItem(examHref,category === 'primary' ? 'PRACTICE' : 'EXAM',FileText)","navItem(examHref,category === 'primary' ? 'PRACTICE' : 'EXAM',FileText,examActive)");
s=s.replace("navItem(normalQuizHref,'QUIZ',Sparkles,true)","navItem(normalQuizHref,'QUIZ',Sparkles,quizActive)");
s=s.replace("navItem(`${BASE}/dashboard/community/`,'COMMUNITY',MessageCircle)","navItem(`${BASE}/dashboard/community/`,'COMMUNITY',MessageCircle,communityActive)");
s=s.replace("navItem(`${BASE}/dashboard/history/`,'RECORDS',Clock3)","navItem(`${BASE}/dashboard/history/`,'RECORDS',Clock3,recordsActive)");
s=s.replace("navItem(`${BASE}/dashboard/personal/`,'PERSONAL',Target)","navItem(`${BASE}/dashboard/personal/`,'PERSONAL',Target,personalActive)");
if(!s.includes('<EducationFeed />')){const marker='    </div>\n    {!category';if(!s.includes(marker)) throw new Error('Category home insertion point not found');s=s.replace(marker,'      <div className="mt-7"><EducationFeed /></div>\n    </div>\n    {!category');}
fs.writeFileSync(path,s);
console.log('Category home hardening applied.');
