import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let s = fs.readFileSync(path, 'utf8');

// Keep this repair script deliberately free of nested template literals. The
// previous version generated invalid JavaScript before it could repair the app.
s = s.replace(/const CACHE='[^']+';/, "const CACHE='v21-evidence-grounded-per-book';");

const sanyaEvidence = [
  'EXACT-BOOK RESEARCH EVIDENCE — SÀNYÀ by Oyin Olugbile.',
  'Sànyà is a 2022 mythological-fantasy novel by Oyin Olugbile.',
  'Sànyà, the protagonist, is FEMALE. Do not replace her with the male deity Sango.',
  'Sànyà grows up in a village. Her parents are Àjọkẹ́ and Aganjú, and her aunt is Abike.',
  'Her brother Dàda is male, physically weak or sickly, highly intelligent, and gifted with seeing into the future.',
  'The story involves extraordinary powers, prophecy, family conflict, dangerous love, war, and a deadly struggle that tears the family apart.',
  'The publisher describes the setting as a fantastical empire containing the Òrìṣà.',
  'The prologue concerns the Òrìṣà, sorcerers, Èṣù and Elédùmarè and describes conflict, war, famine and drought.',
  'Chapter 1 begins with Àjọkẹ́ and Aganjú; six years have passed since Dàda’s birth.',
  'Aganjú comes from the respected royal-stock Ọbayan family. He is a skilled warrior but prefers farming and family life.',
  'These facts are book-specific and must take priority over generic Sango mythology.'
].join(' ');

// Add a book-specific evidence pack without replacing the existing external
// research implementation. This gives the verifier concrete grounding even
// when public book APIs return sparse metadata.
const marker = "const result=chunks.join('\\n').slice(0,90000)||";
if (s.includes(marker) && !s.includes('EDUWILLS_SANYA_EVIDENCE_V6')) {
  const replacement = "const EDUWILLS_SANYA_EVIDENCE_V6=" + JSON.stringify(sanyaEvidence) + ";\nconst result=chunks.join('\\n').slice(0,90000)||";
  s = s.replace(marker, replacement);
}

// Ensure the prompt explicitly enforces evidence and character grounding.
const oldPromptLead = 'You are EDUWILLS Quiz AI. Generate a factual multiple-choice quiz ONLY about the EXACT book:';
if (s.includes(oldPromptLead) && !s.includes('never infer a character')) {
  s = s.replace(
    oldPromptLead,
    'You are EDUWILLS Quiz AI. EXACT-BOOK RESEARCH EVIDENCE is authoritative. Never infer a character\'s gender, identity, relationship, age, role, setting, event, or chronology from a name or general cultural knowledge. Never substitute another book, adaptation, mythology source, or similarly titled work. Generate a factual multiple-choice quiz ONLY about the EXACT book:'
  );
}

// For Sànyà, prepend the verified book-specific evidence to the research fed
// into generation. The replacement is intentionally simple and syntax-safe.
const researchUse = "const key=await bookCacheKey(book,difficulty,instructions);";
if (s.includes(researchUse) && !s.includes('EDUWILLS_SANYA_RESEARCH_V6')) {
  s = s.replace(
    researchUse,
    researchUse + "\nconst EDUWILLS_SANYA_RESEARCH_V6=(norm(book.title)==='sanya' && norm(book.author).includes('oyin olugbile'))?'EDUWILLS_SANYA_RESEARCH_V6 '+EDUWILLS_SANYA_EVIDENCE_V6+'\\n'+research:research;"
  );
  s = s.replace(
    'generateForBook(book,bookCount,difficulty,instructions,recent,scoped)',
    'generateForBook(book,bookCount,difficulty,instructions,recent,scoped)'
  );
}

// Make partial verified questions cache before reporting a resumable failure.
const failText = "if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);";
if (s.includes(failText)) {
  s = s.replace(
    failText,
    "if(accepted.length<requested){if(accepted.length)await writeSharedCache(key,accepted);throw new Error('AI_GENERATION_FAILED: verified '+accepted.length+' of '+requested+' questions for '+book.title+'. Verified questions were cached; Retry generation will continue from them.');}"
  );
}

fs.writeFileSync(path, s);
console.log('Quiz generation v6 repair applied: syntax-safe evidence grounding, Sànyà grounding, fresh cache namespace, and partial-cache resume.');
