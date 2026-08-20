import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let p = fs.readFileSync(path, 'utf8');

// The old Quiz Studio page-level gate blocks every unactivated learner before
// startQuiz() can apply the intended 5-free-quizzes/day rule. Remove only the
// page-level `if (!active) return (...)` gate; activation remains a quota rule.
const marker = 'Your Quiz Studio is waiting for you';
const markerAt = p.indexOf(marker);
if (markerAt < 0) {
  console.log('No page-level activation screen found; nothing to remove.');
  process.exit(0);
}

function skipString(text, i) {
  const quote = text[i];
  if (quote !== "'" && quote !== '"' && quote !== '`') return i;
  i++;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === quote) return i + 1;
    i++;
  }
  return i;
}

function matchPair(text, start, open, close) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') { i = skipString(text, i) - 1; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const before = p.slice(0, markerAt);
const candidates = [...before.matchAll(/if\s*\(\s*!active(?:\s*&&[^)]*)?\s*\)/g)];
const gateAt = candidates.length ? candidates[candidates.length - 1].index : -1;
if (gateAt < 0) throw new Error('Quiz page activation gate marker exists but its if (!active) gate was not found.');

let i = gateAt + before.slice(gateAt).match(/^if\s*\(\s*!active(?:\s*&&[^)]*)?\s*\)/)[0].length;
while (/\s/.test(p[i] || '')) i++;

let end = -1;
if (p.startsWith('return', i)) {
  i += 'return'.length;
  while (/\s/.test(p[i] || '')) i++;
  if (p[i] !== '(') throw new Error('Unexpected return form in Quiz activation gate.');
  const close = matchPair(p, i, '(', ')');
  if (close < 0) throw new Error('Could not match Quiz activation gate return parentheses.');
  end = close + 1;
  while (p[end] === ';' || /\s/.test(p[end] || '')) end++;
} else if (p[i] === '{') {
  const close = matchPair(p, i, '{', '}');
  if (close < 0) throw new Error('Could not match Quiz activation gate braces.');
  end = close + 1;
} else {
  throw new Error('Unexpected Quiz activation gate body.');
}

p = p.slice(0, gateAt) + p.slice(end);
fs.writeFileSync(path, p);
console.log('Removed the page-level activation gate. Unactivated learners now reach Quiz Studio; the 5/day and 20-question rules remain enforced by startQuiz().');
