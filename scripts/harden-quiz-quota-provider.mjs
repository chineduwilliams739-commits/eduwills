import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

// Quiz generation policy: Cloudflare gateway owns Groq -> OpenRouter failover.
// The browser must never call Firebase/Vertex Gemini for quiz generation.
source = source.replace("import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';\n", '');
source = source.replace("import app, { auth } from '@/lib/firebase';", "import { auth } from '@/lib/firebase';");

const aiStart = source.indexOf('const ai = getAI(');
const normStart = source.indexOf('const norm = (value: string) =>');
if (aiStart >= 0 && normStart > aiStart) {
  source = source.slice(0, aiStart) + source.slice(normStart);
}

const geminiStart = source.indexOf('async function geminiText(');
if (geminiStart >= 0) {
  const geminiEnd = source.indexOf('\n\nfunction parseQuestions(', geminiStart);
  if (geminiEnd < 0) throw new Error('Could not locate Gemini helper boundary safely.');
  source = source.slice(0, geminiStart) + source.slice(geminiEnd + 2);
}

// The preceding parallel-generation repair installs the gateway-only batch
// function. Increase it to ten 10-question batches so a 100-question request
// can be issued as one parallel wave (provider latency permitting).
source = source.replace(/const QUIZ_BATCH_SIZE = 8;/g, 'const QUIZ_BATCH_SIZE = 10;');
source = source.replace(/const QUIZ_BATCH_CONCURRENCY = 4;/g, 'const QUIZ_BATCH_CONCURRENCY = 10;');

// Remove the old browser-Gemini fallback from the general EduWills assistant.
const askStart = source.indexOf('export async function askEduwills(');
const askEnd = source.indexOf('\n\nexport async function explainFailure(', askStart);
if (askStart >= 0 && askEnd > askStart) {
  let askBlock = source.slice(askStart, askEnd);
  askBlock = askBlock.replace(/\n\s*try \{\n\s*return clean\(await geminiText\([\s\S]*?\n\s*\} catch \{\n\s*return 'EDUWILLS AI is temporarily busy\. Please try again in a moment\.';\n\s*\}/, "\n    return 'EDUWILLS AI is temporarily busy. Please try again in a moment.';");
  source = source.slice(0, askStart) + askBlock + source.slice(askEnd);
}

// Keep the deployment's existing v29 source-verification contract.
source = source.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v29-gateway-first-fast-generator';");

if (/getAI\(|GoogleAIBackend|gemini\.generateContent|geminiText\(/.test(source)) {
  throw new Error('Quiz client still contains a browser-side Gemini path after finalization.');
}

fs.writeFileSync(path, source);
console.log('Quiz provider policy finalized: Groq -> OpenRouter -> validated cache; 10 concurrent 10-question batches.');
