export type GroundedQuizBook = { title: string; author: string };
export type GroundedQuizQuestion = { question: string; options: string[] };

const norm = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export const VERIFIED_BOOK_RESEARCH: Record<string, string> = {
  'sanya|oyin olugbile': [
    'VERIFIED BOOK: Sànyà (2022), by Oyin Olugbile, published by Masobe Books.',
    'VERIFIED SOURCES: Oyin Olugbile official book page, Masobe Books, National Library of Nigeria, Brittle Paper excerpt, and established reviews of the novel.',
    'BOOK FACT: Sànyà is a mythological fantasy novel and a retelling/reimagining of Yoruba mythology. Sànyà is the female protagonist and the story reimagines Sango through a woman’s perspective.',
    'BOOK FACT: Sànyà is the daughter of Ajoke and Aganju. A prophecy says their next child will be a warrior; the child is a girl.',
    'BOOK FACT: Sànyà protects her elder brother Dada. Dada is physically weak/sickly, highly intelligent, and has the gift of seeing into the future.',
    'BOOK FACT: The story includes Ajoke, Aganju, Dada, Aunt Abike, prophecy, dangerous love, extraordinary powers, family conflict, Yoruba cosmology and a war that threatens the family.',
    'BOOK FACT: Sànyà grew up in a village. The official synopsis describes the people in the village where she grew up, but it does not establish a modern Nigerian city as her primary childhood setting.',
    'BOOK FACT: Ajoke and Aganju meet at a village square during the New Yam festival. Their first child is Dada, and Dada’s illness becomes a major hardship for the family.',
    'GROUNDING RULE: Never describe Sànyà as a boy or male protagonist.',
    'GROUNDING RULE: Never invent a profession, school, workplace, modern city, neighbourhood, cryptocurrency, journalism career, military career, architecture career, hospital, clinic, urban lifestyle or other modern-life detail for Sànyà.',
    'GROUNDING RULE: Do not ask for or claim a primary childhood city for Sànyà. The verified evidence says village, not a named city. Reject city-setting questions instead of guessing.',
    'GROUNDING RULE: Questions must test supported events, characters, relationships, prophecy, Yoruba mythology, family conflict, powers, Dada, Ajoke, Aganju, Abike, Sango, the village setting, or other supplied evidence. Do not turn general Nigeria knowledge into a Sànyà question.'
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
    const rawQuestion = String(q.question || '');

    // Block the known hallucination family that previously described Sànyà as male.
    const badGender = /\b(?:sanya|the protagonist|the main character)\b[\s\S]{0,220}\b(?:he|him|his|boy|male)\b/i.test(rawQuestion)
      || /\b(?:he|him|his|boy|male)\b[\s\S]{0,220}\b(?:sanya|the protagonist|the main character)\b/i.test(rawQuestion);
    if (badGender) return false;

    // Block unsupported modern occupations/settings that have repeatedly appeared
    // in hallucinated Sànyà questions.
    if (/\b(?:medical doctor|journalist|journalism|military officer|architect|architecture|rural clinic|modern housing estate|cryptocurrency|digital technology|urban neighbourhood|urban neighborhood|office job|university student|hospital|clinic)\b/i.test(rawQuestion)) return false;

    // A city/location question must not invent a named Nigerian city. The verified
    // source says Sànyà grew up in a village and does not name a childhood city.
    const cityNames = /\b(?:lagos|abuja|ibadan|port harcourt|benin city|enugu|kano|jos|ilorin|akure|abeokuta|onitsha|warri|kaduna|calabar)\b/i;
    const locationTerms = /\b(?:setting|city|town|childhood|grew up|grew|primary location|main location|neighbourhood|neighborhood|urban|where does|where did|location)\b/i;
    if (cityNames.test(text) && locationTerms.test(text)) return false;
    if (/(?:primary|main|major|specific)\s+(?:setting|location|city|town)/i.test(rawQuestion) && /\b(?:city|town|urban)\b/i.test(rawQuestion)) return false;

    // Prevent generic Nigeria/current-affairs questions from being attached to Sànyà.
    const anchors = [
      'sanya', 'dada', 'ajoke', 'aganju', 'abike', 'warrior', 'prophecy',
      'yoruba', 'sango', 'orisa', 'new yam', 'village', 'brother', 'family',
      'powers', 'mythology', 'mythological', 'dangerous love', 'war'
    ];
    if (!anchors.some((a) => text.includes(a))) return false;
  }

  // Require some lexical connection to the supplied evidence. This is intentionally
  // conservative: if a generated question has no overlap with evidence, discard it
  // and let the batching loop ask the model for another question.
  const evidenceWords = norm(research)
    .split(' ')
    .filter((w) => w.length >= 5)
    .filter((w) => !['about', 'there', 'which', 'their', 'would', 'could', 'these', 'those', 'story', 'book', 'author', 'verified', 'sources', 'grounding', 'question', 'questions'].includes(w));

  if (evidenceWords.length >= 8) {
    const overlap = evidenceWords.filter((w) => text.includes(w)).length;
    if (overlap === 0) return false;
  }

  return true;
}
