import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let src = fs.readFileSync(path, 'utf8');

src = src.replace(
  /const chunks:string\[\]=\[\];for\(const b of books\)\{/,
  "const chunks:string[]=[];await Promise.all(books.map(async b=>{"
);
src = src.replace(
  /for\(const r of results\)if\(r\.status==='fulfilled'\)\{[\s\S]*?\}\}const result=chunks\.join\('\\n'\)/,
  (match) => match.replace(/\}\}const result=/, "}}));const result=")
);

// buildPrompt receives count; do not reference requested from another scope.
src = src.replace(/research\.slice\(0,90000\)/g, "research.slice(0, count <= 5 ? 24000 : 90000)");
src = src.replace(/research\.slice\(0, requested <= 5 \? 24000 : 90000\)/g, "research.slice(0, count <= 5 ? 24000 : 90000)");
src = src.replace("maxOutputTokens:9000", "maxOutputTokens:5000");
src = src.replace("worker(prompt,45000,'quiz')", "worker(prompt,30000,'quiz')");
src = src.replace("setTimeout(()=>rej(Error('GEMINI_TIMEOUT')),25000)", "setTimeout(()=>rej(Error('GEMINI_TIMEOUT')),15000)");

fs.writeFileSync(path, src);
console.log('Quiz speed v1 applied: concurrent research, small-quiz prompt limits, and bounded AI timeouts.');
