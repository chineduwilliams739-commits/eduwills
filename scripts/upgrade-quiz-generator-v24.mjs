import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v27-fast-reliable-generator';");
source = source.replace(/model: 'gemini-[^']+',/, "model: 'gemini-3.6-flash',");
source = source.replace("    temperature: 0.1,\n", '');

const start = source.indexOf('function promptFor(');
const end = source.indexOf('\n\nasync function generateBatch(', start);
if (start < 0 || end < 0) throw new Error('Could not locate quiz prompt function safely.');

const prompt = `function promptFor(\n  book: QuizBook,\n  count: number,\n  difficulty: string,\n  instructions: string,\n  previous: string[],\n  research: string,\n) {\n  const evidence = research.trim() || 'No external catalogue evidence was available. Use only facts you are genuinely confident belong to this exact book and do not invent or infer unsupported details.';\n  return \\`You are EDUWILLS Book Intelligence AI, an expert educational quiz writer.\\n\\nGenerate EXACTLY \\${count} factual multiple-choice questions about ONLY this exact book: \\${book.title} by \\${book.author}.\\n\\nIDENTITY LOCK: The title and author together identify the exact work. Never substitute another edition, adaptation, similarly named work, mythology source, city, person, or general-knowledge fact.\\n\\nEVIDENCE LOCK: Prefer the exact-book evidence below. When external evidence is present, every question, option, correct answer, and explanation must be supported by it. When external evidence is unavailable, use only well-established knowledge you are genuinely confident is about this exact book. Never guess. Never infer plot, gender, age, occupation, relationships, chronology, setting, nationality, appearance, or events from names or stereotypes.\\n\\nDIVERSITY RULE: Rotate across characters, relationships, events, motivations, setting, chronology, causes, consequences, themes, conflict, decisions, important details, supported inference, literary techniques, symbolism, vocabulary-in-context, and interpretation. Do not ask the same fact twice or use the same question pattern repeatedly.\\n\\nDISTRIBUTION RULE: No single question type should exceed 25% of the batch. At least 60% must test concrete book-specific content. Avoid metadata unless explicitly requested.\\n\\nDIFFICULTY: \\${difficulty}. Easier questions test recall and understanding; harder questions test relationships, causes, consequences, comparison, inference, or interpretation while remaining evidence-grounded.\\n\\nFORMAT: Return ONLY valid JSON: {\\"questions\\":[{\\"question\\":\\"...\\",\\"options\\":[\\"...\\",\\"...\\",\\"...\\",\\"...\\"],\\"answer\\":0,\\"explanation\\":\\"...\\",\\"evidence\\":\\"...\\"}]}. Exactly four plausible options. answer is zero-based. No markdown. No duplicate or closely paraphrased questions.\\n\\nUSER INSTRUCTIONS: \\${instructions || 'Create a diverse quiz from the actual book content.'}\\nPREVIOUS QUESTIONS TO AVOID: \\${previous.slice(-30).join(' | ')}\\n\\nVERIFIED EXACT-BOOK EVIDENCE:\\n\\${evidence.slice(0, 50000)}\\`;\n}`;

source = source.slice(0, start) + prompt + source.slice(end);

const researchStart = source.indexOf('export async function researchBooks(');
const researchEnd = source.indexOf('\n\nfunction promptFor(', researchStart);
if (researchStart < 0 || researchEnd < 0) throw new Error('Could not locate research function safely.');

// Keep the optional focus argument because generateQuiz passes the learner's
// instructions through to researchBooks. This fixes the TS2554 mismatch while
// preserving the existing research behavior for known and unknown books.
const research = `export async function researchBooks(books: QuizBook[], focus = ''): Promise<string> {\n  if (!books.length) return '';\n\n  const curated = curatedFor(books);\n  if (curated) return curated;\n\n  // Unknown books still get catalogue research, but all requests run in parallel.\n  const chunks: string[] = [];\n  await Promise.all(books.map(async (book) => {\n    const title = encodeURIComponent(book.title);\n    const author = encodeURIComponent(book.author);\n    const urls = [\n      \\`https://www.googleapis.com/books/v1/volumes?q=intitle:\\${title}+inauthor:\\${author}&maxResults=10\\`,\n      \\`https://openlibrary.org/search.json?title=\\${title}&author=\\${author}&limit=15&fields=title,author_name,first_sentence,subject,description\\`,\n    ];\n    const results = await Promise.allSettled(urls.map((url) =>\n      fetch(url, { cache: 'no-store' }).then((response) => response.ok ? response.json() : null)\n    ));\n    for (const result of results) {\n      if (result.status !== 'fulfilled' || !result.value) continue;\n      const data: any = result.value;\n      for (const item of data.items || []) {\n        const info = item.volumeInfo || {};\n        if (info.description) chunks.push(\\`Exact-book catalogue description for \\${book.title} by \\${book.author}: \\${info.description}\\`);\n      }\n      for (const item of data.docs || []) {\n        if (item.first_sentence) chunks.push(\\`Exact-book first sentence: \\${(item.first_sentence || []).join(' ')}\\`);\n        if (item.subject) chunks.push(\\`Exact-book subjects: \\${(item.subject || []).slice(0, 40).join(', ')}\\`);\n        if (item.description) chunks.push(\\`Exact-book description: \\${typeof item.description === 'string' ? item.description : JSON.stringify(item.description)}\\`);\n      }\n    }\n  }));\n  return chunks.join('\\\\n').slice(0, 60000);\n}`;

source = source.slice(0, researchStart) + research + source.slice(researchEnd);

const batchStart = source.indexOf('async function generateBatch(');
const batchEnd = source.indexOf('\n\nexport async function generateQuiz(', batchStart);
if (batchStart < 0 || batchEnd < 0) throw new Error('Could not locate quiz batch function safely.');

const batch = `async function generateBatch(\n  book: QuizBook,\n  count: number,\n  difficulty: string,\n  instructions: string,\n  previous: string[],\n  research: string,\n) {\n  const safeCount = Math.min(10, Math.max(1, count));\n  const prompt = promptFor(book, safeCount, difficulty, instructions, previous, research);\n  let lastError: unknown;\n\n  try {\n    const text = await gateway(prompt, 25000);\n    const parsed = parseQuestions(text);\n    if (parsed.length) return parsed;\n    lastError = new Error('Gateway returned no valid questions');\n  } catch (error) {\n    lastError = error;\n  }\n\n  try {\n    const fallbackText = await geminiText(prompt, 25000);\n    const parsed = parseQuestions(fallbackText);\n    if (parsed.length) return parsed;\n    lastError = new Error('Gemini fallback returned no valid questions');\n  } catch (fallbackError) {\n    lastError = fallbackError;\n  }\n\n  throw lastError instanceof Error ? lastError : new Error('AI generation failed');\n}`;

source = source.slice(0, batchStart) + batch + source.slice(batchEnd);
source = source.replace('const batchSize = Math.min(5, share - local.length);', 'const batchSize = Math.min(10, share - local.length);');
source = source.replace('const batchSize = Math.min(10, share - local.length);', 'const batchSize = Math.min(10, share - local.length);');
source = source.replace('while (local.length < share && guard < 12) {', 'while (local.length < share && guard < 6) {');
source = source.replace('while (local.length < share && guard < 8) {', 'while (local.length < share && guard < 6) {');
source = source.replace('if (!added && guard >= 4) break;', 'if (!added && guard >= 2) break;');
source = source.replace('if (!added && guard >= 3) break;', 'if (!added && guard >= 2) break;');
source = source.replace("    if (!evidence.trim()) {\n      throw new Error(`No verified evidence was found for ${book.title} by ${book.author}.`);\n    }\n", '');

fs.writeFileSync(path, source);
console.log('Quiz generator v27 fast/reliable upgrade applied safely.');

const pagePath = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
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
if (!page.includes('async function retryGeneration()')) {
  page = page.replace(
    generateMarker,
    `  async function retryGeneration() {\n    if (!setup) return;\n    setQuizError('');\n    setQuizLoading(true);\n    try {\n      await generate(setup);\n    } catch (error) {\n      setQuizLoading(false);\n      setQuizError(error instanceof Error ? error.message : 'Quiz generation failed. Please try again.');\n    }\n  }\n\n${generateMarker}`
  );
}

const resultsMarker = `  /* ------------------------------------------------------------------------ */\n  /* Results                                                                   */\n  /* ------------------------------------------------------------------------ */`;
if (!page.includes(resultsMarker)) throw new Error('Could not locate quiz results section safely.');
if (!page.includes('Quiz generation needs another attempt')) {
  page = page.replace(
    resultsMarker,
    `  /* ------------------------------------------------------------------------ */\n  /* Generation failure                                                        */\n  /* ------------------------------------------------------------------------ */\n\n  if (setup && quizError && !quizLoading && !qs.length && !done) {\n    return (\n      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6">\n        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-soft">\n          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-700">\n            <XCircle size={30} />\n          </div>\n          <h1 className="mt-5 text-2xl font-black">Quiz generation needs another attempt</h1>\n          <p className="mt-2 text-sm leading-6 text-slate-500">{quizError}</p>\n          <p className="mt-3 text-xs leading-5 text-slate-400">Your saved generation progress is kept so EDUWILLS can resume instead of starting from zero.</p>\n          <div className="mt-6 flex gap-3">\n            <button type="button" onClick={retryGeneration} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-3 font-black text-white">Try again</button>\n            <button type="button" onClick={resetQuiz} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-black text-slate-700">Back to Quiz Studio</button>\n          </div>\n        </div>\n      </main>\n    );\n  }\n\n${resultsMarker}`
  );
}

fs.writeFileSync(pagePath, page);
console.log('Quiz Studio fast generation and failure-state repair applied.');