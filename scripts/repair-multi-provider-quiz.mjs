import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes("import { auth } from '@/lib/firebase';")) {
  s = s.replace("import app from '@/lib/firebase';", "import app from '@/lib/firebase';\nimport { auth } from '@/lib/firebase';");
}

const anchor = "async function generateBatch(prompt: string): Promise<QuizQuestion[]> {";
if (!s.includes('async function remoteAiBatch')) {
  const helper = `async function remoteAiBatch(prompt: string): Promise<QuizQuestion[]> {\n  const url = 'https://us-central1-eduwills.cloudfunctions.net/quizAiRouter';\n  const user = auth.currentUser;\n  if (!user) throw new Error('AI router authentication required.');\n  const token = await user.getIdToken();\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), 42000);\n  try {\n    const r = await fetch(url, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },\n      body: JSON.stringify({ prompt }),\n      signal: controller.signal,\n    });\n    if (!r.ok) throw new Error('AI_ROUTER_' + r.status);\n    const data = await r.json();\n    const questions = parseQuestions(String(data?.text || ''));\n    if (!questions.length) throw new Error('AI router returned no usable questions.');\n    return questions;\n  } finally {\n    clearTimeout(timer);\n  }\n}\n\n`;
  s = s.replace(anchor, helper + anchor);
}

const old = /async function generateBatch\(prompt: string\): Promise<QuizQuestion\[\]> \{[\s\S]*?\n\}\n\nexport async function generateQuiz/;
const replacement = `async function generateBatch(prompt: string): Promise<QuizQuestion[]> {\n  // Provider order: secure server-side Groq/OpenRouter router first, then Firebase Gemini.\n  // A provider quota/outage is treated as a fast failure, not a long retry chain.\n  try {\n    return await remoteAiBatch(prompt);\n  } catch {}\n\n  let last: any = null;\n  for (let attempt = 1; attempt <= 2; attempt++) {\n    try {\n      const model = attempt === 1 ? grounded : fast;\n      const result = await aiCall(model, prompt, attempt === 1 ? 45000 : 35000);\n      const questions = parseQuestions(result.response.text());\n      if (questions.length) return questions;\n      last = new Error('Gemini returned no usable questions.');\n    } catch (e) { last = e; }\n  }\n  throw last || new Error('All EduWills AI providers are temporarily unavailable.');\n}\n\nexport async function generateQuiz`;
if (!old.test(s)) throw new Error('generateBatch block not found');
s = s.replace(old, replacement);

fs.writeFileSync(path, s);
console.log('EDUWILLS multi-provider quiz routing: secure server-side Groq/OpenRouter first, Gemini fallback, bounded retries.');
