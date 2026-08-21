import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const must = (condition, message) => { if (!condition) throw new Error(message); };

write('lib/quizAiClient.ts', read('scripts/quizAiClient.final.ts'));

let quiz = read('app/dashboard/quiz/page.tsx');
quiz = quiz.replace("import { explainFailure as explainQuizFailure, generateQuiz, generateRemarks, researchBooks } from '@/lib/quizAiClient';", "import { explainFailure as explainQuizFailure, generateQuiz, generateRemarks, researchBooks, searchBookAuthors } from '@/lib/quizAiClient';");
quiz = quiz.replace(/type CuratedBook = [^\n]+\n\nconst CURATED_BOOKS:[\s\S]*?\n\];\n\n/, '');
quiz = quiz.replace("const [freeQuizCount, setFreeQuizCount] = useState(0), [timeWarning, setTimeWarning] = useState('');", "const [freeQuizCount, setFreeQuizCount] = useState(0), [timeWarning, setTimeWarning] = useState('');\n  const [username, setUsername] = useState('');");
quiz = quiz.replace("const d = s.data() || {};\n      const isActive", "const d = s.data() || {};\n      setUsername(String(d.username || d.userName || d.fullName || u.displayName || '').replace(/^@/, '').trim());\n      const isActive");
quiz = quiz.replace(/  async function findBook\(\) \{[\s\S]*?\n  \}\n\n  async function searchAuthor\(\) \{/, `  async function findBook() {
    const raw = title.trim(); if (!raw) return;
    setSearching(true); setMessage(''); setAuthors([]); setAuthor(''); setAuthorQuery('');
    try {
      const results = await searchBookAuthors('title', raw);
      const exact = results.filter(r => normalize(r.title) === normalize(raw));
      const usable = exact.length ? exact : results.slice(0, 50);
      const names = Array.from(new Set(usable.flatMap(r => r.authors).filter(Boolean))).slice(0, 50);
      setAuthors(names);
      setMessage(names.length ? 'Select a verified author from the broadened book index.' : 'No verified author was found. Try the exact title or search the author by name.');
    } catch { setMessage('Book search is temporarily unavailable.'); } finally { setSearching(false); }
  }

  async function searchAuthor() {`);
quiz = quiz.replace(/  async function searchAuthor\(\) \{[\s\S]*?\n  \}\n\n  async function saveBook\(\) \{/, `  async function searchAuthor() {
    const q = authorQuery.trim(); if (!q) return;
    setSearching(true);
    try {
      const results = await searchBookAuthors('author', q);
      const names = Array.from(new Set(results.flatMap(r => r.authors).filter(Boolean))).slice(0, 50);
      setAuthors(names);
      setMessage(names.length ? 'Select a verified author from the broadened book index.' : 'No verified author match was found. Try another spelling.');
    } finally { setSearching(false); }
  }

  async function saveBook() {`);

// Keep the generated source deliberately free of nested template literals. The previous
// repair used backticks inside a backtick-delimited patch string, which made this repair
// script itself invalid JavaScript and stopped every deployment before the app was built.
const imagePatch = [
  "  function makeResultImage(): Promise<Blob> {",
  "    return new Promise((resolve) => {",
  "      const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 1000;",
  "      const g = canvas.getContext('2d')!; const score = scoreFor(qs, answers); const pct = scoreFor(qs, answers, true);",
  "      g.fillStyle = '#07111f'; g.fillRect(0, 0, 1400, 1000);",
  "      g.fillStyle = '#123b5d'; g.fillRect(0, 0, 1400, 220);",
  "      g.fillStyle = '#22d3ee'; g.beginPath(); g.arc(1280, 80, 180, 0, Math.PI * 2); g.fill();",
  "      g.fillStyle = '#fff'; g.font = '900 52px sans-serif'; g.fillText('EDUWILLS', 75, 78); g.font = '900 32px sans-serif'; g.fillText('TEST OVERVIEW', 75, 132);",
  "      g.font = '900 116px sans-serif'; g.fillText(String(pct) + '%', 75, 350); g.font = '700 34px sans-serif'; g.fillText(String(score) + '/' + qs.length + ' correct', 80, 405);",
  "      g.font = '600 25px sans-serif';",
  "      const lines = [",
  "        'Username: @' + (username || 'learner'),",
  "        'Date: ' + new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),",
  "        'Books: ' + ((setup && setup.books ? setup.books.map(b => b.title).join(', ') : '') || 'Quiz'),",
  "        'Difficulty: ' + ((setup && setup.difficulty) || 'Mixed'),",
  "        'Time allocated: ' + (setup && setup.duration ? setup.duration + ' minutes' : 'No time limit'),",
  "        'Time elapsed: ' + elapsedText(elapsed)",
  "      ];",
  "      lines.forEach((t, i) => g.fillText(String(t).slice(0, 78), 80, 490 + i * 48));",
  "      g.fillStyle = '#0f2238'; g.beginPath(); g.roundRect(760, 285, 540, 430, 28); g.fill();",
  "      g.fillStyle = '#fff'; g.font = '900 28px sans-serif'; g.fillText('EDUWILLS AI INSIGHT', 805, 340); g.font = '500 23px sans-serif';",
  "      const text = String(feedback || 'Review the correction section to identify your strongest and weakest areas.').replace(/\\s+/g, ' ').trim(); let line = ''; let y = 390;",
  "      for (const word of text.split(' ')) { const test = line ? line + ' ' + word : word; if (g.measureText(test).width > 450) { g.fillText(line, 805, y); y += 36; line = word; if (y > 665) break; } else line = test; }",
  "      if (line && y <= 665) g.fillText(line, 805, y);",
  "      g.fillStyle = '#94a3b8'; g.font = '500 19px sans-serif'; g.fillText('Generated by EDUWILLS', 80, 930); canvas.toBlob(b => resolve(b!), 'image/png');",
  "    });",
  "  }",
  "  async function downloadResult"
].join('\n');

quiz = quiz.replace(/  function makeResultImage\(\): Promise<Blob> \{[\s\S]*?\n  \}\n  async function downloadResult/, imagePatch);
write('app/dashboard/quiz/page.tsx', quiz);

let dashboard = read('app/dashboard/page.tsx');
if (!dashboard.includes("import EducationFeed from '@/components/EducationFeed';")) dashboard = dashboard.replace("import { auth, db } from '@/lib/firebase';", "import { auth, db } from '@/lib/firebase';\nimport EducationFeed from '@/components/EducationFeed';");
if (!dashboard.includes('<EducationFeed />')) dashboard = dashboard.replace("  </div>\n  <nav className=\"fixed bottom-0", "    <EducationFeed />\n  </div>\n  <nav className=\"fixed bottom-0");
write('app/dashboard/page.tsx', dashboard);

must(quiz.includes("searchBookAuthors('title', raw)"), 'Broadened title search was not wired into Quiz Studio.');
must(quiz.includes("searchBookAuthors('author', q)"), 'Broadened author search was not wired into Quiz Studio.');
must(quiz.includes('canvas.width = 1400; canvas.height = 1000;'), 'Fresh quiz result image was not upgraded.');
must(dashboard.includes('<EducationFeed />'), 'EducationFeed component was not wired into the dashboard.');
must(fs.existsSync('components/EducationFeed.tsx'), 'EducationFeed component is missing.');
console.log('EDUWILLS stable implementation applied: broad book knowledge, strict per-book cache-first quiz generation, matching fresh result image, and daily education feed.');
