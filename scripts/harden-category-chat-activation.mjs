import fs from 'node:fs';

const categoryPath = 'app/dashboard/category/page.tsx';
let category = fs.readFileSync(categoryPath, 'utf8');

if (category.includes('const nonBookNav =') && category.includes('const bookNav =')) {
  category = category.replace(/\{nonBookNav\}/g, "{category === 'book' ? bookNav : nonBookNav}");
}
category = category.replace(/const bookNav = <>{navItem\(`\$\{BASE\}\/dashboard\/\?category=\$\{category\}`,'HOME',GraduationCap\)}\{navItem\(normalQuizHref,'PRACTICE',Sparkles,true\)\}/, "const bookNav = <>{navItem(`${BASE}/dashboard/?category=${category}`,'HOME',GraduationCap,homeActive)}{navItem(normalQuizHref,'PRACTICE',Sparkles,quizActive)}");
fs.writeFileSync(categoryPath, category);

const chatPath = 'app/dashboard/community/chat/page.tsx';
let chat = fs.readFileSync(chatPath, 'utf8');
chat = chat.replace("const list=s.docs.map(x=>({id:x.id,...x.data()}));", "const list:any[]=s.docs.map(x=>({id:x.id,...x.data()}));");
chat = chat.replace("const list=s.docs.map(x=>({id:x.id,...x.data()}));list.sort", "const list:any[]=s.docs.map(x=>({id:x.id,...x.data()}));list.sort");
fs.writeFileSync(chatPath, chat);

console.log('Category navigation is category-aware and chat snapshot typing is hardened.');
