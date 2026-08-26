import fs from 'node:fs';

const path = 'app/page.tsx';
let page = fs.readFileSync(path, 'utf8');

const required = [
  'Study smarter.',
  'Choose your learning path',
  'A complete digital learning ecosystem.',
  'Education Hub',
  'WilliTokens can be assigned to specific learner categories',
];

for (const marker of required) {
  if (!page.includes(marker)) throw new Error(`Homepage redesign marker missing: ${marker}`);
}

// Keep the homepage SEO hero aligned with the current EDUWILLS positioning.
// Idempotent: repeated deployment repairs will not duplicate the text.
if (!page.includes('AI quiz generator for')) {
  const anchor = 'EDUWILLS brings Nigerian curriculum learning, past-question practice, school tests, book quizzes, AI marking and academic progress into one professional learning platform.';
  const replacement = `${anchor} EDUWILLS is an AI quiz generator for Nigerian students, built around curriculum, past questions and offline-ready learning.`;
  if (page.includes(anchor)) page = page.replace(anchor, replacement);
  else throw new Error('Homepage hero paragraph insertion point not found');
  fs.writeFileSync(path, page);
}

console.log('EDUWILLS homepage SEO content and category-focused hero verified/applied.');
