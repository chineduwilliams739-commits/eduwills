export type GroundedQuizBook = { title: string; author: string };
export type GroundedQuizQuestion = { question: string; options: string[] };

const norm = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export const VERIFIED_BOOK_RESEARCH: Record<string, string> = {
  'sanya|oyin olugbile': [
    'VERIFIED BOOK: Sànyà (2022), by Oyin Olugbile, published by Masobe Books.',
    'VERIFIED SOURCES: Oyin Olugbile official book page, Masobe Books, National Library of Nigeria, and the 2025 Nigeria Prize for Literature report.',
    'BOOK FACT: Sànyà is a mythological fantasy novel and a retelling of Yoruba mythology; Sànyà is the female protagonist and is associated with Sango gifts and characteristics.',
    'BOOK FACT: Sànyà is the daughter of Ajoke and Aganju. A prophecy says their next child will be a warrior; the child is a girl.',
    'BOOK FACT: Sànyà protects her elder brother Dada. Dada is physically weak, highly intelligent, and has the gift of seeing into the future.',
    'BOOK FACT: The story includes Ajoke, Aganju, Dada, Aunt Abike, prophecy, dangerous love, extraordinary powers, family conflict, Yoruba cosmology, and a war that threatens the family.',
    'GROUNDING RULE: Never describe Sànyà as a boy or male protagonist. Never invent a profession, city, event, relationship, quote, or plot detail that is not supported by the supplied evidence.'
  ].join('\n'),
  'scars|gen leo irabor': [
    'VERIFIED BOOK: SCARS: Nigeria’s Journey and the Boko Haram Conundrum, by Gen. Leo Irabor (Retired), published in 2025.',
    'BOOK FACT: The book chronicles the impact of Boko Haram on Nigeria using facts and the author’s first-hand experience from military command of operations addressing terrorism and insurgency in the North East.',
    'BOOK FACT: The book discusses insecurity, under-development, political prejudices, peace and security, drivers of extremist activities, conflict mitigation, security-sector reform, national reconciliation, judicial reform, good governance, and whole-of-government/whole-of-society approaches.',
    'GROUNDING RULE: Do not substitute another book, another author, or invented chapter events.'
  ].join('\n'),
  'scars nigeria s journey and the boko haram conundrum|gen leo irabor': [
    'VERIFIED BOOK: SCARS: Nigeria’s Journey and the Boko Haram Conundrum, by Gen. Leo Irabor (Retired), published in 2025.',
    'BOOK FACT: The book chronicles the impact of Boko Haram on the Nigerian state from the author’s first-hand military experience and discusses insecurity, peace, security and governance.',
    'GROUNDING RULE: Do not substitute another book, another author, or invented chapter events.'
  ].join('\n')
};

export function verifiedResearch(books: GroundedQuizBook[]) {
  return books.map((b) => VERIFIED_BOOK_RESEARCH[`${norm(b.title)}|${norm(b.author)}`] || '').filter(Boolean).join('\n');
}

export function groundedForBooks(books: GroundedQuizBook[], q: GroundedQuizQuestion, research: string) {
  const text = norm([q.question, ...q.options].join(' '));
  const exactSanya = books.some((b) => norm(b.title) === 'sanya' && norm(b.author) === 'oyin olugbile');
  if (exactSanya) {
    const badGender = /\b(?:sanya|the protagonist|the main character)\b[\s\S]{0,220}\b(?:he|him|his|boy|male)\b/i.test(String(q.question)) || /\b(?:he|him|his|boy|male)\b[\s\S]{0,220}\b(?:sanya|the protagonist|the main character)\b/i.test(String(q.question));
    if (badGender) return false;
    if (/\b(?:medical doctor|journalist|journalism|military officer|architect|architecture|rural clinic|modern housing estates|cryptocurrency)\b/i.test(text)) return false;
  }
  const evidenceWords = norm(research).split(' ').filter((w) => w.length >= 5).filter((w) => !['about', 'there', 'which', 'their', 'would', 'could', 'these', 'those', 'story', 'book', 'author', 'verified', 'sources', 'grounding'].includes(w));
  if (evidenceWords.length >= 8) {
    const overlap = evidenceWords.filter((w) => text.includes(w)).length;
    if (overlap === 0) return false;
  }
  return true;
}
