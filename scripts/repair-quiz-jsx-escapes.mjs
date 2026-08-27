import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let source = fs.readFileSync(path, 'utf8');

// Some earlier source-repair scripts escaped JSX punctuation while writing
// strings into the TSX file. Those escapes are not valid JSX tokens.
source = source.replaceAll('\\<', '<').replaceAll('\\>', '>').replaceAll('\\`', '`');

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

console.log('Quiz TSX escape repair applied and verified.');
