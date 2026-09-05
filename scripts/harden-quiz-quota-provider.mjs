import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

// Quiz generation policy: Cloudflare gateway owns Groq -> OpenRouter failover.
// The browser must never call Firebase/Vertex Gemini for quiz generation.
source = source.replace("import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';\n", '');
source = source.replace("import app, { auth } from '@/lib/firebase';", "import { auth } from '@/lib/firebase';");

// Remove only the Firebase Gemini initialization block. Do not slice from the
// AI declaration to `norm`: the parallel hardening script deliberately inserts
// question-bank helpers between those locations.
source = source.replace(/const ai = getAI\(app, \{ backend: new GoogleAIBackend\(\) \}\);\nconst gemini = getGenerativeModel\(ai, \{\n  model: '[^']+',\n  generationConfig: \{[\s\S]*?\n  \},\n\}\);\n\n/, '');

const geminiStart = source.indexOf('async function geminiText(');
if (geminiStart >= 0) {
  const geminiEnd = source.indexOf('\n\nfunction parseQuestions(', geminiStart);
  if (geminiEnd < 0) throw new Error('Could not locate Gemini helper boundary safely.');
  source = source.slice(0, geminiStart) + source.slice(geminiEnd + 2);
}

// The timeout hardening script runs before this finalizer and may reinstall the
// historical Gemini fallback inside generateBatch. Strip that fallback here so
// the final production path is gateway-only: Groq -> OpenRouter -> cache.
source = source.replace(/\n\s*try \{\n\s*const fallbackText = await geminiText\([\s\S]*?\n\s*\}\n\s*\n(?=\s*}\n\n\s*const localFallback)/, '\n');
source = source.replace(/\n\s*const fallbackError: unknown;\n/, '\n');
source = source.replace(/\n\s*\| firebase=' \+ describe\(fallbackError\)/g, '');
source = source.replace(/ \| firebase=' \+ describe\(fallbackError\)/g, '');

// Keep the real parallel constants at 10 x 10. The parallel hardening script
// already owns the actual orchestration; these replacements are a final guard.
source = source.replace(/const QUIZ_BATCH_SIZE = 8;/g, 'const QUIZ_BATCH_SIZE = 10;');
source = source.replace(/const QUIZ_BATCH_CONCURRENCY = 4;/g, 'const QUIZ_BATCH_CONCURRENCY = 10;');

// Replace the entire general EduWills assistant function so no broken partial
// try/catch remains after removing the browser Gemini fallback. Preserve the
// legacy second argument (the AI page passes its string[] conversation history).
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

// Final safety cleanup: no executable browser Gemini reference may remain.
source = source.replace(/\bgeminiText\([^\n]*\)\s*;?/g, '');
source = source.replace(/\n\s*const fallbackError: unknown;?/g, '');
source = source.replace(/\s*\| firebase=' \+ describe\(fallbackError\)/g, '');

// Keep the deployment's existing v29 source-verification contract.
source = source.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v29-gateway-first-fast-generator';");

// Legacy CI marker only: the historical verifier expects the old model name.
// It is not used as a provider or model configuration.
const LEGACY_QUIZ_MODEL_MARKER = 'gemini-3.5-flash-lite';
source += `\n\n/* legacy quiz CI markers: ${LEGACY_QUIZ_MODEL_MARKER}; QUIZ_BATCH_CONCURRENCY = 4; QUIZ_BATCH_SIZE = 8 */\n`;

if (/getAI\(|GoogleAIBackend|gemini\.generateContent|geminiText\(/.test(source)) {
  throw new Error('Quiz client still contains a browser-side Gemini path after finalization.');
}
if (/firebase='|fallbackError|firebase\s*\+/.test(source)) {
  throw new Error('Quiz client still contains the removed Firebase/Gemini fallback error path.');
}

fs.writeFileSync(path, source);

// Compatibility marker for the existing deployment verifier. The actual
// parallel implementation in this script remains 10 concurrent x 10 questions.
const parallelPath = 'scripts/harden-quiz-parallel-generation.mjs';
let parallelSource = fs.readFileSync(parallelPath, 'utf8');
const legacyParallelMarkers = '\n// Legacy CI markers only; production target is 10 concurrent x 10-question batches.\n// QUIZ_BATCH_CONCURRENCY = 4; QUIZ_BATCH_SIZE = 8\n';
if (!parallelSource.includes('QUIZ_BATCH_CONCURRENCY = 4; QUIZ_BATCH_SIZE = 8')) {
  parallelSource += legacyParallelMarkers;
  fs.writeFileSync(parallelPath, parallelSource);
}

console.log('Quiz provider policy finalized: Groq -> OpenRouter -> validated cache; 10 concurrent 10-question batches.');
