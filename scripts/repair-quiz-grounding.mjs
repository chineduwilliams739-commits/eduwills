import fs from 'node:fs';

const file = 'lib/quizAiClient.ts';
let s = fs.readFileSync(file, 'utf8');

const marker = "const isMetadata=(q:QuizQuestion)=>";
if (!s.includes(marker)) throw new Error('Quiz AI metadata marker not found.');

if (!s.includes('VERIFIED_BOOK_RESEARCH')) {
  const verified = String.raw`
const VERIFIED_BOOK_RESEARCH:Record<string,string>={
  'sanya|oyin olugbile':[
    'VERIFIED BOOK: Sànyà (2022), by Oyin Olugbile, published by Masobe Books.',
    'VERIFIED SOURCES: Oyin Olugbile official book page; Masobe Books; National Library of Nigeria; 2025 Nigeria Prize for Literature final report.',
    'BOOK FACTS: Sànyà is a mythological fantasy novel that reimagines Yoruba mythology and the legacy of Sango through a female protagonist.',
    'BOOK FACTS: Sànyà is the protagonist and is a girl/woman; she is not male. Her beloved older brother is Dada.',
    'BOOK FACTS: Sànyà and Dada are siblings. Dada is physically weak, highly intelligent and has the gift of seeing into the future.',
    'BOOK FACTS: Sànyà is connected to a prophecy concerning a mighty warrior/leader and has extraordinary powers. Her parents are Ajoke and Aganju.',
    'BOOK FACTS: The story includes dangerous love, family conflict, prophecy, power, ancestry, Yoruba mythology and a war that threatens the family.',
    'GROUNDING RULE: Never describe Sànyà as a boy or male protagonist. Never invent plot details when the supplied evidence does not support them.'
  ].join('\\n'),
  'scars|gen leo irabor':[
    'Use the exact book title and author selected by the learner. Do not substitute another book with a similar title.'
  ].join('\\n'),
  'scars nigeria s journey and the boko haram conundrum|gen leo irabor':[
    'Use the exact book title and author selected by the learner. Do not substitute another book with a similar title.'
  ].join('\\n')
};
function verifiedResearch(books:QuizBook[]){return books.map(b=>VERIFIED_BOOK_RESEARCH[`${norm(b.title)}|${norm(b.author)}`]||'').filter(Boolean).join('\\n');}

`;
  s = s.replace(marker, verified + marker);
}

const old = "const chunks:string[]=[];for(const b of books){";
const replacement = "const verified=verifiedResearch(books);const chunks:string[]=verified?[verified]:[];for(const b of books){";
if (!s.includes(replacement)) {
  if (!s.includes(old)) throw new Error('researchBooks insertion point not found.');
  s = s.replace(old, replacement);
}

fs.writeFileSync(file, s);
console.log('Quiz research now includes verified exact-book grounding for supported titles.');
