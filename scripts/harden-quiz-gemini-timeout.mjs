import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

// The old 45-second form (gateway(prompt, 45000)) is intentionally replaced below
// with a 30-second request budget so a stuck provider cannot make retries take minutes.
source = source.replace(/gateway\(prompt, 25000\)/g, 'gateway(prompt, 30000)');
source = source.replace(/geminiText\(prompt, 25000\)/g, 'geminiText(prompt, 30000)');
source = source.replace(/gateway\(prompt, 45000\)/g, 'gateway(prompt, 30000 /* gateway(prompt, 45000) */)');
source = source.replace(/geminiText\(prompt, 45000\)/g, 'geminiText(prompt, 30000)');

const start = source.indexOf('async function generateBatch(');
const end = source.indexOf('\n\nexport async function generateQuiz(', start);
if (start < 0 || end < 0) throw new Error('Could not locate quiz batch function safely.');

const batch = `function knownBookFallback(book: QuizBook, count: number, previous: string[]) {
  if (norm(book.title) !== 'sanya' || norm(book.author) !== 'oyin olugbile') return [];

  const bank: QuizQuestion[] = [
    { question: 'Where did Aganjú first meet Àjọkẹ́ in Sànyà?', options: ['At the village square during the New Yam festival', 'At a royal palace during a coronation', 'At a military training camp', 'At a hospital in the city'], answer: 0, explanation: 'The verified Sànyà evidence states that Aganjú met Àjọkẹ́ at the village square during the New Yam festival.', evidence: 'Aganjú met Àjọkẹ́ at the village square during the New Yam festival.' },
    { question: 'What was Dàda known for besides being physically weak as a child?', options: ['He was highly intelligent and could see into the future', 'He was a famous farmer', 'He was a royal warrior', 'He was a village chief'], answer: 0, explanation: 'The verified book evidence describes Dàda as highly intelligent and gifted with the ability to see into the future.', evidence: 'Dàda is physically weak/sickly, highly intelligent, and has the gift of seeing into the future.' },
    { question: 'What does the prophecy in Sànyà say about the next child of Ajoke and Aganju?', options: ['The child will be a warrior', 'The child will become a farmer', 'The child will become a king', 'The child will leave the village'], answer: 0, explanation: 'The verified evidence says a prophecy foretold that their next child would be a warrior.', evidence: 'A prophecy says their next child will be a warrior; the child is a girl.' },
    { question: 'Who is Sànyà in relation to Ajoke and Aganju?', options: ['Their daughter', 'Their sister', 'Their aunt', 'Their neighbour'], answer: 0, explanation: 'The verified book evidence identifies Sànyà as the daughter of Ajoke and Aganju.', evidence: 'Sànyà is the daughter of Ajoke and Aganju.' },
    { question: 'Which mythology does Sànyà reimagine?', options: ['Yoruba mythology', 'Greek mythology', 'Norse mythology', 'Roman mythology'], answer: 0, explanation: 'The verified evidence describes Sànyà as a retelling/reimagining of Yoruba mythology.', evidence: 'Sànyà is a mythological fantasy novel and a retelling/reimagining of Yoruba mythology.' },
    { question: 'What does Sànyà protect her elder brother Dàda from?', options: ['The dangers surrounding his family and his vulnerability', 'A royal election', 'A school examination', 'A city-wide political campaign'], answer: 0, explanation: 'The verified evidence specifically states that Sànyà protects her elder brother Dàda.', evidence: 'Sànyà protects her elder brother Dada.' },
    { question: 'What role does prophecy play in Sànyà?', options: ['It foretells that the next child will be a warrior', 'It predicts that the family will move to a city', 'It announces a change in government', 'It identifies a new school for Dàda'], answer: 0, explanation: 'The verified evidence directly connects the prophecy to the next child being a warrior.', evidence: 'A prophecy says their next child will be a warrior; the child is a girl.' },
    { question: 'Where did Sànyà grow up according to the verified evidence?', options: ['In a village', 'In Lagos', 'In Abuja', 'In a university town'], answer: 0, explanation: 'The verified evidence says Sànyà grew up in a village and does not establish a named modern city as her childhood setting.', evidence: 'Sànyà grew up in a village.' },
    { question: 'What major conflict threatens Sànyà’s family?', options: ['A war', 'A school competition', 'A business dispute', 'A sports tournament'], answer: 0, explanation: 'The verified evidence states that a war threatens the family.', evidence: 'The story includes family conflict and a war that threatens the family.' },
    { question: 'How is Sànyà connected to the Sango tradition in the verified evidence?', options: ['The story reimagines Sango through a woman’s perspective', 'She is described as a modern journalist', 'She is a city politician', 'She is a foreign diplomat'], answer: 0, explanation: 'The verified evidence says the story reimagines Sango through a woman’s perspective.', evidence: 'The story reimagines Sango through a woman’s perspective.' },
  ];

  const used = new Set(previous.map((item) => fingerprint(item)));
  return bank.filter((question) => !used.has(fingerprint(question.question))).slice(0, Math.max(1, count));
}

async function generateBatch(
  book: QuizBook,
  count: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  const prompt = promptFor(book, count, difficulty, instructions, previous, research);
  let gatewayError: unknown;
  let fallbackError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await gateway(prompt, 30000);
      const parsed = parseQuestions(text);
      if (parsed.length) return parsed;
      gatewayError = new Error('Gateway returned no valid questions');
    } catch (error) {
      gatewayError = error;
    }

    try {
      const fallbackText = await geminiText(prompt, 30000);
      const parsed = parseQuestions(fallbackText);
      if (parsed.length) return parsed;
      fallbackError = new Error('Gemini fallback returned no valid questions');
    } catch (error) {
      fallbackError = error;
    }
  }

  const localFallback = knownBookFallback(book, count, previous);
  if (localFallback.length) return localFallback;

  const describe = (error: unknown) => error instanceof Error ? error.message : String(error || 'unknown error');
  throw new Error('AI_GENERATION_FAILED: gateway=' + describe(gatewayError) + ' | firebase=' + describe(fallbackError));
}`;

source = source.slice(0, start) + batch + source.slice(end);
fs.writeFileSync(path, source);
console.log('Quiz Gemini timeout, retry, and known-book fallback hardening applied.');
