import fs from 'node:fs';

const file = 'lib/quizAiClient.ts';
let s = fs.readFileSync(file, 'utf8');

const importLine = "import { groundedForBooks, verifiedResearch } from '@/lib/verifiedBookGrounding';";
if (!s.includes(importLine)) {
  const anchor = "import app, { auth, db } from '@/lib/firebase';";
  if (!s.includes(anchor)) throw new Error('Firebase import anchor not found.');
  s = s.replace(anchor, `${anchor}\n${importLine}`);
}

const oldResearch = 'const chunks:string[]=[];for(const b of books){';
const newResearch = "const verified=verifiedResearch(books);const chunks:string[]=verified?[verified]:[];for(const b of books){";
if (!s.includes(newResearch)) {
  if (!s.includes(oldResearch)) throw new Error('researchBooks insertion point not found.');
  s = s.replace(oldResearch, newResearch);
}

const oldAccept = 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;';
const newAccept = 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||!groundedForBooks(books,q,research))continue;';
if (!s.includes(newAccept)) {
  if (!s.includes(oldAccept)) throw new Error('Quiz acceptance guard insertion point not found.');
  s = s.replace(oldAccept, newAccept);
}

// Small quizzes use one small provider batch; larger quizzes use batches up to 20 so 100-question quizzes can complete without excessive calls.
s = s.replace(/const batch=Math\.min\(10,remaining\);/g, "const batch=remaining<=10?remaining:remaining<=20?remaining:Math.min(20,remaining);");
s = s.replace(/const batch=Math\.min\(12,remaining\);/g, "const batch=remaining<=10?remaining:remaining<=20?remaining:Math.min(20,remaining);");
s = s.replace(/attempts<12/g, 'attempts<20');
s = s.replace(/worker\(prompt,45000,'quiz'\)/g, "worker(prompt,Math.min(45000,Math.max(18000,12000+batch*1500)),'quiz')");

fs.writeFileSync(file, s);
console.log('Quiz exact-book grounding, Sànyà safeguards, adaptive batching and proportional provider timeout applied.');
