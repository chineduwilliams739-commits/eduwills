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
source = source.replace(/\n\s*const fallbackError: unknown;\n/g, '\n');
source = source.replace(/\n\s*\| firebase=' \+ describe\(fallbackError\)/g, '');
source = source.replace(/ \| firebase=' \+ describe\(fallbackError\)/g, '');

const batchStart = source.indexOf('async function generateBatch(');
let batchEnd = source.indexOf('\n\nasync function generateParallelBatches(', batchStart);
if (batchEnd < 0) batchEnd = source.indexOf('\n\nexport async function generateQuiz(', batchStart);
if (batchStart >= 0 && batchEnd > batchStart) {
  const batchBlock = `async function generateBatch(\n  book: QuizBook,\n  count: number,\n  difficulty: string,\n  instructions: string,\n  previous: string[],\n  research: string,\n) {\n  const safeCount = Math.min(10, Math.max(1, count));\n  const prompt = promptFor(book, safeCount, difficulty, instructions, previous, research);\n  let lastError: unknown;\n\n  for (let attempt = 0; attempt < 5; attempt++) {\n    try {\n      const text = await gateway(prompt, 45000);\n      const parsed = parseQuestions(text);\n      if (parsed.length) return parsed;\n      lastError = new Error('Gateway returned no valid questions');\n    } catch (error) {\n      lastError = error;\n    }\n    if (attempt < 4) {\n      const delay = Math.min(12000, 1200 * (2 ** attempt) + Math.floor(Math.random() * 900));\n      await new Promise((resolve) => window.setTimeout(resolve, delay));\n    }\n  }\n\n  throw lastError instanceof Error ? lastError : new Error('AI generation failed');\n}`;
  source = source.slice(0, batchStart) + batchBlock + source.slice(batchEnd);
}

source = source.replace(/const QUIZ_BATCH_SIZE = 8;/g, 'const QUIZ_BATCH_SIZE = 10;');
source = source.replace(/const QUIZ_BATCH_CONCURRENCY = 4;/g, 'const QUIZ_BATCH_CONCURRENCY = 10;');
source = source.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v31-quiz-runtime-hardening';");

const askStart = source.indexOf('export async function askEduwills(');
const askEnd = source.indexOf('\n\nexport async function explainFailure(', askStart);
if (askStart >= 0 && askEnd > askStart) {
  const askBlock = `export async function askEduwills(conversation: string, _legacyContext: string[] | number = 30000) {\n  const timeout = typeof _legacyContext === 'number' ? _legacyContext : 30000;\n  const instruction = \`You are EDUWILLS AI, a study assistant. Answer directly and accurately. If the learner asks about a specific book and the evidence is insufficient, say so instead of inventing details. Plain readable text only. Conversation:\\n\${conversation}\`;\n  try { return clean(await gateway(instruction, timeout)); }\n  catch { return 'EDUWILLS AI is temporarily busy. Please try again in a moment.'; }\n}`;
  source = source.slice(0, askStart) + askBlock + source.slice(askEnd);
}

const explainStart = source.indexOf('export async function explainFailure(');
const explainEnd = source.indexOf('\n\nexport async function generateRemarks(', explainStart);
if (explainStart >= 0 && explainEnd > explainStart) {
  const explainBlock = `function readableExplanation(raw: unknown, correct: string, book: string) {\n  const fallback = \`The correct answer is "\${correct}". Review the relevant section of \${book} and the evidence provided for this question.\`;\n  let value = clean(raw);\n  if (!value) return fallback;\n  try {\n    const parsed = JSON.parse(value);\n    if (typeof parsed === 'string') value = clean(parsed);\n    else if (parsed && typeof parsed === 'object') {\n      const candidate = parsed.explanation ?? parsed.text ?? parsed.message ?? parsed.content;\n      value = typeof candidate === 'string' ? clean(candidate) : '';\n    } else value = '';\n  } catch {}\n  if (!value || value === '{}' || value === '[]' || value === '\"\"') return fallback;\n  return value;\n}\n\nexport async function explainFailure(book: string, question: string, chosen: string, correct: string) {\n  const prompt = \`Briefly explain why "\${correct}" is correct for this question from \${book}: \${question}. The learner chose: \${chosen}. Use only the stated book context. Return ONLY a short plain-text explanation. Do not return JSON, objects, arrays, code fences, or an empty string.\`;\n  try { return readableExplanation(await gateway(prompt, 30000), correct, book); }\n  catch { return readableExplanation('', correct, book); }\n}`;
  source = source.slice(0, explainStart) + explainBlock + source.slice(explainEnd);
}

if (/getAI\(|GoogleAIBackend|gemini\.generateContent|geminiText\(/.test(source)) throw new Error('Browser-side Gemini path remains in quiz client.');
if (!/gateway\(prompt, 45000\)/.test(source)) throw new Error('Gateway retry finalizer was not applied.');
fs.writeFileSync(path, source);

const quizPagePath = 'app/dashboard/quiz/page.tsx';
let quizPage = fs.readFileSync(quizPagePath, 'utf8');

if (!quizPage.includes("QuizTabSwitchGuard from '@/components/QuizTabSwitchGuard'")) {
  quizPage = quizPage.replace("} from '@/lib/quizAiClient';", "} from '@/lib/quizAiClient';\nimport QuizTabSwitchGuard from '@/components/QuizTabSwitchGuard';");
}

const activeQuizMain = '<main className="min-h-screen bg-paper text-ink">';
const guardMarkup = `\n        <QuizTabSwitchGuard\n          quizId={setup.id}\n          active={!done && !quizLoading}\n          onAutoSubmit={() => submitQuiz(true)}\n        />`;
if (!quizPage.includes('<QuizTabSwitchGuard')) {
  const mainIndex = quizPage.indexOf(activeQuizMain);
  if (mainIndex < 0) throw new Error('Could not locate quiz page root.');
  const insertAt = mainIndex + activeQuizMain.length;
  quizPage = quizPage.slice(0, insertAt) + guardMarkup + quizPage.slice(insertAt);
}

// Do not start the user's clock until the AI-generated questions are ready.
// This regex-based patch is deliberately tolerant of formatting differences.
if (!quizPage.includes('const actualStartMs = Date.now();')) {
  const timerPattern = /\s*setQs\(\s*generated\.slice\(\s*0,\s*current\.questions\s*\)\s*\);\s*setQuizError\(''\);/;
  if (!timerPattern.test(quizPage)) throw new Error('Could not locate quiz generation completion block for timer fix.');
  const timerReplacement = `\n\n      const readyQuestions = generated.slice(0, current.questions);\n      setQs(readyQuestions);\n\n      const actualStartMs = Date.now();\n      const timedSetup = {\n        ...current,\n        startedAtMs: actualStartMs,\n        endAtMs: current.duration\n          ? actualStartMs + current.duration * 60000\n          : null,\n      };\n\n      setSetup(timedSetup);\n      setElapsed(0);\n      setSeconds(current.duration ? current.duration * 60 : null);\n      setTimeWarning('');\n      setQuizError('');`;
  quizPage = quizPage.replace(timerPattern, timerReplacement);
}

fs.writeFileSync(quizPagePath, quizPage);

console.log('Quiz runtime hardening finalized: gateway-first generation, strict grounding, safe explanations, and full quiz duration begins only after generation completes.');
