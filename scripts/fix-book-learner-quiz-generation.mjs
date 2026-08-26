import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let s = fs.readFileSync(path, 'utf8');

// Never allow the quiz AI client to invent a placeholder book.
s = s.replace(
  "export async function generateQuiz(books:QuizBook[],count:number,difficulty:string,instructions:string,recent:string[]=[],research=''):Promise<QuizQuestion[]>{const requested=Math.min(100,Math.max(1,Number(count)||10));const selected=books.length?books:[{title:'Selected book',author:'Unknown'}];",
  "export async function generateQuiz(books:QuizBook[],count:number,difficulty:string,instructions:string,recent:string[]=[],research=''):Promise<QuizQuestion[]>{const requested=Math.min(100,Math.max(1,Number(count)||10));if(!Array.isArray(books)||!books.length)throw new Error('BOOK_SELECTION_REQUIRED');const selected=books.filter(b=>b&&String(b.title||'').trim()&&String(b.author||'').trim());if(!selected.length)throw new Error('BOOK_SELECTION_REQUIRED');"
);

// Make research lazy: cache is checked before external book APIs are called.
s = s.replace(
  "async function generateForBook(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string):Promise<QuizQuestion[]>{const requested=Math.max(0,Math.min(100,count));if(!requested)return[];const key=await bookCacheKey(book,difficulty,instructions);const cached=await readSharedCache(key,recent);",
  "async function generateForBook(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string):Promise<QuizQuestion[]>{const requested=Math.max(0,Math.min(100,count));if(!requested)return[];if(!book||!String(book.title||'').trim()||!String(book.author||'').trim())throw new Error('BOOK_SELECTION_REQUIRED');const key=await bookCacheKey(book,difficulty,instructions);const cached=await readSharedCache(key,recent);"
);

// Replace the end of generateForBook so research is fetched only after the cache is insufficient.
s = s.replace(
  "if(accepted.length>=requested)return accepted.slice(0,requested);if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');let attempts=0;",
  "if(accepted.length>=requested)return accepted.slice(0,requested);if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');if(!research)research=await researchBooks([book]);let attempts=0;"
);

fs.writeFileSync(path, s);

// Page-level generation must not perform research before the cache-first client runs.
const page = 'app/dashboard/quiz/page.tsx';
let p = fs.readFileSync(page, 'utf8');
p = p.replace(
  "const research = await researchBooks(current.books);\n      const recent = Array.isArray(qs) ? qs.map((q) => q.question) : [];\n      const generated = await generateQuiz(current.books, current.questions, current.difficulty, current.instructions, recent, research);",
  "const recent = Array.isArray(qs) ? qs.map((q) => q.question) : [];\n      // generateQuiz is cache-first; it performs external book research only after a cache miss.\n      const generated = await generateQuiz(current.books, current.questions, current.difficulty, current.instructions, recent, '');"
);
fs.writeFileSync(page, p);

console.log('Book Learner quiz generation fixed: hard book guard + cache-first research.');
