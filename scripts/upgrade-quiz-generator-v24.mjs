import fs from 'node:fs';

const clientPath = 'lib/quizAiClientStable.ts';
let client = fs.readFileSync(clientPath, 'utf8');

// Keep the research helper compatible with callers that pass learner focus/instructions.
client = client.replace(
  /export async function researchBooks\(books: QuizBook\[\]\): Promise<string>/,
  'export async function researchBooks(books: QuizBook[], focus = ""): Promise<string>'
);

// Keep browser-side book research fast and resilient. Archive.org is deliberately excluded
// from generation-time research because its search URL is not required for quiz generation
// and can produce malformed/blocked URL errors in some client environments. Live Gemini
// Google Search remains the primary research source, with Google Books/Open Library as
// lightweight catalogue evidence.
client = client.replace(
  /const urls = \[\n\s*`https:\/\/www\.googleapis\.com\/books\/v1\/volumes\?q=intitle:\$\{title\}\+inauthor:\$\{author\}&maxResults=20`,\n\s*`https:\/\/openlibrary\.org\/search\.json\?title=\$\{title\}&author=\$\{author\}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`,\n\s*`https:\/\/archive\.org\/advancedsearch\.php\?q=title:\(\$\{title\}\)%20AND%20creator:\(\$\{author\}\)&fl\[\]=title&fl\[\]=creator&fl\[\]=description&fl\[\]=subject&rows=20&page=1&output=json`,\n\s*\];/,
  `const urls = [
      \`https://www.googleapis.com/books/v1/volumes?q=intitle:\${title}+inauthor:\${author}&maxResults=20\`,
      \`https://openlibrary.org/search.json?title=\${title}&author=\${author}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher\`,
    ];`
);

// The research phase is supporting evidence, not a reason to block quiz generation for a
// full minute. Keep it bounded; failures are already non-fatal inside researchBooks().
client = client.replace(
  /gatewayResearch\((`Research the exact book[\s\S]*?`), 60000\)/,
  'gatewayResearch($1, 12000)'
);

// Direct catalogue requests must also have a short client-side bound when the reliability
// hardening helper is available.
client = client.replace(
  /fetch\(url, \{ cache: 'no-store' \}\)/g,
  "fetchWithTimeout(url, { cache: 'no-store' }, 5000)"
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
console.log('Quiz generator upgrade repaired: researchBooks import preserved, Archive.org removed from generation-time research, and research/network latency bounded.');
