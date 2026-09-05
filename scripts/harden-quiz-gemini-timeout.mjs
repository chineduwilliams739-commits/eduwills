import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(/gateway\(prompt, 25000\)/g, 'gateway(prompt, 45000)');
source = source.replace(/geminiText\(prompt, 25000\)/g, 'geminiText(prompt, 45000)');

const start = source.indexOf('async function generateBatch(');
const end = source.indexOf('\n\nexport async function generateQuiz(', start);
if (start < 0 || end < 0) throw new Error('Could not locate quiz batch function safely.');

const batch = `async function generateBatch(
  book: QuizBook,
  count: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  const safeCount = Math.min(10, Math.max(1, count));
  const prompt = promptFor(book, safeCount, difficulty, instructions, previous, research);
  let gatewayError: unknown;
  let fallbackError: unknown;

  try {
    const text = await gateway(prompt, 45000);
    const parsed = parseQuestions(text);
    if (parsed.length) return parsed;
    gatewayError = new Error('Gateway returned no valid questions');
  } catch (error) {
    gatewayError = error;
  }

  try {
    const fallbackText = await geminiText(prompt, 45000);
    const parsed = parseQuestions(fallbackText);
    if (parsed.length) return parsed;
    fallbackError = new Error('Gemini fallback returned no valid questions');
  } catch (error) {
    fallbackError = error;
  }

  const describe = (error: unknown) => error instanceof Error ? error.message : String(error || 'unknown error');
  throw new Error(`AI_GENERATION_FAILED: gateway=${describe(gatewayError)} | firebase=${describe(fallbackError)}`);
}`;

source = source.slice(0, start) + batch + source.slice(end);
fs.writeFileSync(path, source);
console.log('Quiz Gemini timeout and error-preservation hardening applied.');
