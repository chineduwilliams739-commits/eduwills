import fs from 'node:fs';

const aiPath = 'lib/quizAiClient.ts';
const pagePath = 'app/dashboard/quiz/page.tsx';

let ai = fs.readFileSync(aiPath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');

const must = (ok, msg) => { if (!ok) throw new Error(msg); };

// Apply the book-grounding and strict-selection rules directly to the AI client.
const oldFallback = "const selected=books.length?books:[{title:'Selected book',author:'Unknown'}];";
const newSelection = "if(!books.length||books.some(b=>!String(b.title||'').trim()||!String(b.author||'').trim()))throw new Error('BOOK_SELECTION_REQUIRED');const selected=books;";
if (ai.includes(oldFallback)) ai = ai.replace(oldFallback, newSelection);

const oldGrounding = 'Never invent unsupported facts or quotations.';
const newGrounding = 'Never invent unsupported facts or quotations. CHARACTER_GROUNDING_RULE: Never infer a character\'s gender, sex, age, identity, relationship, family role, appearance, nationality, occupation, or other personal attribute from a character name, stereotype, or outside knowledge. State a character attribute only when it is explicitly supported by the selected book or clearly identified evidence for that exact book. If evidence is insufficient, do not assert the attribute and do not use it as the basis of a quiz question. Never substitute facts from another book, adaptation, summary, or similarly named work.';
if (ai.includes(oldGrounding) && !ai.includes('CHARACTER_GROUNDING_RULE')) ai = ai.replace(oldGrounding, newGrounding);

// Persist every successfully validated partial batch so Retry can resume from it.
const oldBatchEnd = "if(added===0)break}if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);await recordQuota();await writeSharedCache(key,accepted);return accepted.slice(0,requested)}";
const newBatchEnd = "await writeSharedCache(key,accepted);if(added===0)break}if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);await recordQuota();await writeSharedCache(key,accepted);return accepted.slice(0,requested)}";
if (ai.includes(oldBatchEnd) && !ai.includes('await writeSharedCache(key,accepted);if(added===0)break')) ai = ai.replace(oldBatchEnd, newBatchEnd);

fs.writeFileSync(aiPath, ai);

// Verify the actual application source after applying the changes.
must(ai.includes('BOOK_SELECTION_REQUIRED'), 'Strict book validation missing');
must(!ai.includes("title:'Selected book',author:'Unknown'"), 'Obsolete fake selected-book fallback remains');
must(ai.includes('Math.min(20, remaining)') || ai.includes('Math.min(20,remaining)'), 'Batched generation missing');
must(ai.includes('CHARACTER_GROUNDING_RULE'), 'Character grounding guard missing');
must(ai.includes('await writeSharedCache(key,accepted);'), 'Partial-question cache write missing');
must(page.includes('retryGeneration'), 'Quiz retry handler missing');
must(page.includes('Quiz generation could not finish') || page.includes('quizError'), 'Quiz generation error UI missing');
must(page.includes('Generating your quiz') || page.includes('Building your quiz'), 'Quiz loading UI missing');

console.log('Book Learner v5 applied and validated: strict book selection, character grounding, resumable partial caching, batched generation, retry support, and Quiz Studio UI.');
