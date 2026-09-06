import fs from 'node:fs';

const clientPath = 'lib/quizAiClientStable.ts';
let client = fs.readFileSync(clientPath, 'utf8');

// Keep the research helper compatible with callers that pass learner focus/instructions.
client = client.replace(
  /export async function researchBooks\(books: QuizBook\[\]\): Promise<string>/,
  'export async function researchBooks(books: QuizBook[], focus = ""): Promise<string>'
);

// Preserve the current stable client implementation. This repair script intentionally
// avoids generating nested template literals, which previously made the workflow parser fail.
fs.writeFileSync(clientPath, client);

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

// Remove only stale browser-side research plumbing. Keep the researchBooks import because
// the quiz UX hardening step may call the stable research helper during generation.
page = page.replace(
  /\s*const research = await researchBooks\([\s\S]*?\);\s*/,
  '\n'
);
page = page.replace(/,\s*research\s*\n\s*\);/g, '\n      );');

// Do not remove researchBooks from the page import. The later generation hardening repair
// intentionally uses it, and removing it here caused the TypeScript failure in #1135.

fs.writeFileSync(pagePath, page);
console.log('Quiz generator upgrade script repaired safely; researchBooks import is preserved for later generation hardening.');
