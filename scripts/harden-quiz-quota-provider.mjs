import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v29-gateway-first-fast-generator';");
source = source.replace(/model: 'gemini-[^']+',/, "model: 'gemini-3.5-flash-lite',");

fs.writeFileSync(path, source);
console.log('Quiz provider/cache hardening finalized for gateway-first generation.');
