import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let s = fs.readFileSync(path, 'utf8');

// Fresh namespace prevents previously generated hallucinated questions from
// being reused after the grounding rules change.
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

const evidenceConst = "const EDUWILLS_SANYA_EVIDENCE_V7=" + JSON.stringify(evidence) + ";\n";
if (!s.includes('EDUWILLS_SANYA_EVIDENCE_V7')) {
  const marker = "const BASE='/eduwills';";
  if (!s.includes(marker)) throw new Error('Quiz AI BASE marker not found');
  s = s.replace(marker, marker + "\n" + evidenceConst);
}

// The previous implementation could only make four batches of eight. That
// made legitimate 50-100 question requests fail even when the AI was healthy.
s = s.replace(/let attempts=0;while\(accepted\.length<requested&&attempts<4\)/,
  "let attempts=0;const maxAttempts=Math.max(6,Math.ceil(requested/20)+3);while(accepted.length<requested&&attempts<maxAttempts)");
s = s.replace(/const batch=Math\.min\(8,remaining\);/, 'const batch=Math.min(20,remaining);');

// Make the exact-book evidence actually reach the generation prompt.
const keyLine = "const key=await bookCacheKey(book,difficulty,instructions);";
if (!s.includes('EDUWILLS_SANYA_RESEARCH_V7')) {
  if (!s.includes(keyLine)) throw new Error('book cache key marker not found');
  s = s.replace(keyLine, keyLine + "\nconst EDUWILLS_SANYA_RESEARCH_V7=(norm(book.title)==='sanya'&&norm(book.author).includes('oyin olugbile'))?(EDUWILLS_SANYA_EVIDENCE_V7+'\\n'+research):research;");
  s = s.replace('const prompt=buildPrompt(book,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],research)+', 'const prompt=buildPrompt(book,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],EDUWILLS_SANYA_RESEARCH_V7)+');
}

// Strengthen the prompt so the model cannot fall back to generic mythology or
// a similarly named book. Require a short evidence basis for every question.
const oldLead = 'You are EDUWILLS Quiz AI. Generate a factual multiple-choice quiz ONLY about the EXACT book:';
const newLead = "You are EDUWILLS Quiz AI. EXACT-BOOK EVIDENCE IS AUTHORITATIVE. Generate a factual multiple-choice quiz ONLY about the EXACT book:";
if (s.includes(oldLead)) s = s.replace(oldLead, newLead);
const oldTail = 'Return ONLY JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`}' ;
const newTail = 'Return ONLY JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","evidence":"short exact-book evidence basis"}]}';
if (s.includes(oldTail)) s = s.replace(oldTail, newTail);

// The actual prompt text is one long template literal; apply targeted guards
// independently so this remains compatible with prior v5/v6 variants.
s = s.replace(/Never invent unsupported facts or quotations\./, 'Never invent unsupported facts or quotations. Never infer gender, identity, relationship, chronology, setting, or plot events from general mythology or from a character name. If the supplied exact-book evidence does not support a fact, do not use that fact.');
s = s.replace(/Use exactly four plausible options and one correct answer\./, 'Use exactly four plausible options and one correct answer. Every question must have a concise evidence basis from the supplied exact-book research.');

// Cache partial verified work before failing so Retry generation can resume.
const oldFail = "if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);";
const newFail = "if(accepted.length<requested){if(accepted.length)await writeSharedCache(key,accepted);throw new Error('AI_GENERATION_FAILED: verified '+accepted.length+' of '+requested+' questions for '+book.title+'. Verified questions were cached; Retry generation can continue from them.');}";
if (s.includes(oldFail)) s = s.replace(oldFail, newFail);

// Reject obviously unsupported Sànyà gender mistakes before they reach the cache.
const validMarker = "const valid=(q:any)=>";
if (!s.includes('EDUWILLS_SANYA_INVALID_GENDER_V7')) {
  const guard = "const EDUWILLS_SANYA_INVALID_GENDER_V7=(q:any)=>/\\bS[àa]ny[àa]\\b/i.test(String(q?.question||'')+ ' '+String(q?.options?.join(' ')||'')+' '+String(q?.explanation||'')) && /\\bS[àa]ny[àa]\\b[^.]{0,80}\\b(male|man|boy|he|his|him)\\b|\\b(male|man|boy|he|his|him)\\b[^.]{0,80}\\bS[àa]ny[àa]\\b/i.test(String(q?.question||'')+' '+String(q?.explanation||''));\n";
  s = s.replace(validMarker, guard + validMarker);
  s = s.replace('if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;', "if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||EDUWILLS_SANYA_INVALID_GENDER_V7(q))continue;");
}

fs.writeFileSync(path, s);
console.log('Quiz generation v7 applied: 20-question batches, enough retries for 100 questions, exact-book evidence injection, Sànyà gender protection, and resumable partial caching.');
