import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';

if (!fs.existsSync(path)) {
  throw new Error(`Quiz page not found: ${path}`);
}

const s = fs.readFileSync(path, 'utf8');

if (!s.includes("'use client'") && !s.includes('"use client"')) {
  throw new Error('Quiz page is missing the client directive.');
}

if (!s.includes('export default function QuizPage')) {
  throw new Error('QuizPage component was not found.');
}

console.log('Quiz Studio page validation passed.');
console.log('No automatic dropdown rewriting was performed.');
console.log('The existing Quiz Studio implementation has been preserved.');
