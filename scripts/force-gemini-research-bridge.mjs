import fs from 'node:fs';

const path = 'lib/quizAiClientStable.ts';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(/const CACHE_VERSION = '[^']+';/, "const CACHE_VERSION = 'v36-gemini-google-search-live';");

if (!s.includes('async function gatewayResearch(')) {
  const marker = 'async function geminiText(prompt: string, timeout = 60000) {';
  if (!s.includes(marker)) throw new Error('gatewayResearch insertion marker not found');
  const bridge = [
    'async function gatewayResearch(prompt: string, timeout = 60000) {',
    '  const url = await gatewayUrl();',
    '  const user = auth.currentUser;',
    "  if (!url || !user) throw new Error('AI_RESEARCH_GATEWAY_UNAVAILABLE');",
    '  const token = await user.getIdToken();',
    '  const controller = new AbortController();',
    '  const timer = window.setTimeout(() => controller.abort(), timeout);',
    '  try {',
    '    const response = await fetch(url, {',
    "      method: 'POST',",
    "      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },",
    "      body: JSON.stringify({ mode: 'research', prompt }),",
    '      signal: controller.signal,',
    '    });',
    '    const data = await response.json().catch(() => ({}));',
    "    if (!response.ok) throw new Error(`AI_RESEARCH_GATEWAY_${response.status}`);",
    '    const sources = Array.isArray(data?.sources) ? data.sources : [];',
    "    const sourceText = sources.map((source) => `${source?.title || 'Source'} | ${source?.url || ''}`).filter((value) => value.trim()).join('\\n');",
    "    return [String(data?.text || '').trim(), sourceText ? `SOURCES:\\n${sourceText}` : ''].filter(Boolean).join('\\n\\n');",
    '  } finally {',
    '    window.clearTimeout(timer);',
    '  }',
    '}',
    '',
    'export async function researchWeb(query: string, timeout = 60000): Promise<string> {',
    "  const q = String(query || '').trim();",
    "  if (!q) return '';",
    '  return gatewayResearch(q, timeout);',
    '}',
    '',
    '',
  ].join('\n');
  s = s.replace(marker, bridge + marker);
}

s = s.replace(
  'export async function researchBooks(books: QuizBook[]): Promise<string> {',
  "export async function researchBooks(books: QuizBook[], focus = ''): Promise<string> {",
);

if (!s.includes('GEMINI GOOGLE SEARCH RESEARCH for')) {
  const anchor = '    const author = encodeURIComponent(book.author);\n    const urls = [';
  if (!s.includes(anchor)) throw new Error('book research insertion marker not found');
  const insert = [
    '    const author = encodeURIComponent(book.author);',
    "    let geminiBookResearch = '';",
    '    try {',
    '      geminiBookResearch = await gatewayResearch(',
    '        `Research the exact book "${book.title}" by ${book.author}.${focus.trim() ? ` Focus on: ${focus.trim()}` : \'\'} Find reliable public facts about characters, relationships, events, chronology, setting, themes, conflicts, decisions, chapters, and distinctive details. Prefer authoritative, educational, publisher, library, government, or reputable sources. Do not invent facts or reproduce long copyrighted passages.`,',
    '        60000,',
    '      );',
    '    } catch {}',
    '    if (geminiBookResearch) chunks.push(`GEMINI GOOGLE SEARCH RESEARCH for ${book.title} by ${book.author}:\\n${geminiBookResearch}`);',
    '    const urls = [',
  ].join('\n');
  s = s.replace(anchor, insert);
}

s = s.replace(
  /const evidenceByBook = await Promise\.all\(books\.map\(async \(book\) => researchBooks\(\[book\](?:, instructions)?\)\)\);/,
  'const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book], instructions)));',
);

const askPattern = /export async function askEduwills\(prompt: string, history: string\[\] = \[\]\) \{[\s\S]*?\n\}\n\nfunction readableExplanation/;
if (askPattern.test(s)) {
  const ask = [
    'export async function askEduwills(prompt: string, history: string[] = []) {',
    '  const conversation = [...history.slice(-8), `Learner: ${prompt}`].join(\'\\n\');',
    "  const liveWebResearch = await gatewayResearch(prompt, 60000).catch(() => '');",
    "  const instruction = `You are EDUWILLS AI, a general educational and knowledge assistant. Answer the learner's actual question directly. Use the live Google Search research below whenever relevant. Treat it as evidence, cross-check conflicts, never invent facts or sources, and clearly state when reliable evidence is incomplete. Plain readable text only.\\n\\nLIVE GOOGLE SEARCH RESEARCH:\\n${liveWebResearch || 'No live web research was available.'}\\n\\nConversation:\\n${conversation}`;",
    '  try {',
    '    return clean(await gateway(instruction, 60000));',
    '  } catch {',
    '    try {',
    '      return clean(await geminiText(instruction, 60000));',
    '    } catch {',
    "      return 'EDUWILLS AI is temporarily busy. Please try again in a moment.';",
    '    }',
    '  }',
    '}',
    '',
    'function readableExplanation',
  ].join('\n');
  s = s.replace(askPattern, ask);
} else {
  throw new Error('askEduwills implementation marker not found');
}

fs.writeFileSync(path, s);
console.log('Deterministic Gemini Google Search bridge applied.');
