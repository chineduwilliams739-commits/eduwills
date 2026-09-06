import fs from 'node:fs';

const stablePath = 'lib/quizAiClientStable.ts';
const clientPath = 'lib/quizAiClient.ts';

let stable = fs.readFileSync(stablePath, 'utf8');
let client = fs.readFileSync(clientPath, 'utf8');

if (!stable.includes('async function gatewayResearch(')) {
  const marker = "async function geminiText(prompt: string, timeout = 60000) {";
  const insertion = `async function gatewayResearch(prompt: string, timeout = 60000) {\n  const url = await gatewayUrl();\n  const user = auth.currentUser;\n  if (!url) throw new Error('AI_GATEWAY_NOT_CONFIGURED');\n  if (!user) throw new Error('AUTHENTICATION_REQUIRED');\n  const token = await user.getIdToken();\n  const controller = new AbortController();\n  const timer = window.setTimeout(() => controller.abort(), timeout);\n  try {\n    const response = await fetch(url, {\n      method: 'POST',\n      headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },\n      body: JSON.stringify({ mode: 'research', prompt }),\n      signal: controller.signal,\n    });\n    const data = await response.json().catch(() => ({}));\n    if (!response.ok) {\n      const detail = String(data?.error || data?.message || '').trim();\n      throw new Error(\`AI_RESEARCH_GATEWAY_\${response.status}\${detail ? \`: \${detail}\` : ''}\`);\n    }\n    const sources = Array.isArray(data?.sources) ? data.sources : [];\n    const sourceText = sources.map((source: any) => `${source?.title || 'Source'} | ${source?.url || ''}`).filter(Boolean).join('\\n');\n    return [String(data?.text || '').trim(), sourceText ? `SOURCES:\\n${sourceText}` : ''].filter(Boolean).join('\\n\\n');\n  } finally { window.clearTimeout(timer); }\n}\n\nexport async function researchWeb(query: string, timeout = 60000): Promise<string> {\n  const q = String(query || '').trim();\n  if (!q) return '';\n  return gatewayResearch(q, timeout);\n}\n\n`;
  if (!stable.includes(marker)) throw new Error('Gemini patch marker missing in stable client');
  stable = stable.replace(marker, insertion + marker);
}

stable = stable.replace(
  'export async function researchBooks(books: QuizBook[]): Promise<string> {',
  'export async function researchBooks(books: QuizBook[], focus = \'\'): Promise<string> {'
);

const researchAnchor = "    const urls = [\n      `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}+inauthor:${author}&maxResults=20`,";
if (!stable.includes('const geminiFocus =')) {
  const replacement = `    const geminiFocus = focus.trim();\n    try {\n      const webEvidence = await gatewayResearch(\`Research the exact book "\${book.title}" by \${book.author}.\${geminiFocus ? ` Focus especially on this user instruction: \${geminiFocus}` : ''} Find reliable public information about the book, its characters, relationships, events, chronology, setting, themes, conflicts, decisions, chapter details, and distinctive facts. Use sources that can support factual quiz questions. Do not reproduce long copyrighted passages.\`, 60000);\n      if (webEvidence) chunks.push(\`GEMINI GOOGLE SEARCH RESEARCH for \${book.title} by \${book.author}:\\n\${webEvidence}\`);\n    } catch {}\n    const urls = [\n      `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}+inauthor:${author}&maxResults=20`,`;
  if (!stable.includes(researchAnchor)) throw new Error('Book research anchor missing in stable client');
  stable = stable.replace(researchAnchor, replacement);
}

stable = stable.replace(
  'const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book])));',
  'const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book], instructions)));'
);

if (!client.includes('const geminiResearch = await stable.researchWeb')) {
  const anchor = '  const endpoints = await Promise.all([';
  const insertion = `  let geminiResearch = '';\n  try { geminiResearch = await stable.researchWeb(q, 60000); } catch {}\n  `;
  if (!client.includes(anchor)) throw new Error('Internet research anchor missing in wrapper client');
  client = client.replace(anchor, insertion + anchor);
  client = client.replace('  const chunks: string[] = [];', "  const chunks: string[] = geminiResearch ? [`GEMINI GOOGLE SEARCH RESEARCH\\n${geminiResearch}`] : [];");
}

stable = stable.replace("const CACHE_VERSION = 'v30-explanation-timer-gateway-first';", "const CACHE_VERSION = 'v35-gemini-google-search-research';");
client = client.replace("const CACHE_VERSION = 'v34-web-research-strict-instructions';", "const CACHE_VERSION = 'v35-gemini-google-search-research';");

fs.writeFileSync(stablePath, stable);
fs.writeFileSync(clientPath, client);
console.log('Gemini Google Search bridge applied to quiz/chat clients.');
