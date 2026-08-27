import fs from 'node:fs';

const ai='lib/quizAiClient.ts';
let a=fs.readFileSync(ai,'utf8');

const selectedOld="const selected=books.length?books:[{title:'Selected book',author:'Unknown'}];";
const selectedNew="if (!Array.isArray(books) || !books.length || books.some(b => !String(b?.title || '').trim() || !String(b?.author || '').trim())) throw new Error('BOOK_SELECTION_REQUIRED');\n  const selected=books;";
if(a.includes(selectedOld)) a=a.replace(selectedOld,selectedNew);

const oldWrite="async function writeSharedCache(key:string,questions:QuizQuestion[]){if(!questions.length)return;try{const id=`${key.replace(/[^a-zA-Z0-9_-]/g,'_')}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;await setDoc(doc(db,'quizQuestionCache',id),{cacheKey:key,questions:questions.slice(0,100),createdAt:serverTimestamp(),lastUsedAtMs:Date.now(),usageCount:0,expiresAtMs:Date.now()+7*86400000})}catch{}}";
const newWrite="async function writeSharedCache(key:string,questions:QuizQuestion[]){if(!questions.length)return;try{const id=key.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,150);const ref=doc(db,'quizQuestionCache',id);const existing=await getDoc(ref).catch(()=>null);const previous=existing?.exists()?((existing.data().questions||[]) as QuizQuestion[]):[];const merged=[...previous,...questions];const unique:QuizQuestion[]=[];for(const q of merged){if(!valid(q)||unique.some(x=>similar(x.question,q.question)))continue;unique.push(q);if(unique.length>=100)break}await setDoc(ref,{cacheKey:key,questions:unique.slice(0,100),createdAt:existing?.exists()?existing.data().createdAt:serverTimestamp(),lastUsedAtMs:Date.now(),usageCount:Number(existing?.exists()?existing.data().usageCount||0:0),expiresAtMs:Date.now()+7*86400000})}catch{}}";
if(a.includes(oldWrite)) a=a.replace(oldWrite,newWrite);

a=a.replace("candidates.sort((a,b)=>overlap(a)-overlap(b)||Number(a.lastUsedAtMs||0)-Number(b.lastUsedAtMs||0));","candidates.sort((a,b)=>Number(b.questions?.length||0)-Number(a.questions?.length||0)||overlap(a)-overlap(b)||Number(b.lastUsedAtMs||0)-Number(a.lastUsedAtMs||0));");

const quotaNeed="if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');";
const researchAfterCache="if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');\n  if(!research) research=await researchBooks([book]);";
if(a.includes(quotaNeed) && !a.includes(researchAfterCache)) a=a.replace(quotaNeed,researchAfterCache);

a=a.replace("const batch=Math.min(8,remaining);","const batch=Math.min(20,remaining);");

a=a.replace("if(added===0)break}if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);await recordQuota();await writeSharedCache(key,accepted);return accepted.slice(0,requested)}","if(added>0) await writeSharedCache(key,accepted); if(added===0)break}if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again. Resume data has been cached.`);await recordQuota();await writeSharedCache(key,accepted);return accepted.slice(0,requested)}");

a=a.replace("catch{try{const r=await geminiFallback(prompt);questions=parse(r.response.text())}catch{questions=[]}}","catch(firstError){try{const r=await geminiFallback(prompt);questions=parse(r.response.text())}catch(secondError){const first=firstError instanceof Error?firstError.message:String(firstError);const second=secondError instanceof Error?secondError.message:String(secondError);throw new Error(`AI_GENERATION_FAILED: ${first}; fallback: ${second}`)}}");
fs.writeFileSync(ai,a);

const page='app/dashboard/quiz/page.tsx';
let s=fs.readFileSync(page,'utf8');
s=s.replace("const research = await researchBooks(current.books);\n      const recent = Array.isArray(qs) ? qs.map((q) => q.question) : [];\n      const generated = await generateQuiz(current.books, current.questions, current.difficulty, current.instructions, recent, research);","const recent = Array.isArray(qs) ? qs.map((q) => q.question) : [];\n      const generated = await generateQuiz(current.books, current.questions, current.difficulty, current.instructions, recent, '');");
if(!s.includes('async function retryGeneration()')){
  const marker='  async function submitQuiz';
  if(!s.includes(marker)) throw new Error('submitQuiz marker not found');
  s=s.replace(marker,"  async function retryGeneration() {\n    if (!setup || quizLoading) return;\n    setQuizError(''); setQuizLoading(true); setQs([]);\n    try { await generate(setup); } catch {}\n  }\n\n"+marker);
}
s=s.replace("const message = e?.message === 'AI_QUOTA_EXHAUSTED' ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.' : (e?.message || 'EDUWILLS AI could not finish the requested batch. Please try again.');","const raw = String(e?.message || ''); const message = e?.message === 'AI_QUOTA_EXHAUSTED' ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.' : e?.message === 'BOOK_SELECTION_REQUIRED' ? 'Please select a saved book before generating a quiz.' : raw.startsWith('AI_GENERATION_FAILED:') ? raw.replace('AI_GENERATION_FAILED: ','AI provider error: ') : (raw || 'EDUWILLS AI could not finish the requested batch. Please try again.');");
fs.writeFileSync(page,s);
console.log('Book Learner runtime v4 applied: resumable up-to-100 generation, partial-question caching, cache-first research, strict book validation, useful AI errors, and retry resume.');
