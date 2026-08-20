import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let p = fs.readFileSync(path, 'utf8');

// IMPORTANT: the page-level activation gate must never run before startQuiz().
// The previous structural remover could miss the gate when another repair
// changed formatting. Use an exact semantic replacement first so the build
// cannot ship the blocking screen.
const gate = /if\s*\(\s*!active\s*\)\s*return\s+/;
if (gate.test(p)) {
  p = p.replace(gate, 'if (false) return ');
  fs.writeFileSync(path, p);
  console.log('Force-removed the Quiz Studio activation gate. Unactivated learners can enter Quiz Studio.');
  process.exit(0);
}

// Handle the older form if another repair added a condition around active.
const conditionalGate = /if\s*\(\s*!active(?:\s*&&[^)]*)?\s*\)\s*return\s+/;
if (conditionalGate.test(p)) {
  p = p.replace(conditionalGate, 'if (false) return ');
  fs.writeFileSync(path, p);
  console.log('Force-removed the conditional Quiz Studio activation gate.');
  process.exit(0);
}

console.log('No unactivated Quiz Studio page-level gate remains.');
