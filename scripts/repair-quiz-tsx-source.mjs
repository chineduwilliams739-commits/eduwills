import fs from 'node:fs';

const file = 'app/dashboard/quiz/page.tsx';
let source = fs.readFileSync(file, 'utf8');

// Some of the earlier automated patches escaped JSX punctuation more than once.
// Decode only repeated source-level escapes that cannot be valid JSX syntax.
source = source.replace(/\\+([<>`])/g, '$1');
source = source.replace(/\\+\$\{/g, '${');

// If an older patch left an escaped JSX tag behind, normalize it as well.
source = source.replace(/\\+(?=<\/?[A-Za-z])/g, '');

if (!source.includes('return <main')) {
  throw new Error('Quiz JSX repair did not find a JSX return expression');
}
if (/return\s+\\+<main/.test(source) || /\\+<\/?[A-Za-z]/.test(source)) {
  throw new Error('Quiz JSX still contains escaped JSX tags');
}

fs.writeFileSync(file, source);
console.log('Quiz TSX source escapes repaired and verified.');
