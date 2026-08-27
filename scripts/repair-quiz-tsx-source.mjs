import fs from 'node:fs';

const file = 'app/dashboard/quiz/page.tsx';
const source = fs.readFileSync(file, 'utf8');
let out = source;

// Previous automated UI patches wrote JSX with source-level escape characters.
// Decode only the escape forms that are unambiguously artifacts of those patches.
out = out
  .replace(/\\</g, '<')
  .replace(/\\>/g, '>')
  .replace(/\\`/g, '`')
  .replace(/\\\$\{/g, '${');

if (!out.includes('return <main')) {
  throw new Error('Quiz JSX repair did not find a JSX return expression');
}
if (out.includes('return \\<main')) {
  throw new Error('Quiz JSX still contains escaped opening JSX');
}
fs.writeFileSync(file, out);
console.log('Quiz TSX source escapes repaired.');
