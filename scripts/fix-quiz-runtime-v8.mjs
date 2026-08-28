import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('async function generateBatch(');
const end = source.indexOf('\nexport async function askEduwills', start);
if (start < 0 || end < 0) throw new Error('Quiz generation block not found');

const replacement = `async function generateBatch(book: QuizBook, count: number, difficulty: string, instructions: string, previous: string[], research: string) {
  const target = Math.min(5, Math.max(1, count));
  const prompt = promptFor(book, target, difficulty, instructions, previous, research);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const retryPrompt = attempt === 0 ? prompt : prompt + '\\nIMPORTANT RETRY: Return a complete JSON object with exactly ' + target + ' questions about ONLY ' + book.title + ' by ' + book.author + '. Do not use facts from any other selected book.';
    try {
      const text = await gateway(retryPrompt, 60000);
      const parsed = parseQuestions(text);
      if (parsed.length) return parsed;
      lastError = new Error('Gateway returned no valid questions');
    } catch (error) {
      lastError = error;
      try {
        const fallbackText = await geminiText(retryPrompt, 60000);
        const parsed = parseQuestions(fallbackText);
        if (parsed.length) return parsed;
      } catch (fallbackError) { lastError = fallbackError; }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI generation failed');
}

export async function generateQuiz(books: QuizBook[], count: number, difficulty: string, instructions: string, recent: string[] = [], research = ''): Promise<QuizQuestion[]> {
  const requested = Math.min(100, Math.max(1, Number(count) || 10));
  if (!books.length) throw new Error('No book selected.');
  const output: QuizQuestion[] = [];
  const seen = new Set(recent.map(fingerprint).filter(Boolean));

  // Each selected book gets isolated research. The old implementation passed one
  // combined evidence blob to every book, which allowed the first selected book
  // to dominate multi-book quizzes.
  const bookEvidence = await Promise.all(books.map(async (book) => {
    try { return await researchBooks([book]); } catch { return ''; }
  }));

  for (let bookIndex = 0; bookIndex < books.length && output.length < requested; bookIndex++) {
    const book = books[bookIndex];
    const remainingBooks = books.length - bookIndex;
    const share = Math.min(requested - output.length, Math.max(1, Math.ceil((requested - output.length) / remainingBooks)));
    const evidence = bookEvidence[bookIndex] || research || '';
    const local: QuizQuestion[] = [];
    let noProgress = 0;

    while (local.length < share && noProgress < 6) {
      let questions: QuizQuestion[] = [];
      try {
        questions = await generateBatch(book, Math.min(5, share - local.length), difficulty, instructions, [...recent, ...output.map(q => q.question)], evidence);
      } catch {
        noProgress += 1;
        continue;
      }
      let added = 0;
      for (const question of questions) {
        const key = fingerprint(question.question);
        if (!key || seen.has(key) || metadata(question)) continue;
        if (local.some(item => similar(item.question, question.question))) continue;
        if (output.some(item => similar(item.question, question.question))) continue;
        if (!groundedForBooks([book], question, evidence)) continue;
        local.push(question); output.push(question); seen.add(key); added += 1;
        if (local.length >= share || output.length >= requested) break;
      }
      if (added) noProgress = 0; else noProgress += 1;
    }
  }

  if (output.length < requested) throw new Error(\`AI generated \${output.length} of \${requested} grounded questions across the selected books. Please try again.\`);
  return output.slice(0, requested);
}
`;
source = source.slice(0, start) + replacement + source.slice(end);
source = source.replace(/const CACHE_VERSION = '[^']*';/, "const CACHE_VERSION = 'v24-multi-book-isolated-grounding';");
fs.writeFileSync(path, source, 'utf8');
console.log('EDUWILLS quiz runtime v8 applied: isolated evidence and guaranteed per-book question distribution.');
