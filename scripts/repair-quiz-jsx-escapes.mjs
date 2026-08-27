import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let source = fs.readFileSync(path, 'utf8');

// Earlier patch scripts accidentally persisted one or more backslashes before
// JSX/template punctuation. Normalize all such runs, not just a single slash.
source = source.replace(/\\+([<>`])/g, '$1');

// JSX must contain real tags. Fail early if an escaped opening tag remains.
if (/\\+<\/?[A-Za-z]/.test(source)) {
  source = source.replace(/\\+<(?=\/?[A-Za-z])/g, '<');
}

fs.writeFileSync(path, source);

const required = [
  '<main',
  'question',
  'options',
  'retryGeneration',
  'EDUWILLS_EXAM_SECURITY_V2',
  'visibilitychange',
  'submitQuiz(true)',
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Quiz source repair verification failed: ${marker}`);
}
if (/\\+<\/?[A-Za-z]/.test(source)) throw new Error('Escaped JSX tags remain after repair');

console.log('Quiz TSX escape repair v2 applied and verified.');
