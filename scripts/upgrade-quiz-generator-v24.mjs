import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

source = source.replace("const CACHE_VERSION = 'v23-grounded-generator-resume';", "const CACHE_VERSION = 'v24-grounded-diverse-fast-generator';");
source = source.replace("model: 'gemini-3.5-flash-lite',", "model: 'gemini-3.6-flash',");
source = source.replace("    temperature: 0.1,\n", '');

const start = source.indexOf('function promptFor(');
const end = source.indexOf('\n\nasync function generateBatch(', start);
if (start < 0 || end < 0) throw new Error('Could not locate quiz prompt function safely.');

const prompt = `function promptFor(
  book: QuizBook,
  count: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  return \`You are EDUWILLS Book Intelligence AI, an expert educational quiz writer.

Generate EXACTLY \${count} factual multiple-choice questions about ONLY this exact book: \${book.title} by \${book.author}.

IDENTITY LOCK: The title and author together identify the exact work. Never substitute another edition, adaptation, similarly named work, mythology source, city, person, or general-knowledge fact.

EVIDENCE LOCK: Every question, option, correct answer, and explanation must be supported by the exact-book evidence below. If the evidence does not establish a fact, do not use it. Never infer plot, gender, age, occupation, relationships, chronology, setting, nationality, appearance, or events from names or stereotypes.

DIVERSITY RULE: Build a varied question set. Across the batch, deliberately rotate among plot/events, characters, relationships, motivations, setting, chronology, causes and consequences, themes, conflict, decisions, important details, inference, literary techniques, symbolism, vocabulary-in-context, and critical interpretation when supported by the evidence. Do not ask the same fact in different wording. Avoid repeatedly starting questions with the same pattern.

DISTRIBUTION RULE: Do not let more than 25% of the batch focus on one question type. At least 50% should test concrete book-specific content, and the remainder may test supported inference, themes, techniques, or interpretation. Avoid metadata unless explicitly requested.

DIFFICULTY: \${difficulty}. Make the difficulty meaningful: easier questions test recall and understanding; harder questions test relationships, causes, consequences, inference, comparison, or interpretation while remaining evidence-grounded.

FORMAT: Return ONLY valid JSON in this exact shape: {\"questions\":[{\"question\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":0,\"explanation\":\"...\",\"evidence\":\"...\"}]}. Use exactly four plausible options and one correct answer. answer is zero-based. Do not prefix options with A/B/C/D. Do not include markdown. Do not duplicate or closely paraphrase previous questions.

USER INSTRUCTIONS: \${instructions || 'Create a diverse quiz from the actual book content.'}
PREVIOUS QUESTIONS TO AVOID: \${previous.slice(-60).join(' | ')}

VERIFIED EXACT-BOOK EVIDENCE:
\${research.slice(0, 65000)}\`;
}`;

source = source.slice(0, start) + prompt + source.slice(end);
fs.writeFileSync(path, source);
console.log('Quiz generator v24 upgrade applied safely.');

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');

// The page already performs the same research inside generateQuiz(). Doing it here
// as well doubled the wait time before the first AI request and made timeouts much
// more likely. Let the generator own research and resume/caching.
page = page.replace(
  `      const research = await researchBooks(\n        current.books\n      );\n\n`,
  ''
);
page = page.replace(
  `        recent,\n        research\n      );`,
  `        recent\n      );`
);
page = page.replace(
  `  explainFailure as explainQuizFailure,\n  generateQuiz,\n  generateRemarks,\n  researchBooks,\n`,
  `  explainFailure as explainQuizFailure,\n  generateQuiz,\n  generateRemarks,\n`
);

const generateMarker = `  async function generate(current: Setup) {`;
if (!page.includes(generateMarker)) throw new Error('Could not locate quiz generate function safely.');
page = page.replace(
  generateMarker,
  `  async function retryGeneration() {\n    if (!setup) return;\n    setQuizError('');\n    setQuizLoading(true);\n    await generate(setup);\n  }\n\n${generateMarker}`
);

const resultsMarker = `  /* ------------------------------------------------------------------------ */\n  /* Results                                                                   */\n  /* ------------------------------------------------------------------------ */`;
if (!page.includes(resultsMarker)) throw new Error('Could not locate quiz results section safely.');
page = page.replace(
  resultsMarker,
  `  /* ------------------------------------------------------------------------ */\n  /* Generation failure                                                        */\n  /* ------------------------------------------------------------------------ */\n\n  if (setup && quizError && !quizLoading && !qs.length && !done) {\n    return (\n      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6">\n        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-soft">\n          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-700">\n            <XCircle size={30} />\n          </div>\n          <h1 className="mt-5 text-2xl font-black">Quiz generation needs another attempt</h1>\n          <p className="mt-2 text-sm leading-6 text-slate-500">{quizError}</p>\n          <p className="mt-3 text-xs leading-5 text-slate-400">Your saved generation progress is kept so EDUWILLS can resume instead of starting from zero.</p>\n          <div className="mt-6 flex gap-3">\n            <button type="button" onClick={retryGeneration} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-3 font-black text-white">Try again</button>\n            <button type="button" onClick={resetQuiz} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-black text-slate-700">Back to Quiz Studio</button>\n          </div>\n        </div>\n      </main>\n    );\n  }\n\n${resultsMarker}`
);

fs.writeFileSync(pagePath, page);
console.log('Quiz Studio generation fallback and duplicate research repair applied.');
