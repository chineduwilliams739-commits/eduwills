import fs from 'node:fs';

const clientPath = 'lib/quizAiClientStable.ts';
let client = fs.readFileSync(clientPath, 'utf8');

// Keep the research helper compatible with callers that pass learner focus/instructions.
client = client.replace(
  /export async function researchBooks\(books: QuizBook\[\]\): Promise<string>/,
  'export async function researchBooks(books: QuizBook[], focus = ""): Promise<string>'
);

// Preserve the current stable client implementation. This repair script intentionally
// avoids generating nested template literals, which previously made the workflow
// parser fail before any quiz code could be typechecked.
fs.writeFileSync(clientPath, client);

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

// Research is handled by the stable quiz client; remove any stale browser-side
// research invocation/import left by an earlier repair.
page = page.replace(
  /\s*const research = await researchBooks\([\s\S]*?\);\s*/,
  '\n'
);
page = page.replace(/,\s*research\s*\n\s*\);/g, '\n      );');
page = page.replace(/\n\s*researchBooks,/, '');

fs.writeFileSync(pagePath, page);
console.log('Quiz generator upgrade script repaired safely; no nested template literals are generated.');
