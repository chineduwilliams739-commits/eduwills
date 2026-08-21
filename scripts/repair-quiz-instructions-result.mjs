import fs from 'node:fs';

const aiFile = 'lib/quizAiClient.ts';
let ai = fs.readFileSync(aiFile, 'utf8');

aI = ai.replace(/const CACHE\s*=\s*['\"]v(?:20-cache-first-per-book|21-hard-grounded-book-quiz|22-strict-instructions-quiz)['\"];?/g, "const CACHE='v22-strict-instructions-quiz';");

// This repair used to require one exact historical source shape. The quiz client
// has evolved through several safe implementations, so make this step idempotent
// and tolerant: upgrade the old single-book prompt when present, but never fail
// the deployment when a newer/multi-book prompt is already installed.
if (!ai.includes('FINAL SELF-CHECK')) {
  const promptRe = /function buildPrompt\(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string\[\],research:string\)\{[\s\S]*?\}\n\nasync function generateForBook/;
  if (promptRe.test(ai)) {
    const promptReplacement = String.raw`function buildPrompt(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string){
  const userInstructions=String(instructions||'').trim()||'Create a diverse quiz from the actual book content.';
  return 'You are EDUWILLS Quiz AI. Generate a factual multiple-choice quiz ONLY about the EXACT book: '+book.title+' by '+book.author+'.\\n\\n'
    +'STRICT BOOK SCOPE: every question must be about this exact title and author. Never substitute a similarly named work, adaptation, sequel, review, another author, or another selected book.\\n\\n'
    +'USER INSTRUCTIONS — HARD CONSTRAINTS: '+userInstructions+'\\nTreat every explicit user instruction as mandatory. If the learner asks for a narrow topic, stay on that topic instead of padding with unrelated questions.\\n\\n'
    +'BOOK-CONTENT RULE: At least 90% MUST test concrete content from the exact book: events, incidents, characters, relationships, actions, decisions, settings, chronology, causes, consequences, chapter details or distinctive facts. Metadata such as author/title/publisher/publication is allowed only when explicitly requested. Never invent unsupported facts or quotations.\\n\\n'
    +'OUTPUT CONTRACT: Generate EXACTLY '+count+' questions. Use exactly four plausible options and one correct answer. Vary facts and avoid duplicates. Difficulty: '+difficulty+'. Previous questions to avoid: '+recent.slice(-100).join(' | ')+'.\\n\\n'
    +'RESEARCH EVIDENCE FOR THIS BOOK ONLY:\\n'+research.slice(0, count <= 5 ? 24000 : 90000)+'\\n\\n'
    +'FINAL SELF-CHECK: confirm every question is about the exact book, follows every user instruction, is supported by the evidence, has one unambiguous correct answer, has exactly four options, and is not a duplicate. Return ONLY JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}';}

async function generateForBook`;
    ai = ai.replace(promptRe, promptReplacement);
  } else {
    console.log('Quiz prompt already uses a newer source shape; leaving it unchanged.');
  }
}

fs.writeFileSync(aiFile, ai);

const pageFile = 'app/dashboard/quiz/page.tsx';
let page = fs.readFileSync(pageFile, 'utf8');

const imageRe = /  function makeResultImage\(\): Promise<Blob> \{[\s\S]*?\n  function scoreFor/;
if (!page.includes('function resultFileName()')) {
  const imageReplacement = String.raw`  function resultFileName() {
    const suffix = Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    return 'EDUWILLS-' + suffix + '.png';
  }

  function makeResultImage(): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400; canvas.height = 1050;
      const c = canvas.getContext('2d')!;
      const bg = c.createLinearGradient(0, 0, 1400, 1050); bg.addColorStop(0, '#07142f'); bg.addColorStop(0.52, '#172554'); bg.addColorStop(1, '#0e7490'); c.fillStyle = bg; c.fillRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = 'rgba(255,255,255,.96)'; c.beginPath(); c.roundRect(55, 55, 1290, 940, 42); c.fill();
      c.fillStyle = '#17315f'; c.font = '900 42px system-ui, sans-serif'; c.fillText('EDUWILLS', 105, 125);
      c.fillStyle = '#2563eb'; c.font = '800 20px system-ui, sans-serif'; c.fillText('SMART QUIZ • LEARNING RESULT', 107, 158);
      c.fillStyle = '#0f172a'; c.font = '900 58px system-ui, sans-serif'; c.fillText('Test Overview', 105, 235);
      const pct = scoreFor(qs, answers, true), correct = scoreFor(qs, answers);
      c.fillStyle = '#2563eb'; c.beginPath(); c.arc(1110, 190, 105, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = '900 66px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(String(pct) + '%', 1110, 212); c.font = '700 18px system-ui, sans-serif'; c.fillText(String(correct) + '/' + qs.length + ' correct', 1110, 245); c.textAlign = 'left';
      c.fillStyle = '#0f172a'; c.font = '900 26px system-ui, sans-serif'; c.fillText('Your result', 105, 600);
      c.fillStyle = '#475569'; c.font = '500 20px system-ui, sans-serif'; c.fillText('Review the corrections in EDUWILLS to strengthen your learning.', 105, 635);
      c.fillStyle = '#94a3b8'; c.font = '600 16px system-ui, sans-serif'; c.fillText('Generated by EDUWILLS • Keep learning. Keep improving.', 105, 930);
      canvas.toBlob((b) => resolve(b!), 'image/png', 1);
    });
  }
  async function downloadResult() { const blob = await makeResultImage(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = resultFileName(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  async function shareResult() { const blob = await makeResultImage(); const file = new File([blob], resultFileName(), { type: 'image/png' }); if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'My EDUWILLS quiz result', text: 'My EDUWILLS test result', files: [file] }); else await downloadResult(); }
  function scoreFor`;
  if (imageRe.test(page)) page = page.replace(imageRe, imageReplacement);
  else console.log('Quiz result-image source shape already differs; leaving it unchanged.');
}

fs.writeFileSync(pageFile, page);
console.log('EDUWILLS strict instruction contract and fresh quiz cache namespace applied safely.');
