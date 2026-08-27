import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(/const CACHE='[^']+';/, "const CACHE='v23-evidence-grounded-exact-book';");

const sanyaEvidence = [
  'EXACT-BOOK RESEARCH EVIDENCE — Sànyà by Oyin Olugbile.',
  'Sànyà is Oyin Olugbile’s debut novel, published by Masobe Books in 2022, and reimagines Yoruba mythology.',
  'Sànyà is female. Do not describe Sànyà as male, a boy, a man, he, him, or his.',
  'Sànyà is the younger sibling of Dàda. Dàda is her sickly elder brother.',
  'Àjokè and Aganjú are Sànyà and Dàda’s parents.',
  'Àbíké is Àjokè’s twin sister and becomes the siblings’ caregiver after tragedy.',
  'The family is associated with Bániré village. After the deaths of Àjokè and Aganjú, Sànyà and Dàda are taken to Arómiré to live under Àbíké’s care.',
  'Chapter 1 begins with Àjokè waking beside Aganjú before an important journey at sunrise and notes that six years have passed since the birth of her first child, Dàda.',
  'The novel follows Sànyà’s unusual powers, prophecy, dangerous love, family conflict, and a war that tears the family apart.',
  'Reviews describe Sànyà as a protector of Dàda, stronger than her brother, and a woman who challenges patriarchal expectations.',
  'The broader fictional setting is a fantastical empire with Òrìṣà and Yoruba-mythological elements.',
  'Later critical material discusses Sànyà as a female warrior, Dàda’s rise to kingship, and conflict between the siblings.',
  'Only supplied exact-book evidence may be used. If evidence is insufficient, do not guess.'
].join(' ');

const marker = "const BASE='/eduwills';";
if (!s.includes(marker)) throw new Error('Quiz AI BASE marker not found');
if (!s.includes('EDUWILLS_SANYA_EVIDENCE_V8')) {
  s = s.replace(marker, marker + "\nconst EDUWILLS_SANYA_EVIDENCE_V8=" + JSON.stringify(sanyaEvidence) + ";");
}

const validOld = "const valid=(q:any)=>!!q&&typeof q.question==='string'&&q.question.length>18&&Array.isArray(q.options)&&q.options.length===4&&q.options.every((x:any)=>typeof x==='string'&&x.trim())&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4;";
const validNew = "const valid=(q:any)=>!!q&&typeof q.question==='string'&&q.question.length>18&&Array.isArray(q.options)&&q.options.length===4&&q.options.every((x:any)=>typeof x==='string'&&x.trim())&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4&&typeof q.evidence==='string'&&q.evidence.trim().length>=12;";
if (s.includes(validOld)) s = s.replace(validOld, validNew);

if (!s.includes('function evidenceGroundedV8')) {
  const insertBefore = 'async function hashKey(value:string)';
  const helper = `function evidenceGroundedV8(q:any,research:string,book:QuizBook){
  const title=norm(book.title),author=norm(book.author);
  const blob=norm(String(q.question||'')+' '+String(q.options?.join(' ')||'')+' '+String(q.explanation||''));
  const ev=norm(String(q.evidence||''));
  if(!ev||ev.length<12)return false;
  const source=norm(research||'');
  if(title==='sanya'&&author.includes('oyin olugbile')){
    if(/\\bsanya\\b[^.]{0,100}\\b(male|man|boy|he|him|his)\\b|\\b(male|man|boy|he|him|his)\\b[^.]{0,100}\\bsanya\\b/i.test(blob))return false;
    const allowed=['sanya','dada','ajoke','aganj u','abike','banire','aromire','orisa','sango','masobe','oyin olugbile'];
    const proper=(String(q.question||'')+' '+String(q.options?.join(' ')||'')).match(/\\b[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-Ýà-öø-ÿ’'-]{2,}\\b/g)||[];
    for(const name of proper){const n=norm(name);if(n.length>2&&!allowed.some(a=>n===norm(a)||n.includes(norm(a))))return false;}
    if(!source.includes('sanya'))return false;
  }
  const words=ev.split(' ').filter(w=>w.length>=5);
  const hits=words.filter(w=>source.includes(w)).length;
  return hits>=Math.min(3,Math.max(1,words.length>=8?3:2));
}

`;
  if (!s.includes(insertBefore)) throw new Error('Quiz hash marker not found');
  s = s.replace(insertBefore, helper + insertBefore);
}

const keyLine = "const key=await bookCacheKey(book,difficulty,instructions);";
if (!s.includes('EDUWILLS_SANYA_RESEARCH_V8')) {
  if (!s.includes(keyLine)) throw new Error('book cache key marker not found');
  s = s.replace(keyLine, keyLine + "\nconst EDUWILLS_SANYA_RESEARCH_V8=(norm(book.title)==='sanya'&&norm(book.author).includes('oyin olugbile'))?(EDUWILLS_SANYA_EVIDENCE_V8+'\\n'+research):research;");
}
s = s.replace(/buildPrompt\(book,batch,difficulty,instructions,\[\.\.\.recent,\.\.\.accepted\.map\(q=>q\.question\)\],research\)/g,
  'buildPrompt(book,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],EDUWILLS_SANYA_RESEARCH_V8)'
);

s = s.replace(
  'Never invent unsupported facts or quotations. Use exactly four plausible options and one correct answer.',
  'NEVER_INFER_BOOK_FACTS_V8: Never invent unsupported facts, characters, places, events, relationships, chronology, quotations, gender, or settings. Never infer from a character name or from general mythology. Every question and every option must be supported by the supplied EXACT-BOOK RESEARCH EVIDENCE. Include an evidence field containing a concise exact-book evidence basis. If four supported options cannot be made, do not fabricate names; return fewer questions so the client can retry. Use exactly four plausible options and one correct answer.'
);

s = s.replace(
  'Return ONLY JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}',
  'Return ONLY JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","evidence":"Exact-book evidence supporting the question and correct answer."}]}'
);

s = s.replace(/let attempts=0;while\(accepted\.length<requested&&attempts<4\)/,
  'let attempts=0;const maxAttempts=Math.max(10,Math.ceil(requested/12)+4);while(accepted.length<requested&&attempts<maxAttempts)'
);
s = s.replace(/const batch=Math\.min\(8,remaining\);/g, 'const batch=Math.min(12,remaining);');
s = s.replace(/const batch=Math\.min\(8, remaining\);/g, 'const batch=Math.min(12, remaining);');

const acceptance = 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;';
if (!s.includes('EDUWILLS_EVIDENCE_GUARD_V8')) {
  if (!s.includes(acceptance)) throw new Error('Quiz acceptance marker not found');
  s = s.replace(acceptance,
    "if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||!evidenceGroundedV8(q,EDUWILLS_SANYA_RESEARCH_V8,book))continue; // EDUWILLS_EVIDENCE_GUARD_V8"
  );
}

s = s.replace(
  'if(added===0)break}',
  'if(accepted.length)await writeSharedCache(key,accepted);if(added===0)break}'
);

s = s.replace(
  "if(accepted.length<requested)throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`);",
  "if(accepted.length<requested){if(accepted.length)await writeSharedCache(key,accepted);throw new Error('AI_GENERATION_FAILED: verified '+accepted.length+' of '+requested+' questions for '+book.title+'. Verified partial questions are cached; Retry generation will resume from them.');}"
);

if (!s.includes('EDUWILLS_SANYA_INVALID_GENDER_V8')) {
  const evidenceLine = 'const EDUWILLS_SANYA_EVIDENCE_V8=';
  const pos = s.indexOf(evidenceLine);
  if (pos < 0) throw new Error('Sànyà evidence marker not found');
  const lineEnd = s.indexOf(';', pos);
  const guard = "\nconst EDUWILLS_SANYA_INVALID_GENDER_V8=(q:any)=>/\\bs[àa]ny[àa]\\b[^.]{0,100}\\b(male|man|boy|he|him|his)\\b|\\b(male|man|boy|he|him|his)\\b[^.]{0,100}\\bs[àa]ny[àa]\\b/i.test(String(q?.question||'')+' '+String(q?.options?.join(' ')||'')+' '+String(q?.explanation||''));";
  s = s.slice(0,lineEnd+1)+guard+s.slice(lineEnd+1);
  s = s.replace(
    '||!evidenceGroundedV8(q,EDUWILLS_SANYA_RESEARCH_V8,book))continue;',
    '||!evidenceGroundedV8(q,EDUWILLS_SANYA_RESEARCH_V8,book)||((norm(book.title)==="sanya"&&norm(book.author).includes("oyin olugbile"))&&EDUWILLS_SANYA_INVALID_GENDER_V8(q)))continue;'
  );
}

fs.writeFileSync(path, s);
console.log('Quiz grounding v8 applied: exact-book evidence gate, anti-invention character guard, Sànyà factual protection, evidence validation, partial caching after every batch, resumable retry, and up-to-100 generation.');
