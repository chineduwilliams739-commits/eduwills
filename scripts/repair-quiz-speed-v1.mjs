import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let src = fs.readFileSync(path, 'utf8');

// Research all selected books concurrently instead of waiting for each book in sequence.
src = src.replace(
  /const chunks:string\[\]=\[\];for\(const b of books\)\{/,
  "const chunks:string[]=[];await Promise.all(books.map(async b=>{"
);
src = src.replace(
  /for\(const r of results\)if\(r\.status==='fulfilled'\)\{[\s\S]*?\}\}const result=chunks\.join\('\\n'\)/,
  (match) => match.replace(/\}\}const result=/, "}}));const result=")
);

// Keep prompts much smaller for tiny quizzes; the model does not need 90k characters for 3-5 questions.
src = src.replace(
  "research.slice(0,90000)",
  "research.slice(0, requested <= 5 ? 24000 : 90000)"
);

// Smaller output and faster fallback limits improve small quiz startup without changing quiz rules.
src = src.replace(
  "maxOutputTokens:9000",
  "maxOutputTokens:5000"
);
src = src.replace(
  "worker(prompt,45000,'quiz')",
  "worker(prompt,30000,'quiz')"
);
src = src.replace(
  "setTimeout(()=>rej(Error('GEMINI_TIMEOUT')),25000)",
  "setTimeout(()=>rej(Error('GEMINI_TIMEOUT')),15000)"
);

fs.writeFileSync(path, src);
console.log('Quiz speed v1 applied: concurrent research, smaller small-quiz prompts, and faster AI timeouts.');
