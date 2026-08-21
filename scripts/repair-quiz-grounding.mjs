import fs from 'node:fs';

const file = 'lib/quizAiClient.ts';
let s = fs.readFileSync(file, 'utf8');

const importLine = "import { groundedForBooks, verifiedResearch } from '@/lib/verifiedBookGrounding';";
if (!s.includes(importLine)) {
  const anchors = [
    "import app, { auth, db } from '@/lib/firebase';",
    "import app from '@/lib/firebase';"
  ];
  const anchor = anchors.find((x) => s.includes(x));
  if (!anchor) throw new Error('Firebase import anchor not found.');
  s = s.replace(anchor, `${anchor}\n${importLine}`);
}

// Invalidate previous caches so hallucinated questions cannot survive the fix.
s = s.replace(/const CACHE='v19-cross-device-router-chat-batched';/g, "const CACHE='v21-hard-grounded-book-quiz';");
s = s.replace(/const CACHE = 'v19-cross-device-router-chat-batched';/g, "const CACHE = 'v21-hard-grounded-book-quiz';");
s = s.replace(/const CACHE='v20-verified-book-grounding-batched';/g, "const CACHE='v21-hard-grounded-book-quiz';");
s = s.replace(/const CACHE = 'v20-verified-book-grounding-batched';/g, "const CACHE = 'v21-hard-grounded-book-quiz';");

const researchPatterns = [
  'const chunks:string[]=[];for(const b of books){',
  'const chunks: string[] = []; for (const b of books) {'
];
const researchReplacement = 'const verified=verifiedResearch(books);const chunks:string[]=verified?[verified]:[];for(const b of books){';
if (!s.includes('const verified=verifiedResearch(books);')) {
  const oldResearch = researchPatterns.find((x) => s.includes(x));
  if (!oldResearch) throw new Error('researchBooks insertion point not found.');
  s = s.replace(oldResearch, researchReplacement);
}

const newAccept = 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||!groundedForBooks(books,q,research))continue;';
if (!s.includes(newAccept)) {
  const oldAccept = 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;';
  if (!s.includes(oldAccept)) throw new Error('Quiz acceptance guard insertion point not found.');
  s = s.replace(oldAccept, newAccept);
}

// Validate shared-cache questions too. This closes the path where an old cached
// question could bypass the new exact-book guard.
const cachedOld = 'if(k&&!seen.has(k)&&valid(q)){accepted.push(q);seen.add(k)}';
const cachedNew = 'if(k&&!seen.has(k)&&valid(q)&&groundedForBooks(books,q,research)){accepted.push(q);seen.add(k)}';
if (!s.includes(cachedNew) && s.includes(cachedOld)) s = s.replace(cachedOld, cachedNew);

// Small quizzes should be quick; larger requests scale in controlled batches up to 20.
s = s.replace(/const batch=Math\.min\(10,remaining\);/g, "const batch=remaining<=10?remaining:remaining<=20?remaining:Math.min(20,remaining);");
s = s.replace(/const batch=Math\.min\(12,remaining\);/g, "const batch=remaining<=10?remaining:remaining<=20?remaining:Math.min(20,remaining);");
s = s.replace(/attempts<12/g, 'attempts<20');
s = s.replace(/worker\(prompt,45000,'quiz'\)/g, "worker(prompt,Math.min(45000,Math.max(18000,12000+batch*1500)),'quiz')");

fs.writeFileSync(file, s);
console.log('EDUWILLS exact-book grounding enforced: verified research, cache validation, Sànyà safeguards, cache invalidation and adaptive batching applied.');
