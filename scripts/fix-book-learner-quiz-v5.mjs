import fs from 'node:fs';

const aiPath = 'lib/quizAiClient.ts';
const pagePath = 'app/dashboard/quiz/page.tsx';

let ai = fs.readFileSync(aiPath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');

const must = (ok, msg) => { if (!ok) throw new Error(msg); };

// Rotate the cache namespace so previously generated, weakly grounded questions
// are not silently reused. Only questions passing the new evidence verifier enter v21.
ai = ai.replace("const CACHE='v20-cache-first-per-book';", "const CACHE='v21-exact-book-verified';");

// Apply strict book selection directly to the AI client.
const oldFallback = "const selected=books.length?books:[{title:'Selected book',author:'Unknown'}];";
const newSelection = "if(!books.length||books.some(b=>!String(b.title||'').trim()||!String(b.author||'').trim()))throw new Error('BOOK_SELECTION_REQUIRED');const selected=books;";
if (ai.includes(oldFallback)) ai = ai.replace(oldFallback, newSelection);

const oldGrounding = 'Never invent unsupported facts or quotations.';
const newGrounding = 'Never invent unsupported facts or quotations. EXACT-BOOK RESEARCH EVIDENCE: all factual claims must be grounded in evidence for the exact selected book and author. CHARACTER_GROUNDING_RULE: Never infer gender, sex, age, identity, relationship, family role, appearance, nationality, occupation, or any other personal attribute from a character name, stereotype, or outside knowledge. State a character attribute only when it is explicitly supported by the selected book or clearly identified evidence for that exact book. If evidence is insufficient, do not assert the attribute and do not use it as the basis of a quiz question. Never substitute facts from another book, adaptation, summary, or similarly named work.';
if (ai.includes(oldGrounding) && !ai.includes('EXACT-BOOK RESEARCH EVIDENCE')) ai = ai.replace(oldGrounding, newGrounding);

// Require every generated question to carry book-specific evidence and then
// independently verify each question against the exact-book evidence supplied
// to the model. This prevents plausible-sounding generic literary questions
// from being accepted merely because they have valid JSON.
const parseMarker = "function parse(text:string):QuizQuestion[]{";
const parseStart = ai.indexOf(parseMarker);
if (parseStart >= 0 && !ai.includes('async function verifyQuizQuestions')) {
  const parseEnd = ai.indexOf('\nasync function hashKey', parseStart);
  must(parseEnd > parseStart, 'Quiz parser insertion point missing');
  const verifier = `
async function verifyQuizQuestions(book:QuizBook,questions:QuizQuestion[],research:string):Promise<QuizQuestion[]>{
  if(!questions.length)return[];
  const payload=questions.map((q,i)=>({i,question:q.question,options:q.options,answer:q.answer,evidence:q.evidence||'',explanation:q.explanation||''}));
  const prompt=\`You are the final factual verifier for EDUWILLS. Verify ONLY questions about the EXACT BOOK: \${book.title} by \${book.author}. Use ONLY the EXACT-BOOK RESEARCH EVIDENCE below. Do not use memory, general literary knowledge, another edition, another book, an adaptation, a review, or a similarly named work. A question is ACCEPTABLE only if its stem, correct answer, and any asserted character/setting/event detail are directly supported by the supplied evidence. If the evidence is insufficient, ambiguous, contradictory, or does not clearly belong to the exact book, REJECT it. Never infer character gender or other personal attributes from names or stereotypes. Reject metadata-only questions unless explicitly requested. Return ONLY JSON: {\"accepted\":[0,1,...]}. EXACT-BOOK: \${book.title} by \${book.author}\\nEVIDENCE:\\n\${research.slice(0,50000)}\\nQUESTIONS:\\n\${JSON.stringify(payload)}\`;
  let text='';
  try{text=await worker(prompt,18000,'quiz')}catch{try{const r=await geminiFallback(prompt);text=r.response.text()}catch{return[]}}
  try{
    const raw=String(text||'').trim();const a=raw.indexOf('{'),b=raw.lastIndexOf('}');const data=JSON.parse(a>=0&&b>a?raw.slice(a,b+1):raw);const ids=new Set(Array.isArray(data?.accepted)?data.accepted.filter((x)=>Number.isInteger(x)&&x>=0&&x<questions.length):[]);return questions.filter((_,i)=>ids.has(i));
  }catch{return[]}
}
`;
  ai = ai.slice(0, parseEnd) + verifier + ai.slice(parseEnd);
}

// Use reasonably sized batches while supporting quizzes of up to 100 questions.
if (ai.includes('Math.min(8,remaining)')) ai = ai.replaceAll('Math.min(8,remaining)', 'Math.min(20,remaining)');
if (ai.includes('Math.min(8, remaining)')) ai = ai.replaceAll('Math.min(8, remaining)', 'Math.min(20, remaining)');

// Require evidence in the generation contract. The verifier above is the gate;
// evidence-less questions can never become cached questions.
ai = ai.replace('Use exactly four plausible options and one correct answer. Vary facts and avoid duplicates.', 'Use exactly four plausible options and one correct answer. Every question MUST include a concise evidence field identifying the exact-book evidence supporting the question and correct answer. Vary facts and avoid duplicates.');
ai = ai.replace("evidence:clean(q.evidence)})).filter(valid)", "evidence:clean(q.evidence)})).filter(q=>valid(q)&&q.evidence&&q.evidence.length>=12)");

// Persist every successfully verified partial batch so Retry can resume from it.
const oldBatchEnd = "if(added===0)break}if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);await recordQuota();await writeSharedCache(key,accepted);return accepted.slice(0,requested)}";
const newBatchEnd = "await writeSharedCache(key,accepted);if(added===0)break}if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);await recordQuota();await writeSharedCache(key,accepted);return accepted.slice(0,requested)}";
if (ai.includes(oldBatchEnd) && !ai.includes('await writeSharedCache(key,accepted);if(added===0)break')) ai = ai.replace(oldBatchEnd, newBatchEnd);

// Insert the verifier into the generation loop after parsing and before a
// question can be accepted/cached. The marker is deliberately explicit so the
// workflow can validate that this is the actual runtime path.
if (!ai.includes('EDUWILLS_EXACT_BOOK_VERIFICATION_V1')) {
  const loopMarker = "let questions:QuizQuestion[]=[];try{questions=parse(await worker(prompt,18000,'quiz'))}";
  if (ai.includes(loopMarker)) {
    ai = ai.replace(loopMarker, "let questions:QuizQuestion[]=[];try{questions=parse(await worker(prompt,18000,'quiz'));questions=await verifyQuizQuestions(book,questions,research)}");
  } else {
    const fallbackLoop = "let questions:QuizQuestion[]=[];try{questions=parse(await worker(prompt,18000,'quiz'))}catch";
    must(ai.includes(fallbackLoop), 'Quiz generation loop insertion point missing');
    ai = ai.replace(fallbackLoop, "let questions:QuizQuestion[]=[];try{questions=parse(await worker(prompt,18000,'quiz'));questions=await verifyQuizQuestions(book,questions,research)}catch");
  }
  ai += "\n// EDUWILLS_EXACT_BOOK_VERIFICATION_V1: generated questions are evidence-gated before acceptance/cache.\n";
}

fs.writeFileSync(aiPath, ai);

// Verify the actual application source after applying the changes.
must(ai.includes('BOOK_SELECTION_REQUIRED'), 'Strict book validation missing');
must(!ai.includes("title:'Selected book',author:'Unknown'"), 'Obsolete fake selected-book fallback remains');
must(ai.includes('Math.min(20, remaining)') || ai.includes('Math.min(20,remaining)'), 'Batched generation missing');
must(ai.includes('CHARACTER_GROUNDING_RULE'), 'Character grounding guard missing');
must(ai.includes('EXACT-BOOK RESEARCH EVIDENCE'), 'Exact-book evidence grounding missing');
must(ai.includes('verifyQuizQuestions'), 'Exact-book verifier missing');
must(ai.includes('EDUWILLS_EXACT_BOOK_VERIFICATION_V1'), 'Exact-book verification marker missing');
must(ai.includes('evidence&&q.evidence.length>=12'), 'Evidence requirement missing');
must(ai.includes('await writeSharedCache(key,accepted);'), 'Partial-question cache write missing');
must(page.includes('retryGeneration'), 'Quiz retry handler missing');
must(page.includes('Quiz generation could not finish') || page.includes('quizError'), 'Quiz generation error UI missing');
must(page.includes('Generating your quiz') || page.includes('Building your quiz'), 'Quiz loading UI missing');

console.log('Book Learner v6 applied: exact-book evidence-gated verification, character grounding, fresh verified cache namespace, resumable partial caching, batched generation, retry support, and Quiz Studio UI.');

// Apply the resilient v6 runtime after the canonical v5 grounding pass. The
// deploy workflow already executes this v5 script, so this keeps the repair in
// the authoritative build path without adding another fragile workflow step.
await import('./repair-quiz-generation-grounding-v6.mjs');
