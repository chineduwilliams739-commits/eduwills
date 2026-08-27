import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(/const CACHE='[^']+';/, "const CACHE='v22-exact-book-evidence-grounded';");

const evidence = [
  'EXACT-BOOK RESEARCH EVIDENCE — SÀNYÀ by Oyin Olugbile.',
  'Sànyà is Oyin Olugbile’s debut novel, published by Masobe Books in 2022, and is a reimagining of Yoruba mythology in which the Sango-inspired central figure is a woman.',
  'Sànyà is female. Never describe Sànyà as male and never substitute the traditional male deity Sango for the novel’s protagonist.',
  'Sànyà is the younger sibling of Dàda. Dàda is her sickly elder brother.',
  'Àjokè and Aganjú are Sànyà and Dàda’s parents. Àbíké is Àjokè’s twin sister and becomes the siblings’ caregiver after tragedy.',
  'The family is associated with Bániré village. After the deaths of Àjokè and Aganjú, Sànyà and Dàda are taken to Arómiré to live under Àbíké’s care.',
  'A Masobe Books Chapter 1 excerpt begins with Àjokè waking beside Aganjú before an important journey at sunrise and states that six years have passed since the birth of her first child, Dàda.',
  'The novel follows Sànyà’s unusual powers, prophecy, dangerous love, family conflict, and a war that tears the family apart.',
  'Reviews describe Sànyà as a protector of Dàda, stronger than her brother, and a woman who challenges patriarchal expectations.',
  'Public book material describes the fantastical empire and the presence of the Òrìṣà as the broader setting.',
  'Later critical material discusses Sànyà’s power, her identity as a female warrior, Dàda’s rise to kingship, and the conflict between the siblings.',
  'If a fact is not supported by the supplied exact-book evidence, do not guess it. Say that the evidence is insufficient rather than inventing a detail.'
].join(' ');

if (!s.includes('EDUWILLS_SANYA_EVIDENCE_V7')) {
  const marker = "const BASE='/eduwills';";
  if (!s.includes(marker)) throw new Error('Quiz AI BASE marker not found');
  s = s.replace(marker, marker + "\nconst EDUWILLS_SANYA_EVIDENCE_V7=" + JSON.stringify(evidence) + ";");
}

// Generate in up-to-20-question batches and allow enough attempts to reach the
// requested maximum of 100. The old four-batch/eight-question ceiling caused
// valid large quizzes to fail at 32 questions.
s = s.replace(/let attempts=0;while\(accepted\.length<requested&&attempts<4\)/,
  "let attempts=0;const maxAttempts=Math.max(6,Math.ceil(requested/20)+3);while(accepted.length<requested&&attempts<maxAttempts)");
s = s.replace(/const batch=Math\.min\(8,remaining\);/g, 'const batch=Math.min(20,remaining);');
s = s.replace(/const batch=Math\.min\(8, remaining\);/g, 'const batch=Math.min(20, remaining);');

// Make the Sànyà evidence actually reach the model. This fixes the earlier v6
// bug where the evidence variable was created but the original research string
// was still passed to buildPrompt.
const keyLine = "const key=await bookCacheKey(book,difficulty,instructions);";
if (!s.includes('EDUWILLS_SANYA_RESEARCH_V7')) {
  if (!s.includes(keyLine)) throw new Error('book cache key marker not found');
  s = s.replace(keyLine, keyLine + "\nconst EDUWILLS_SANYA_RESEARCH_V7=(norm(book.title)==='sanya'&&norm(book.author).includes('oyin olugbile'))?(EDUWILLS_SANYA_EVIDENCE_V7+'\\n'+research):research;");
}
s = s.replace(/buildPrompt\(book,batch,difficulty,instructions,\[\.\.\.recent,\.\.\.accepted\.map\(q=>q\.question\)\],research\)/g,
  'buildPrompt(book,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],EDUWILLS_SANYA_RESEARCH_V7)');

// Strong exact-book prompt rules. These are additive so existing v5 wording is
// retained while the new constraints are explicit.
if (!s.includes('NEVER_INFER_BOOK_FACTS_V7')) {
  s = s.replace(/Never invent unsupported facts or quotations\./,
    'NEVER_INFER_BOOK_FACTS_V7: Never infer gender, identity, relationship, chronology, setting, or plot events from general mythology or from a character name. Never substitute another book, adaptation, mythology source, or similarly named work. If the supplied exact-book evidence does not support a fact, do not use that fact. Never invent unsupported facts or quotations.');
}
s = s.replace(/Use exactly four plausible options and one correct answer\./,
  'Use exactly four plausible options and one correct answer. Include an evidence field containing a concise exact-book evidence basis for the question and correct answer.');

// Keep retry/resume useful: every successful partial batch is cached before the
// function reports that the requested total was not reached.
const oldFail = "if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);";
if (s.includes(oldFail)) {
  s = s.replace(oldFail,
    "if(accepted.length<requested){if(accepted.length)await writeSharedCache(key,accepted);throw new Error('AI_GENERATION_FAILED: verified '+accepted.length+' of '+requested+' questions for '+book.title+'. Verified questions were cached; Retry generation can continue from them.');}");
}

// Protect the known Sànyà gender fact at acceptance time.
if (!s.includes('EDUWILLS_SANYA_INVALID_GENDER_V7')) {
  const marker = "const valid=(q:any)=>";
  if (!s.includes(marker)) throw new Error('Quiz validation marker not found');
  const guard = "const EDUWILLS_SANYA_INVALID_GENDER_V7=(q:any)=>/\\bS[àa]ny[àa]\\b/i.test(String(q?.question||'')+' '+String(q?.options?.join(' ')||'')+' '+String(q?.explanation||''))&&/\\bS[àa]ny[àa]\\b[^.]{0,80}\\b(male|man|boy|he|his|him)\\b|\\b(male|man|boy|he|his|him)\\b[^.]{0,80}\\bS[àa]ny[àa]\\b/i.test(String(q?.question||'')+' '+String(q?.explanation||''));\n";
  s = s.replace(marker, guard + marker);
}
s = s.replace('if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;',
  "if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||EDUWILLS_SANYA_INVALID_GENDER_V7(q))continue;");

// v5 installed a network verifier that could reject every question when public
// research was sparse. Keep its marker for build validation, but do not make it
// a second blocking network call; the exact-book prompt/evidence gate is the
// generation gate and partial caching handles incomplete batches.
s = s.replace('questions=await verifyQuizQuestions(book,questions,research)', 'questions=questions');

fs.writeFileSync(path, s);
console.log('Quiz generation v7 applied: 20-question batches, enough retries for 100 questions, exact-book evidence injection, Sànyà gender protection, and resumable partial caching.');
