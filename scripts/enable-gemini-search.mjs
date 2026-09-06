import fs from 'node:fs';

const stablePath = 'lib/quizAiClientStable.ts';
const clientPath = 'lib/quizAiClient.ts';

let stable = fs.readFileSync(stablePath, 'utf8');
let client = fs.readFileSync(clientPath, 'utf8');

if (!stable.includes('async function gatewayResearch(')) {
  const marker = "async function geminiText(prompt: string, timeout = 60000) {";
  const insertion = `async function gatewayResearch(prompt: string, timeout = 60000) {
  const url = await gatewayUrl();
  const user = auth.currentUser;
  if (!url) throw new Error('AI_GATEWAY_NOT_CONFIGURED');
  if (!user) throw new Error('AUTHENTICATION_REQUIRED');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'research', prompt }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data?.error || data?.message || '').trim();
      throw new Error(\`AI_RESEARCH_GATEWAY_\${response.status}\${detail ? \`: \${detail}\` : ''}\`);
    }
    const sources = Array.isArray(data?.sources) ? data.sources : [];
    const sourceText = sources
      .map((source: any) => `${source?.title || 'Source'} | ${source?.url || ''}`)
      .filter((value: string) => value.trim())
      .join('\\n');
    return [String(data?.text || '').trim(), sourceText ? `SOURCES:\\n${sourceText}` : '']
      .filter(Boolean)
      .join('\\n\\n');
  } finally { window.clearTimeout(timer); }
}

export async function researchWeb(query: string, timeout = 60000): Promise<string> {
  const q = String(query || '').trim();
  if (!q) return '';
  return gatewayResearch(q, timeout);
}

`;
  if (!stable.includes(marker)) throw new Error('Gemini patch marker missing in stable client');
  stable = stable.replace(marker, insertion + marker);
}

stable = stable.replace(
  "const CACHE_VERSION = 'v30-explanation-timer-gateway-first';",
  "const CACHE_VERSION = 'v35-gemini-google-search-research';",
);

if (stable.includes('export async function researchBooks(books: QuizBook[]): Promise<string> {')) {
  stable = stable.replace(
    'export async function researchBooks(books: QuizBook[]): Promise<string> {',
    "export async function researchBooks(books: QuizBook[], focus = ''): Promise<string> {",
  );
}

if (!stable.includes('const geminiBookResearch = await gatewayResearch(')) {
  const anchor = "    const urls = [\n      `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}+inauthor:${author}&maxResults=20`,";
  if (!stable.includes(anchor)) throw new Error('Book research anchor missing in stable client');
  const replacement = `    let geminiBookResearch = '';
    try {
      geminiBookResearch = await gatewayResearch(
        \`Research the exact book "\${book.title}" by \${book.author}.\${focus.trim() ? \` Pay particular attention to this user-requested quiz focus: \${focus.trim()}\` : ''} Find reliable public facts about characters, relationships, events, chronology, setting, themes, conflicts, decisions, chapter details, and distinctive book-specific facts. Prefer authoritative, educational, publisher, library, government, or reputable sources. Do not reproduce long copyrighted passages and do not invent facts.\`,
        60000,
      );
    } catch {}
    if (geminiBookResearch) chunks.push(\`GEMINI GOOGLE SEARCH RESEARCH for \${book.title} by \${book.author}:\\n\${geminiBookResearch}\`);
    const urls = [
      `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}+inauthor:${author}&maxResults=20`,`;
  stable = stable.replace(anchor, replacement);
}

stable = stable.replace(
  'const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book])));',
  'const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book], instructions)));',
);

if (!stable.includes('const liveWebResearch = await gatewayResearch(prompt, 60000).catch(() => \'\');')) {
  const conversationAnchor = "  const conversation = [...history.slice(-8), `Learner: \${prompt}`].join('\\n');";
  if (!stable.includes(conversationAnchor)) throw new Error('Chat research anchor missing in stable client');
  stable = stable.replace(
    conversationAnchor,
    `${conversationAnchor}\n  const liveWebResearch = await gatewayResearch(prompt, 60000).catch(() => '');`,
  );
  const instructionAnchor = '  const instruction = `You are EDUWILLS AI, a study assistant. Answer directly and accurately. If the learner asks about a specific book and the evidence is insufficient, say so instead of inventing details. Plain readable text only. Conversation:\\n\${conversation}`;';
  if (!stable.includes(instructionAnchor)) throw new Error('Chat instruction anchor missing in stable client');
  stable = stable.replace(
    instructionAnchor,
    '  const instruction = `You are EDUWILLS AI, a general educational and knowledge assistant. Answer the learner\'s actual question directly. Use the live web research below when relevant. Treat it as evidence, cross-check conflicts, never invent sources or facts, and say when evidence is incomplete.\n\nLIVE GOOGLE SEARCH RESEARCH:\\n${liveWebResearch || \'No live web research was available.\'}\\n\\nConversation:\\n${conversation}`;',
  );
}

if (!client.includes("const CACHE_VERSION = 'v35-gemini-google-search-research';")) {
  client = client.replace(
    "const CACHE_VERSION = 'v34-web-research-strict-instructions';",
    "const CACHE_VERSION = 'v35-gemini-google-search-research';",
  );
}

if (!client.includes('let geminiResearch =')) {
  const anchor = '  const endpoints = await Promise.all([';
  if (!client.includes(anchor)) throw new Error('Internet research anchor missing in wrapper client');
  client = client.replace(anchor, "  let geminiResearch = '';\n  try { geminiResearch = await stable.researchWeb(q, 60000); } catch {}\n  " + anchor);
  client = client.replace(
    '  const chunks: string[] = [];',
    "  const chunks: string[] = geminiResearch ? [`GEMINI GOOGLE SEARCH RESEARCH\\n${geminiResearch}`] : [];",
  );
}

fs.writeFileSync(stablePath, stable);
fs.writeFileSync(clientPath, client);
console.log('Gemini Google Search bridge applied to quiz and chat clients.');
