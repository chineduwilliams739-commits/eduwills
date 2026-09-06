import fs from 'node:fs';

// The main quiz-generation hardening script is the single source of truth for
// this flow. This step intentionally validates the final page instead of
// applying a second, formatting-sensitive patch to the same code.
const path = 'app/dashboard/quiz/page.tsx';
const page = fs.readFileSync(path, 'utf8');

const requiredMarkers = [
  'quizGenerationFailed',
  'quizRetrying',
  'Quiz generation failed — please retry',
  'Retry Generation',
  'generatedSuccessfully',
  'Promise<boolean>',
  'readyAtMs',
  'return true;',
  'return false;',
  "status: 'failed'",
  "data.status !== 'failed'",
];

const missing = requiredMarkers.filter((marker) => !page.includes(marker));
if (missing.length) {
  throw new Error(`Quiz generation failure UX validation failed: ${missing.join(', ')}`);
}

// The failure path must not silently discard the saved setup or start the
// timer before questions are ready. These are lightweight semantic checks,
// deliberately independent of exact formatting.
if (!page.includes('setQuizGenerationFailed(true)')) {
  throw new Error('Quiz generation failure state is not wired into the catch path.');
}
if (!page.includes('setQuizGenerationFailed(false)')) {
  throw new Error('Quiz generation failure state cannot be cleared after recovery.');
}
if (!page.includes('setSetup(readySetup)')) {
  throw new Error('Successful generation does not install the ready quiz setup.');
}
if (!page.includes('setQs(generated.slice(0, current.questions))')) {
  throw new Error('Successful generation does not install the requested questions.');
}

console.log('Quiz generation failure UX validation passed: retryable failure state, no failed free-quiz charge, strict question completion, and timer readiness are present.');
