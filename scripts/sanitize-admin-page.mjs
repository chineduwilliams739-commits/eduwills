import fs from 'node:fs';

const file = 'app/admin/page.tsx';
let src = fs.readFileSync(file, 'utf8');

// A previous repair path could serialize JSX punctuation with backslashes.
// Remove only escape characters that are invalid in TSX source; do not alter
// normal JavaScript string escaping.
const before = src;
src = src
  .replace(/\\(?=<|>)/g, '')
  .replace(/\\:/g, ':')
  .replace(/\\`/g, '`');

if (src !== before) fs.writeFileSync(file, src);

if (/^\s*\\<main\b/m.test(src)) {
  throw new Error('Admin page still contains escaped JSX after sanitization');
}
if (src.includes('\\:px-') || src.includes('\\:py-')) {
  throw new Error('Admin page still contains escaped Tailwind punctuation');
}

console.log(src !== before
  ? 'Sanitized escaped JSX in app/admin/page.tsx.'
  : 'Admin page JSX is already clean; no sanitization was needed.');
