import fs from 'node:fs';

const file = 'lib/quizAiClient.ts';
let s = fs.readFileSync(file, 'utf8');
const marker = 'const isMetadata=(q:QuizQuestion)=>';
if (!s.includes(marker)) throw new Error('Quiz AI metadata marker not found.');

const verifiedCode = [
  "const VERIFIED_BOOK_RESEARCH:Record<string,string>={",
  "  'sanya|oyin olugbile':[",
  "    'VERIFIED BOOK: Sànyà (2022), by Oyin Olugbile, published by Masobe Books.',",
  "    'VERIFIED SOURCES: Oyin Olugbile official book page; Masobe Books; National Library of Nigeria; 2025 Nigeria Prize for Literature final report.',",
  "    'BOOK FACTS: Sànyà is a mythological fantasy novel that reimagines Yoruba mythology and the story of Sango through a female protagonist.',",
  "    'BOOK FACTS: Sànyà is the protagonist and is a girl/woman; she is not male. Her older brother is Dada.',",
  "    'BOOK FACTS: Dada is physically weak, highly intelligent and has the gift of seeing into the future.',",
  "    'BOOK FACTS: Sànyà was prophesied before her birth to become a mighty warrior and leader. Her parents are Ajoke and Aganju.',",
  "    'BOOK FACTS: The story includes dangerous love, ancient prophecy, family conflict, extraordinary powers, Yoruba mythology and a war that threatens the family.',",
  "    \"BOOK FACTS: Sànyà is associated with Sango's gifts and characteristics in the novel's reimagining of Yoruba mythology.\",
  "    'GROUNDING RULE: Never describe Sànyà as a boy or male protagonist. Never invent plot details when supplied evidence does not support them.'",
  "  ].join('\\n'),",
  "  'scars|gen leo irabor':['Use the exact selected book title and author. Never substitute a similarly named book.'].join('\\n'),",
  "  'scars nigeria s journey and the boko haram conundrum|gen leo irabor':['Use the exact selected book title and author. Never substitute a similarly named book.'].join('\\n')",
  '};',
  "function verifiedResearch(books:QuizBook[]){return books.map(b=>VERIFIED_BOOK_RESEARCH[norm(b.title)+'|'+norm(b.author)]||'').filter(Boolean).join('\\n');}",
  ''
].join('\n');

if (!s.includes('VERIFIED_BOOK_RESEARCH')) s = s.replace(marker, verifiedCode + marker);

const guardCode = [
  'function groundedForBooks(books:QuizBook[],q:QuizQuestion,research:string){',
  "  const text=norm([q.question,...q.options].join(' '));",
  "  const sanya=books.some(b=>norm(b.title)==='sanya'&&norm(b.author)==='oyin olugbile');",
  '  if(sanya){',
  "    const bad=/\\b(?:sanya|the protagonist|the main character)\\b[\\s\\S]{0,180}\\b(?:he|him|his|boy|male)\\b/i.test(String(q.question))||/\\b(?:he|him|his|boy|male)\\b[\\s\\S]{0,180}\\b(?:sanya|the protagonist|the main character)\\b/i.test(String(q.question));",
  '    if(bad)return false;',
  "    if(/\\b(?:medical doctor|journalist|journalism|military officer|architect|architecture|rural clinic|modern housing estates|urban neighborhoods|cryptocurrency)\\b/.test(text))return false;",
  '  }',
  "  const evidenceWords=norm(research).split(' ').filter(w=>w.length>=5).filter(w=>!['about','there','which','their','would','could','these','those','story','book','author'].includes(w));",
  '  if(evidenceWords.length>=8){const overlap=evidenceWords.filter(w=>text.includes(w)).slice(0,30).length;if(overlap===0)return false;}',
  '  return true;',
  '}',
  ''
].join('\n');
if (!s.includes('function groundedForBooks(')) s = s.replace(marker, guardCode + marker);

const oldResearch = 'const chunks:string[]=[];for(const b of books){';
const newResearch = "const verified=verifiedResearch(books);const chunks:string[]=verified?[verified]:[];for(const b of books){";
if (!s.includes(newResearch)) {
  if (!s.includes(oldResearch)) throw new Error('researchBooks insertion point not found.');
  s = s.replace(oldResearch, newResearch);
}

const oldAccept = 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;';
const newAccept = 'if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q)||!groundedForBooks(books,q,research))continue;';
if (!s.includes(newAccept)) {
  if (!s.includes(oldAccept)) throw new Error('Quiz acceptance guard insertion point not found.');
  s = s.replace(oldAccept, newAccept);
}

s = s.replace(/const batch=Math\.min\(12,remaining\);/g, 'const batch=Math.min(10,remaining);');
s = s.replace(/attempts<12/g, 'attempts<20');

fs.writeFileSync(file, s);
console.log('Quiz research and exact-book grounding repaired.');
