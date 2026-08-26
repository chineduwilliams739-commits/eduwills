import fs from 'node:fs';

// IMPORTANT: app/dashboard/quiz/page.tsx is authoritative source code.
// Do not rewrite it during CI. Earlier versions generated escaped JSX (\\<main,
// sm\\:px-6, etc.) and corrupted otherwise-valid TSX before next build.

const libPath = 'lib/quizAiClient.ts';
let lib = fs.readFileSync(libPath, 'utf8');

if (!lib.includes("from 'firebase/auth'")) {
  lib = lib.replace("import app from '@/lib/firebase';", "import app from '@/lib/firebase';\nimport { getAuth } from 'firebase/auth';");
}

if (!lib.includes('EDUWILLS_MULTI_PROVIDER_ROUTER')) {
  const marker = 'async function generateBatch(prompt: string): Promise<QuizQuestion[]> {';
  const router = `async function EDUWILLS_MULTI_PROVIDER_ROUTER(prompt: string): Promise<QuizQuestion[]> {\n  const user = getAuth(app).currentUser;\n  if (!user) throw new Error('AI_AUTH_REQUIRED');\n  const token = await user.getIdToken();\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), 38000);\n  try {\n    const r = await fetch('https://us-central1-eduwills.cloudfunctions.net/quizAiRouter', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },\n      body: JSON.stringify({ prompt }),\n      signal: controller.signal,\n    });\n    if (!r.ok) throw new Error('AI_ROUTER_' + r.status);\n    const data = await r.json();\n    const questions = parseQuestions(String(data?.text || ''));\n    if (!questions.length) throw new Error('AI_ROUTER_EMPTY');\n    return questions;\n  } finally { clearTimeout(timer); }\n}\n\n`;
  if (lib.includes(marker)) lib = lib.replace(marker, router + marker);
}

if (!lib.includes('ROUTER_FIRST_GENERATION')) {
  const old = `async function generateBatch(prompt: string): Promise<QuizQuestion[]> {\n  let last: any = null;\n  for (let attempt = 1; attempt <= 4; attempt++) {`;
  const replacement = `async function generateBatch(prompt: string): Promise<QuizQuestion[]> {\n  let last: any = null;\n  // ROUTER_FIRST_GENERATION: Groq/OpenRouter first; Gemini is the final fallback.\n  try { return await EDUWILLS_MULTI_PROVIDER_ROUTER(prompt); } catch (e) { last = e; }\n  for (let attempt = 1; attempt <= 2; attempt++) {`;
  if (lib.includes(old)) lib = lib.replace(old, replacement);
}

lib = lib.replace('attempt <= 2 ? 80000 : 60000', 'attempt <= 2 ? 30000 : 25000');
lib = lib.replace('failures < 12', 'failures < 6');
lib = lib.replace('Math.min(8, remaining)', 'Math.min(10, remaining)');
lib = lib.replace('repairAttempts < 6', 'repairAttempts < 2');
lib = lib.replace(/const CACHE = '[^']+';/, "const CACHE = 'v17-multiprovider-functional';");

// CACHE_FIRST_NO_FALLBACK: the UI is expected to block empty book selection,
// and the AI client must enforce that invariant too. Never generate a quiz for
// a synthetic "Selected book" placeholder because that can trigger an AI call
// with no real source book.
const fallback = "const selected=books.length?books:[{title:'Selected book',author:'Unknown'}];";
const guard = "if (!Array.isArray(books) || books.length === 0) throw new Error('BOOK_SELECTION_REQUIRED'); const selected=books;";
if (lib.includes(fallback)) lib = lib.replace(fallback, guard);

fs.writeFileSync(libPath, lib);
console.log('EDUWILLS quiz runtime: quiz page untouched; cache-first generation, no-book guard, and AI router/runtime patches applied safely.');
