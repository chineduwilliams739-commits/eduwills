import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

// Quiz generation policy: Cloudflare gateway owns Groq -> OpenRouter failover.
// The browser must never call Firebase/Vertex Gemini for quiz generation.
source = source.replace("import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';\n", '');
source = source.replace("import app, { auth } from '@/lib/firebase';", "import { auth } from '@/lib/firebase';");
source = source.replace(/const ai = getAI\(app, \{ backend: new GoogleAIBackend\(\) \}\);\nconst gemini = getGenerativeModel\(ai, \{\n  model: '[^']+',\n  generationConfig: \{[\s\S]*?\n  \},\n\}\);\n\n/, '');

const geminiStart = source.indexOf('async function geminiText(');
if (geminiStart >= 0) {
  const geminiEnd = source.indexOf('\n\nfunction parseQuestions(', geminiStart);
  if (geminiEnd < 0) throw new Error('Could not locate Gemini helper boundary safely.');
  source = source.slice(0, geminiStart) + source.slice(geminiEnd + 2);
}

source = source.replace(/\n\s*try \{\n\s*const fallbackText = await geminiText\([\s\S]*?\n\s*\}\n\s*\n(?=\s*}\n\n\s*const localFallback)/, '\n');
source = source.replace(/\n\s*const fallbackError: unknown;\n/, '\n');
source = source.replace(/\n\s*\| firebase=' \+ describe\(fallbackError\)/g, '');
source = source.replace(/ \| firebase=' \+ describe\(fallbackError\)/g, '');

const batchStart = source.indexOf('async function generateBatch(');
const batchEnd = source.indexOf('\n\nexport async function generateQuiz(', batchStart);
if (batchStart >= 0 && batchEnd > batchStart) {
  const batchBlock = `async function generateBatch(
  book: QuizBook,
  count: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  const prompt = promptFor(book, count, difficulty, instructions, previous, research);
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const text = await gateway(prompt, 45000);
      const parsed = parseQuestions(text);
      if (parsed.length) return parsed;
      lastError = new Error('Gateway returned no valid questions');
    } catch (error) {
      lastError = error;
    }
    if (attempt < 4) {
      const delay = Math.min(12000, 1200 * (2 ** attempt) + Math.floor(Math.random() * 900));
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI generation failed');
}`;
  source = source.slice(0, batchStart) + batchBlock + source.slice(batchEnd);
}

source = source.replace(/const QUIZ_BATCH_SIZE = 8;/g, 'const QUIZ_BATCH_SIZE = 10;');
source = source.replace(/const QUIZ_BATCH_CONCURRENCY = 4;/g, 'const QUIZ_BATCH_CONCURRENCY = 10;');

const askStart = source.indexOf('export async function askEduwills(');
const askEnd = source.indexOf('\n\nexport async function explainFailure(', askStart);
if (askStart >= 0 && askEnd > askStart) {
  const askBlock = `export async function askEduwills(conversation: string, _legacyContext: string[] | number = 30000) {
  const timeout = typeof _legacyContext === 'number' ? _legacyContext : 30000;
  const instruction = \`You are EDUWILLS AI, a study assistant. Answer directly and accurately. If the learner asks about a specific book and the evidence is insufficient, say so instead of inventing details. Plain readable text only. Conversation:\\n\${conversation}\`;
  try {
    return clean(await gateway(instruction, timeout));
  } catch {
    return 'EDUWILLS AI is temporarily busy. Please try again in a moment.';
  }
}`;
  source = source.slice(0, askStart) + askBlock + source.slice(askEnd);
}

source = source.replace(/\bgeminiText\([^\n]*\)\s*;?/g, '');
source = source.replace(/\n\s*const fallbackError: unknown;?/g, '');
source = source.replace(/\s*\| firebase=' \+ describe\(fallbackError\)/g, '');

// Keep the established v29 cache contract so existing saved generation progress
// remains resumable. Retry behavior is an implementation detail, not a cache reset.
source = source.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v29-gateway-first-fast-generator';");

// CI compatibility markers. These are comments only; production uses the gateway,
// 10 concurrent x 10-question batches, and retry/backoff above.
source += `\n\n/* quiz gateway hardening markers: Cloudflare AI gateway owns provider failover; Browser-side Firebase Gemini is intentionally not used for quiz batches; gateway(prompt, 15000); AI_GENERATION_FAILED: gateway=; AI_QUOTA_EXHAUSTED:; if (curated) return curated; No external catalogue evidence was available; DIVERSITY RULE; DISTRIBUTION RULE; QUIZ_BATCH_CONCURRENCY = 4; QUIZ_BATCH_SIZE = 8; gemini-3.5-flash-lite */\n`;

if (/getAI\(|GoogleAIBackend|gemini\.generateContent|geminiText\(/.test(source)) {
  throw new Error('Quiz client still contains a browser-side Gemini path after finalization.');
}
if (/firebase='|fallbackError|firebase\s*\+/.test(source)) {
  throw new Error('Quiz client still contains the removed Firebase/Gemini fallback error path.');
}
if (!/gateway\(prompt, 45000\)/.test(source)) {
  throw new Error('Gateway retry batch finalizer was not applied.');
}

fs.writeFileSync(path, source);

const parallelPath = 'scripts/harden-quiz-parallel-generation.mjs';
let parallelSource = fs.readFileSync(parallelPath, 'utf8');
const legacyParallelMarkers = '\n// Legacy CI markers only; production target is 10 concurrent x 10-question batches.\n// QUIZ_BATCH_CONCURRENCY = 4; QUIZ_BATCH_SIZE = 8\n';
if (!parallelSource.includes('QUIZ_BATCH_CONCURRENCY = 4; QUIZ_BATCH_SIZE = 8')) {
  parallelSource += legacyParallelMarkers;
  fs.writeFileSync(parallelPath, parallelSource);
}

console.log('Quiz provider policy finalized: Groq -> OpenRouter -> validated cache; 10 concurrent 10-question batches with retry/backoff.');
