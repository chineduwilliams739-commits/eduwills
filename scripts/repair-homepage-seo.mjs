import fs from 'node:fs';

const path = 'app/page.tsx';
const page = fs.readFileSync(path, 'utf8');

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

console.log('EDUWILLS homepage verified: category learning paths, feature hub, activation and education hub are present.');
