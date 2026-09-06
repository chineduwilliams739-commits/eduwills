export type GroundedQuizBook = { title: string; author: string };
export type GroundedQuizQuestion = { question: string; options: string[] };

const norm = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function canonicalKey(book: GroundedQuizBook) {
  const title = norm(book.title);
  const author = norm(book.author);
  if (title.includes('scars') && author.includes('irabor')) return 'scars|irabor';
  return `${title}|${author}`;
}

export const VERIFIED_BOOK_RESEARCH: Record<string, string> = {
  'sanya|oyin olugbile': [
    'VERIFIED BOOK: Sànyà (2022), by Oyin Olugbile, published by Masobe Books.',
    'VERIFIED SOURCES: Oyin Olugbile official book page, Masobe Books, National Library of Nigeria, Brittle Paper excerpt, and established reviews of the novel.',
    'BOOK FACT: Sànyà is a mythological fantasy novel and a retelling/reimagining of Yoruba mythology. Sànyà is the female protagonist and the story reimagines Sango through a woman’s perspective.',
    'BOOK FACT: Sànyà is the daughter of Ajoke and Aganju. A prophecy says their next child will be a warrior; the child is a girl.',
    'BOOK FACT: Sànyà protects her elder brother Dada. Dada is physically weak/sickly, highly intelligent, and has the gift of seeing into the future.',
    'BOOK FACT: The story includes Ajoke, Aganju, Dada, Aunt Abike, prophecy, dangerous love, extraordinary powers, family conflict, Yoruba cosmology and a war that threatens the family.',
    'BOOK FACT: Sànyà grew up in a village. The verified evidence does not establish a modern Nigerian city as her primary childhood setting.',
    'BOOK FACT: Ajoke and Aganju meet at a village square during the New Yam festival. Their first child is Dada, and Dada’s illness becomes a major hardship for the family.',
    'GROUNDING RULE: Never describe Sànyà as a boy or male protagonist.',
    'GROUNDING RULE: Never invent a profession, school, workplace, modern city, neighbourhood, cryptocurrency, journalism career, military career, architecture career, hospital, clinic, urban lifestyle or other modern-life detail for Sànyà.',
    'GROUNDING RULE: Do not ask for or claim a primary childhood city for Sànyà. Reject city-setting questions instead of guessing.',
    'GROUNDING RULE: Questions must test supported events, characters, relationships, prophecy, Yoruba mythology, family conflict, powers, Dada, Ajoke, Aganju, Abike, Sango, the village setting, or other supplied evidence.'
  ].join('\n'),
  'scars|irabor': [
    'VERIFIED BOOK: SCARS: Nigeria’s Journey and the Boko Haram Conundrum, by General Lucky E. O. Irabor (Retired), published by Story Teller Services in 2025.',
    'BOOK FACT: The book is a reflective account of Nigeria’s security journey and the Boko Haram insurgency, informed by Irabor’s first-hand military experience.',
    'BOOK FACT: The book is organised into 14 chapters and three parts: The Ghost that Lives with Us; The Boko Haram Conundrum; and Eyes Set on Tomorrow.',
    'BOOK FACT: The book discusses insecurity, Boko Haram, terrorism, insurgency, peace and security, governance, political contestation, conflict mitigation, security-sector reform, national reconciliation, judicial reform, and whole-of-government/whole-of-society responses.',
    'BOOK FACT: The book examines the complexity of Nigeria’s response to Boko Haram and reflects on military strategy, political conditions, national cohesion, and the need for longer-term solutions.',
    'BOOK FACT: General Lucky Irabor is the author. Some catalogues inconsistently display his middle name as Leo, but the author identity is Lucky Irabor; quiz grounding must accept Lucky Irabor, Leo Irabor, or General Irabor as the same author identity.',
    'GROUNDING RULE: Do not substitute another book, another author, or invented chapter events.',
    'GROUNDING RULE: Do not import characters, family events, village moves, plot events, or settings from Sànyà or any other book.',
    'GROUNDING RULE: Do not invent unsupported military coups, election crises, boundary disputes, floods, family moves, or unrelated plot events for SCARS.'
  ].join('\n')
};

export function verifiedResearch(books: GroundedQuizBook[]) {
  return books.map((b) => VERIFIED_BOOK_RESEARCH[canonicalKey(b)] || '').filter(Boolean).join('\n');
}

const BOOK_ANCHORS: Record<string, string[]> = {
  'sanya|oyin olugbile': [
    'sanya', 'dada', 'ajoke', 'aganju', 'abike', 'prophecy', 'warrior', 'yoruba',
    'sango', 'orisa', 'new yam', 'village', 'brother', 'family', 'powers',
    'mythology', 'mythological', 'dangerous love', 'cosmology', 'war'
  ],
  'scars|irabor': [
    'scars', 'boko haram', 'lucky irabor', 'leo irabor', 'insecurity', 'under development',
    'underdevelopment', 'political prejudices', 'peace', 'security', 'extremist',
    'extremism', 'terrorism', 'insurgency', 'north east', 'conflict mitigation',
    'security sector reform', 'national reconciliation', 'judicial reform',
    'good governance', 'whole of government', 'whole of society', 'military',
    'national cohesion', 'governance'
  ]
};

export function groundedForBooks(books: GroundedQuizBook[], q: GroundedQuizQuestion, research: string) {
  const text = norm([q.question, ...q.options].join(' '));

  for (const book of books) {
    const key = canonicalKey(book);
    const anchors = BOOK_ANCHORS[key];
    if (!anchors) continue;

    const otherBooks = books.filter((candidate) => canonicalKey(candidate) !== key);
    for (const other of otherBooks) {
      const otherAnchorSet = BOOK_ANCHORS[canonicalKey(other)] || [];
      const foreignSpecific = otherAnchorSet.filter((anchor) =>
        anchor.length >= 6 && anchor !== 'family' && anchor !== 'war' && anchor !== 'peace' && text.includes(anchor),
      );
      if (foreignSpecific.length >= 1 && !anchors.some((anchor) => text.includes(anchor))) return false;
    }

    if (key === 'scars|irabor') {
      if (/\b(?:sanya|oyin olugbile|ajoke|aganju|dada|aunt abike)\b/i.test(text)) return false;
      if (/\b(?:military coup|election crisis|boundary dispute|flood disaster)\b/i.test(text)) return false;
      if (/\b(?:move|moved|moving|family(?:'s|s)? life|family life|village)\b/i.test(text)
        && !/\b(?:boko haram|insecurity|insurgency|north east|conflict|security|governance|terrorism)\b/i.test(text)) return false;
    }

    if (key === 'sanya|oyin olugbile') {
      const rawQuestion = String(q.question || '');
      const badGender = /\b(?:sanya|the protagonist|the main character)\b[\s\S]{0,220}\b(?:he|him|his|boy|male)\b/i.test(rawQuestion)
        || /\b(?:he|him|his|boy|male)\b[\s\S]{0,220}\b(?:sanya|the protagonist|the main character)\b/i.test(rawQuestion);
      if (badGender) return false;
      if (/\b(?:medical doctor|journalist|journalism|military officer|architect|architecture|rural clinic|modern housing estate|cryptocurrency|digital technology|urban neighbourhood|urban neighborhood|office job|university student|hospital|clinic)\b/i.test(rawQuestion)) return false;
      const cityNames = /\b(?:lagos|abuja|ibadan|port harcourt|benin city|enugu|kano|jos|ilorin|akure|abeokuta|onitsha|warri|kaduna|calabar)\b/i;
      const locationTerms = /\b(?:setting|city|town|childhood|grew up|grew|primary location|main location|neighbourhood|neighborhood|urban|where does|where did|location)\b/i;
      if (cityNames.test(text) && locationTerms.test(text)) return false;
      if (/(?:primary|main|major|specific)\s+(?:setting|location|city|town)/i.test(rawQuestion) && /\b(?:city|town|urban)\b/i.test(rawQuestion)) return false;
    }

    if (!anchors.some((anchor) => text.includes(anchor))) return false;

    const evidenceWords = norm(research)
      .split(' ')
      .filter((w) => w.length >= 6)
      .filter((w) => ![
        'about', 'there', 'which', 'their', 'would', 'could', 'these', 'those',
        'story', 'book', 'author', 'verified', 'sources', 'grounding', 'question',
        'questions', 'published', 'retelling', 'perspective', 'official',
        'established', 'establishes', 'evidence', 'general', 'another'
      ].includes(w));

    if (evidenceWords.length >= 8) {
      const overlap = new Set(evidenceWords.filter((w) => text.includes(w)));
      if (overlap.size < 2) return false;
    }
  }

  return true;
}
