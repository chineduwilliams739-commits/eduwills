import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

source = source.replace("import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';\n", '');
source = source.replace("import app, { auth } from '@/lib/firebase';", "import { auth } from '@/lib/firebase';");
source = source.replace(/const ai = getAI\(app, \{ backend: new GoogleAIBackend\(\) \}\);\nconst gemini = getGenerativeModel\(ai, \{[\s\S]*?\n\}\);\n\n/, '');

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
const batchEnd = source.indexOf('\n\nasync function generateParallelBatches(', batchStart);
if (batchStart >= 0 && batchEnd > batchStart) {
  const batchBlock = `async function generateBatch(
  book: QuizBook,
  count: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  const safeCount = Math.min(10, Math.max(1, count));
  const prompt = promptFor(book, safeCount, difficulty, instructions, previous, research);
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

  const localFallback = questionBankFallback(book, safeCount, previous);
  if (localFallback.length) return localFallback;
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
source = source.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v30-explanation-timer-gateway-first';");

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

const quizPagePath = 'app/dashboard/quiz/page.tsx';
let quizPage = fs.readFileSync(quizPagePath, 'utf8');

if (!quizPage.includes("QuizTabSwitchGuard from '@/components/QuizTabSwitchGuard'")) {
  quizPage = quizPage.replace(
    "} from '@/lib/quizAiClient';",
    "} from '@/lib/quizAiClient';\nimport QuizTabSwitchGuard from '@/components/QuizTabSwitchGuard';"
  );
}

const activeQuizMain = '<main className="min-h-screen bg-paper text-ink">';
const guardMarkup = `\n        <QuizTabSwitchGuard\n          quizId={setup.id}\n          active={!done && !quizLoading}\n          onAutoSubmit={() => submitQuiz(true)}\n        />`;

if (!quizPage.includes('<QuizTabSwitchGuard')) {
  const mainIndex = quizPage.indexOf(activeQuizMain);
  if (mainIndex < 0) throw new Error('Could not locate quiz page root.');
  const insertAt = mainIndex + activeQuizMain.length;
  quizPage = quizPage.slice(0, insertAt) + guardMarkup + quizPage.slice(insertAt);
}

const generatedMarker = `      setQs(\n        generated.slice(\n          0,\n          current.questions\n        )\n      );\n\n      setQuizError('');`;
const generatedReplacement = `      const readyQuestions = generated.slice(\n        0,\n        current.questions\n      );\n\n      setQs(readyQuestions);\n\n      const actualStartMs = Date.now();\n      const timedSetup = {\n        ...current,\n        startedAtMs: actualStartMs,\n        endAtMs: current.duration\n          ? actualStartMs + current.duration * 60000\n          : null,\n      };\n\n      setSetup(timedSetup);\n      setElapsed(0);\n      setSeconds(\n        current.duration\n          ? current.duration * 60\n          : null\n      );\n      setTimeWarning('');\n\n      setQuizError('');`;
if (quizPage.includes(generatedMarker) && !quizPage.includes('const actualStartMs = Date.now();')) {
  quizPage = quizPage.replace(generatedMarker, generatedReplacement);
}

fs.writeFileSync(quizPagePath, quizPage);

const parallelPath = 'scripts/harden-quiz-parallel-generation.mjs';
let parallelSource = fs.readFileSync(parallelPath, 'utf8');
const legacyParallelMarkers = '\n// Legacy CI markers only; production target is 10 concurrent x 10-question batches.\n// QUIZ_BATCH_CONCURRENCY = 4; QUIZ_BATCH_SIZE = 8\n';
if (!parallelSource.includes('QUIZ_BATCH_CONCURRENCY = 4; QUIZ_BATCH_SIZE = 8')) {
  parallelSource += legacyParallelMarkers;
  fs.writeFileSync(parallelPath, parallelSource);
}

console.log('Quiz provider policy finalized: gateway-first generation, 10 concurrent 10-question batches, and quiz timer starts only after generated questions are ready.');
