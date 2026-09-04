import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

source = source.replace("const CACHE_VERSION = 'v23-grounded-generator-resume';", "const CACHE_VERSION = 'v24-grounded-diverse-fast-generator';");
source = source.replace("model: 'gemini-3.5-flash-lite',", "model: 'gemini-3.6-flash',");
source = source.replace("    temperature: 0.1,\n", '');

const start = source.indexOf('function promptFor(');
const end = source.indexOf('\n\nasync function generateBatch(', start);
if (start < 0 || end < 0) throw new Error('Could not locate quiz prompt function safely.');

const prompt = `function promptFor(
  book: QuizBook,
  count: number,
  difficulty: string,
  instructions: string,
  previous: string[],
  research: string,
) {
  return \`You are EDUWILLS Book Intelligence AI, an expert educational quiz writer.

Generate EXACTLY \${count} factual multiple-choice questions about ONLY this exact book: \${book.title} by \${book.author}.

IDENTITY LOCK: The title and author together identify the exact work. Never substitute another edition, adaptation, similarly named work, mythology source, city, person, or general-knowledge fact.

EVIDENCE LOCK: Every question, option, correct answer, and explanation must be supported by the exact-book evidence below. If the evidence does not establish a fact, do not use it. Never infer plot, gender, age, occupation, relationships, chronology, setting, nationality, appearance, or events from names or stereotypes.

DIVERSITY RULE: Build a varied question set. Across the batch, deliberately rotate among plot/events, characters, relationships, motivations, setting, chronology, causes and consequences, themes, conflict, decisions, important details, inference, literary techniques, symbolism, vocabulary-in-context, and critical interpretation when supported by the evidence. Do not ask the same fact in different wording. Avoid repeatedly starting questions with the same pattern.

DISTRIBUTION RULE: Do not let more than 25% of the batch focus on one question type. At least 50% should test concrete book-specific content, and the remainder may test supported inference, themes, techniques, or interpretation. Avoid metadata unless explicitly requested.

DIFFICULTY: \${difficulty}. Make the difficulty meaningful: easier questions test recall and understanding; harder questions test relationships, causes, consequences, inference, comparison, or interpretation while remaining evidence-grounded.

FORMAT: Return ONLY valid JSON in this exact shape: {\"questions\":[{\"question\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":0,\"explanation\":\"...\",\"evidence\":\"...\"}]}. Use exactly four plausible options and one correct answer. answer is zero-based. Do not prefix options with A/B/C/D. Do not include markdown. Do not duplicate or closely paraphrase previous questions.

USER INSTRUCTIONS: \${instructions || 'Create a diverse quiz from the actual book content.'}
PREVIOUS QUESTIONS TO AVOID: \${previous.slice(-60).join(' | ')}

VERIFIED EXACT-BOOK EVIDENCE:
\${research.slice(0, 65000)}\`;
}`;

source = source.slice(0, start) + prompt + source.slice(end);
fs.writeFileSync(path, source);
console.log('Quiz generator v24 upgrade applied safely.');
