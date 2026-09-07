import fs from 'node:fs';

const path='app/dashboard/category/page.tsx';
let s=fs.readFileSync(path,'utf8');

if(!s.includes("import EducationFeed from '@/components/EducationFeed';")) {
  s=s.replace("import { auth, db } from '@/lib/firebase';", "import { auth, db } from '@/lib/firebase';\nimport EducationFeed from '@/components/EducationFeed';");
}

if(!s.includes('const currentPath = window.location.pathname;')) {
  s=s.replace('  const config = CATEGORIES[category];', `  const config = CATEGORIES[category];
  const currentPath = window.location.pathname;
  const homeActive = currentPath === \`${BASE}/dashboard/\` || currentPath === \`${BASE}/dashboard\` || currentPath === \`${BASE}/dashboard/category/\`;
  const examActive = currentPath.includes('/dashboard/exam');
  const quizActive = currentPath.includes('/dashboard/category-quiz') || currentPath.includes('/dashboard/quiz');
  const communityActive = currentPath.includes('/dashboard/community');
  const recordsActive = currentPath.includes('/dashboard/history') || currentPath.includes('/dashboard/category-records');
  const personalActive = currentPath.includes('/dashboard/personal');`);
}

s=s.replace("navItem(`${BASE}/dashboard/`,'HOME',GraduationCap)", "navItem(`${BASE}/dashboard/`,'HOME',GraduationCap,homeActive)");
s=s.replace("navItem(examHref,category === 'primary' ? 'PRACTICE' : 'EXAM',FileText)", "navItem(examHref,category === 'primary' ? 'PRACTICE' : 'EXAM',FileText,examActive)");
s=s.replace("navItem(normalQuizHref,'QUIZ',Sparkles,true)", "navItem(normalQuizHref,'QUIZ',Sparkles,quizActive)");
s=s.replace("navItem(`${BASE}/dashboard/community/`,'COMMUNITY',MessageCircle)", "navItem(`${BASE}/dashboard/community/`,'COMMUNITY',MessageCircle,communityActive)");
s=s.replace("navItem(`${BASE}/dashboard/history/`,'RECORDS',Clock3)", "navItem(`${BASE}/dashboard/history/`,'RECORDS',Clock3,recordsActive)");
s=s.replace("navItem(`${BASE}/dashboard/personal/`,'PERSONAL',Target)", "navItem(`${BASE}/dashboard/personal/`,'PERSONAL',Target,personalActive)");

if(!s.includes('<EducationFeed />')) {
  const anchor='    </div>\n    {!category';
  if(s.includes(anchor)) {
    s=s.replace(anchor, '      <div className="mt-7"><EducationFeed /></div>\n    </div>\n    {!category');
  } else {
    throw new Error('Category home render anchor not found; refusing a silent no-op.');
  }
}

fs.writeFileSync(path,s);
console.log('Category source hardened: EducationFeed + active navigation.');
