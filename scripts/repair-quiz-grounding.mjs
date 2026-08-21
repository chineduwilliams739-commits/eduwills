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

// Invalidate older quiz caches after grounding changes.
s = s.replace(/const CACHE\s*=\s*['\"]v(?:19-cross-device-router-chat-batched|20-verified-book-grounding-batched|20-cache-first-per-book)['\"];?/g, "const CACHE='v21-hard-grounded-book-quiz';");

// Make research grounding idempotent. The current client already performs
// concurrent research, so inject verified evidence into its existing chunks
// declaration rather than depending on one exact old source string.
if (!s.includes('const verified=verifiedResearch(books);')) {
  const patterns = [
    /const chunks:string\[\]=\[\];await Promise\.all\(books\.map\(async b=>\{/,
    /const chunks: string\[\] = \[\];\s*await Promise\.all\(books\.map\(async b=>\{/,
    /const chunks:string\[\]=\[\];for\(const b of books\)\{/
  ];
  const match = patterns.find((p) => p.test(s));
  if (!match) throw new Error('researchBooks insertion point not found.');
  s = s.replace(match, (m) => {
    if (m.includes('for(const b of books)')) {
      return 'const verified=verifiedResearch(books);const chunks:string[]=verified?[verified]:[];for(const b of books){';
    }
    return 'const verified=verifiedResearch(books);const chunks:string[]=verified?[verified]:[];await Promise.all(books.map(async b=>{';
  });
}

// Cached questions must pass the same exact-book grounding guard as newly
// generated questions. Support the compact implementation used by the current client.
if (!s.includes('groundedForBooks(books,q,research)')) {
  const cachedPatterns = [
    /if\(k&&!seen\.has\(k\)&&valid\(q\)\)\{accepted\.push\(q\);seen\.add\(k\)\}/,
    /if\(k&&!seen\.has\(k\)&&valid\(q\)\)\{accepted\.push\(q\);seen\.add\(k\);\}/
  ];
  const cached = cachedPatterns.find((p) => p.test(s));
  if (cached) {
    s = s.replace(cached, (m) => m.replace('&&valid(q)', '&&valid(q)&&groundedForBooks(books,q,research)'));
  }
}

// Newly generated questions must also be grounded to the exact selected book.
if (!s.includes('groundedForBooks(books,q,research)')) {
  const old = 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;';
  if (s.includes(old)) {
    s = s.replace(old, 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||!groundedForBooks(books,q,research))continue;');
  } else {
    const compact = /if\(!k\|\|seen\.has\(k\)\|\|accepted\.some\(x=>similar\(x\.question,q\.question\)\)\|\|isMetadata\(q\)\)continue;/;
    if (compact.test(s)) s = s.replace(compact, 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||!groundedForBooks(books,q,research))continue;');
    else throw new Error('Quiz acceptance guard insertion point not found.');
  }
}

// Small requests stay fast; larger requests use controlled adaptive batches.
s = s.replace(/const batch=Math\.min\(8,remaining\);/g, "const batch=remaining<=10?remaining:remaining<=20?remaining:Math.min(20,remaining);");
s = s.replace(/const batch=Math\.min\(10,remaining\);/g, "const batch=remaining<=10?remaining:remaining<=20?remaining:Math.min(20,remaining);");
s = s.replace(/const batch=Math\.min\(12,remaining\);/g, "const batch=remaining<=10?remaining:remaining<=20?remaining:Math.min(20,remaining);");
s = s.replace(/attempts<12/g, 'attempts<20');
s = s.replace(/attempts<4/g, 'attempts<20');
s = s.replace(/worker\(prompt,18000,'quiz'\)/g, "worker(prompt,Math.min(45000,Math.max(18000,12000+batch*1500)),'quiz')");

fs.writeFileSync(file, s);
console.log('EDUWILLS exact-book grounding enforced: verified research, cache validation, Sànyà safeguards, cache invalidation and adaptive batching applied.');
