import fs from 'node:fs';

const ai='lib/quizAiClient.ts';
let a=fs.readFileSync(ai,'utf8');

// Never silently invent a selected book. A quiz request without a real book is invalid.
a=a.replace(
  "const selected=books.length?books:[{title:'Selected book',author:'Unknown'}];",
  "if (!Array.isArray(books) || !books.length || books.some(b => !String(b?.title || '').trim() || !String(b?.author || '').trim())) throw new Error('BOOK_SELECTION_REQUIRED');\n  const selected=books;"
);

// Research must happen only after the shared cache has been checked. This makes repeat quizzes fast.
a=a.replace(
  "async function generateForBook(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string):Promise<QuizQuestion[]>{",
  "async function generateForBook(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string):Promise<QuizQuestion[]>{"
);
const quotaNeed="if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');";
const researchAfterCache="if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');\n  if(!research) research=await researchBooks([book]);";
if(a.includes(quotaNeed) && !a.includes(researchAfterCache)) a=a.replace(quotaNeed,researchAfterCache);

// Preserve useful upstream errors so the UI can tell the learner what actually failed.
a=a.replace(
  "catch{try{const r=await geminiFallback(prompt);questions=parse(r.response.text())}catch{questions=[]}}",
  "catch(firstError){try{const r=await geminiFallback(prompt);questions=parse(r.response.text())}catch(secondError){const first=firstError instanceof Error?firstError.message:String(firstError);const second=secondError instanceof Error?secondError.message:String(secondError);throw new Error(`AI_GENERATION_FAILED: ${first}; fallback: ${second}`)}}"
);
fs.writeFileSync(ai,a);

const page='app/dashboard/quiz/page.tsx';
let s=fs.readFileSync(page,'utf8');
// The AI client now performs cache-first research. The page must not research before calling it.
s=s.replace(
  "const research = await researchBooks(current.books);\n      const recent = Array.isArray(qs) ? qs.map((q) => q.question) : [];\n      const generated = await generateQuiz(current.books, current.questions, current.difficulty, current.instructions, recent, research);",
  "const recent = Array.isArray(qs) ? qs.map((q) => q.question) : [];\n      const generated = await generateQuiz(current.books, current.questions, current.difficulty, current.instructions, recent, '');"
);
// Keep retry inside Quiz Studio and make each click visibly restart generation.
if(!s.includes('async function retryGeneration()')){
  const marker='  async function submitQuiz';
  if(!s.includes(marker)) throw new Error('submitQuiz marker not found');
  s=s.replace(marker,"  async function retryGeneration() {\n    if (!setup || quizLoading) return;\n    setQuizError(''); setQuizLoading(true); setQs([]);\n    try { await generate(setup); } catch {}\n  }\n\n"+marker);
}
// Make the error screen distinguish quota, missing book, and actual provider failures.
s=s.replace(
  "const message = e?.message === 'AI_QUOTA_EXHAUSTED' ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.' : (e?.message || 'EDUWILLS AI could not finish the requested batch. Please try again.');",
  "const raw = String(e?.message || ''); const message = e?.message === 'AI_QUOTA_EXHAUSTED' ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.' : e?.message === 'BOOK_SELECTION_REQUIRED' ? 'Please select a saved book before generating a quiz.' : raw.startsWith('AI_GENERATION_FAILED:') ? raw.replace('AI_GENERATION_FAILED: ','AI provider error: ') : (raw || 'EDUWILLS AI could not finish the requested batch. Please try again.');"
);
fs.writeFileSync(page,s);
console.log('Book Learner runtime v3 applied: cache-first before research, strict book validation, useful AI errors, and a real retry reset.');
