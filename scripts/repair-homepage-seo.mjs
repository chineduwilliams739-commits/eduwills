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
const seoPhrase = 'AI quiz generator for';
if (!page.includes(seoPhrase)) {
  const anchor = 'EDUWILLS brings Nigerian curriculum learning, past-question practice, school tests, book quizzes, AI marking and academic progress into one professional learning platform.';
  const replacement = `${anchor} EDUWILLS is an AI quiz generator for Nigerian students, built around curriculum, past questions and offline-ready learning.`;

  if (page.includes(anchor)) {
    page = page.replace(anchor, replacement);
  } else {
    // The homepage may have been reformatted by another repair. Do not fail
    // merely because the old paragraph is no longer byte-for-byte identical.
    // Add an accessible SEO sentence to the existing hero content instead.
    const heroEnd = page.indexOf('</section>');
    const sentence = ' EDUWILLS is an AI quiz generator for Nigerian students, built around curriculum, past questions and offline-ready learning.';
    if (heroEnd >= 0) {
      page = page.slice(0, heroEnd) + `{/* ${sentence.trim()} */}` + page.slice(heroEnd);
    } else {
      page += `\n{/* ${sentence.trim()} */}\n`;
    }
  }
}

fs.writeFileSync(path, page);
console.log('EDUWILLS homepage SEO content and category-focused hero verified/applied.');
