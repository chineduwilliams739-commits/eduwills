import fs from 'node:fs';

const stablePath = 'lib/quizAiClientStable.ts';
const clientPath = 'lib/quizAiClient.ts';

let stable = fs.readFileSync(stablePath, 'utf8');
let client = fs.readFileSync(clientPath, 'utf8');

// This script is intentionally idempotent. It patches the checked-in clients directly
// so a successful gateway deployment cannot leave the production client on the old
// static-only research path.
stable = stable.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v36-gemini-google-search-live';");
client = client.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v36-gemini-google-search-live';");

if (!stable.includes('async function gatewayResearch(')) {
  const marker = 'async function geminiText(prompt: string, timeout = 60000) {';
  if (!stable.includes(marker)) throw new Error('Gemini patch marker missing in stable client');
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
      .map((source: any) => \`${source?.title || 'Source'} | ${source?.url || ''}\`)
      .filter((value: string) => value.trim())
      .join('\\n');
    return [String(data?.text || '').trim(), sourceText ? \`SOURCES:\\n\${sourceText}\` : '']
      .filter(Boolean)
      .join('\\n\\n');
  } finally {
    window.clearTimeout(timer);
  }
}

export async function researchWeb(query: string, timeout = 60000): Promise<string> {
  const q = String(query || '').trim();
  if (!q) return '';
  return gatewayResearch(q, timeout);
}

`;
  stable = stable.replace(marker, insertion + marker);
}

// Make book research instruction-aware and add live Google Search grounding before
// the catalogue fallbacks. The exact-book prompt still enforces identity/evidence.
if (stable.includes('export async function researchBooks(books: QuizBook[]): Promise<string> {')) {
  stable = stable.replace(
    'export async function researchBooks(books: QuizBook[]): Promise<string> {',
    "export async function researchBooks(books: QuizBook[], focus = ''): Promise<string> {",
  );
}

if (!stable.includes('GEMINI GOOGLE SEARCH RESEARCH for')) {
  const anchor = '    const author = encodeURIComponent(book.author);\n    const urls = [';
  if (!stable.includes(anchor)) throw new Error('Book research anchor missing in stable client');
  const replacement = `    const author = encodeURIComponent(book.author);
    let geminiBookResearch = '';
    try {
      geminiBookResearch = await gatewayResearch(
        \`Research the exact book "\${book.title}" by \${book.author}.\${focus.trim() ? \` Pay particular attention to this user-requested quiz focus: \${focus.trim()}\` : ''} Find reliable public facts about characters, relationships, events, chronology, setting, themes, conflicts, decisions, chapter details, and distinctive book-specific facts. Prefer authoritative, educational, publisher, library, government, or reputable sources. Do not reproduce long copyrighted passages and do not invent facts.\`,
        60000,
      );
    } catch {}
    if (geminiBookResearch) chunks.push(\`GEMINI GOOGLE SEARCH RESEARCH for \${book.title} by \${book.author}:\\n\${geminiBookResearch}\`);
    const urls = [`;
  stable = stable.replace(anchor, replacement);
}

stable = stable.replace(
  /const evidenceByBook = await Promise\.all\(books\.map\(async \(book\) => researchBooks\(\[book\](?:, instructions)?\)\)\);/,
  'const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book], instructions)));',
);

// Replace the old static-only chat implementation with a live-search-first path.
const askPattern = /export async function askEduwills\(prompt: string, history: string\[\] = \[\]\) \{[\s\S]*?\n\}\n\nfunction readableExplanation/;
if (askPattern.test(stable)) {
  stable = stable.replace(askPattern, `export async function askEduwills(prompt: string, history: string[] = []) {
  const conversation = [...history.slice(-8), \`Learner: \${prompt}\`].join('\\n');
  const liveWebResearch = await gatewayResearch(prompt, 60000).catch(() => '');
  const instruction = \`You are EDUWILLS AI, a general educational and knowledge assistant. Answer the learner's actual question directly. Use the live Google Search research below whenever relevant. Treat it as evidence, cross-check conflicting claims, never invent sources or facts, and clearly state when reliable evidence is incomplete. Plain readable text only.

LIVE GOOGLE SEARCH RESEARCH:
\${liveWebResearch || 'No live web research was available.'}

Conversation:
\${conversation}\`;
  try {
    return clean(await gateway(instruction, 60000));
  } catch {
    try {
      return clean(await geminiText(instruction, 60000));
    } catch {
      return 'EDUWILLS AI is temporarily busy. Please try again in a moment.';
    }
  }
}

function readableExplanation`);
} else {
  throw new Error('askEduwills implementation anchor missing in stable client');
}

// The wrapper re-exports the stable client, so its version must move with the stable
// implementation. Avoid injecting a second research request here.

fs.writeFileSync(stablePath, stable);
fs.writeFileSync(clientPath, client);
console.log('Gemini Google Search bridge applied to quiz and chat clients.');
