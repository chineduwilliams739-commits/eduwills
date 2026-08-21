import fs from 'node:fs';

const path = 'lib/quizAiClient.ts';
let src = fs.readFileSync(path, 'utf8');

// Research is already fetched concurrently by the grounded client. Keep the
// historical research rewrites for older checkouts, but make the speed repair
// tolerant of the current compact implementation.
src = src.replace(
  /const chunks:string\[\]=\[\];for\(const b of books\)\{/,
  "const chunks:string[]=[];await Promise.all(books.map(async b=>{"
);
src = src.replace(
  /for\(const r of results\)if\(r\.status==='fulfilled'\)\{[\s\S]*?\}\}const result=chunks\.join\('\\n'\)/,
  (match) => match.replace(/\}\}const result=/, "}}));const result=")
);

src = src.replace(/research\.slice\(0,90000\)/g, "research.slice(0, count <= 5 ? 24000 : 90000)");
src = src.replace(/research\.slice\(0, requested <= 5 \? 24000 : 90000\)/g, "research.slice(0, count <= 5 ? 24000 : 90000)");
src = src.replace(/maxOutputTokens:(?:9000|7000)/g, "maxOutputTokens:5000");
src = src.replace(/worker\(prompt,45000,'quiz'\)/g, "worker(prompt,30000,'quiz')");
src = src.replace(/worker\(prompt,18000,'quiz'\)/g, "worker(prompt,30000,'quiz')");
src = src.replace(/setTimeout\(\(\)=>rej\(Error\('GEMINI_TIMEOUT'\)\),25000\)/g, "setTimeout(()=>rej(Error('GEMINI_TIMEOUT')),15000)");
src = src.replace(/setTimeout\(\(\)=>rej\(Error\('GEMINI_TIMEOUT'\)\),18000\)/g, "setTimeout(()=>rej(Error('GEMINI_TIMEOUT')),15000)");

fs.writeFileSync(path, src);
console.log('Quiz speed v1 applied: small-quiz prompt limits, 5k output cap, and bounded AI timeouts.');
