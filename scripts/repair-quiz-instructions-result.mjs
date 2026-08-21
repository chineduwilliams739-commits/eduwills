import fs from 'node:fs';

const aiFile = 'lib/quizAiClient.ts';
let ai = fs.readFileSync(aiFile, 'utf8');

// Force a fresh cache namespace so questions created before the strict instruction
// contract cannot be reused merely because the user entered the same instructions.
ai = ai.replace(/const CACHE='v21-hard-grounded-book-quiz';/g, "const CACHE='v22-strict-instructions-quiz';");
ai = ai.replace(/const CACHE = 'v21-hard-grounded-book-quiz';/g, "const CACHE='v22-strict-instructions-quiz';");

const promptRe = /function buildPrompt\(books:QuizBook\[\],count:number,difficulty:string,instructions:string,recent:string\[\],research:string\)\{[\s\S]*?\}\n\nexport async function generateQuiz/;
const promptReplacement = String.raw`function buildPrompt(books:QuizBook[],count:number,difficulty:string,instructions:string,recent:string[],research:string){
  const userInstructions=String(instructions||'').trim()||'Create a diverse quiz from the actual book content.';
  const exactBooks=books.map(b=>b.title+' by '+b.author).join('; ');
  return 'You are EDUWILLS Quiz AI. Generate a factual multiple-choice quiz for the EXACT books below and for no other work.\\n\\n'
    +'EXACT BOOKS (NON-NEGOTIABLE): '+exactBooks+'. Never substitute a similarly named title, adaptation, sequel, review, another author, or another edition unless the user explicitly requests it.\\n\\n'
    +'USER INSTRUCTIONS — STRICTLY MANDATORY: '+userInstructions+'\\nTreat every explicit user instruction as a hard requirement. Before generating, internally convert the request into a checklist and satisfy every item. This includes requested topics, characters, chapters, events, chronology, question style, difficulty, exclusions, focus, number, wording constraints, and any “only”, “must”, “do not”, or “avoid” instruction. User instructions override generic quiz defaults. Do not silently broaden or reinterpret the request. If the user asks for a narrow topic, do not pad with unrelated questions just to reach the requested count.\\n\\n'
    +'BOOK-CONTENT RULE: At least 90% MUST test concrete content from the exact selected books: specific events, incidents, characters, relationships, actions, decisions, settings, chronology, causes, consequences, chapter details or distinctive facts. Metadata such as author/title/publisher/publication may be used only when the user asks for it. Never invent unsupported facts or quotations. If evidence does not support a detail, choose a different supported detail instead of guessing. Never describe a character with an unsupported gender, profession, relationship, location, event, quote, or plot role.\\n\\n'
    +'OUTPUT CONTRACT: Generate EXACTLY '+count+' questions. Use exactly four plausible options and one correct answer. Vary facts and avoid duplicates. Difficulty: '+difficulty+'. Previous questions to avoid: '+recent.slice(-100).join(' | ')+'.\\n\\n'
    +'RESEARCH EVIDENCE (use only as supporting evidence; it never overrides the exact-book or user-instruction rules):\\n'+research.slice(0,90000)+'\\n\\n'
    +'FINAL SELF-CHECK BEFORE OUTPUT: Confirm internally that every question is about the exact selected book(s), follows every user instruction, contains no unsupported claim, has one unambiguous correct answer, has exactly four options, and is not a duplicate. If a candidate fails any check, replace it. Return ONLY JSON in this shape: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}';}

export async function generateQuiz`;
if (!promptRe.test(ai)) throw new Error('buildPrompt block not found');
ai = ai.replace(promptRe, promptReplacement);
fs.writeFileSync(aiFile, ai);

const pageFile = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(pageFile, 'utf8');

const imageRe = /  function makeResultImage\(\): Promise<Blob> \{[\s\S]*?\n  function scoreFor/;
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
      const glow1 = c.createRadialGradient(180, 160, 10, 180, 160, 320); glow1.addColorStop(0, 'rgba(34,211,238,.42)'); glow1.addColorStop(1, 'rgba(34,211,238,0)'); c.fillStyle = glow1; c.fillRect(0, 0, 650, 520);
      const glow2 = c.createRadialGradient(1220, 900, 10, 1220, 900, 360); glow2.addColorStop(0, 'rgba(168,85,247,.45)'); glow2.addColorStop(1, 'rgba(168,85,247,0)'); c.fillStyle = glow2; c.fillRect(760, 520, 640, 530);
      c.fillStyle = 'rgba(255,255,255,.96)'; c.beginPath(); c.roundRect(55, 55, 1290, 940, 42); c.fill();
      c.fillStyle = '#17315f'; c.font = '900 42px system-ui, sans-serif'; c.fillText('EDUWILLS', 105, 125);
      c.fillStyle = '#2563eb'; c.font = '800 20px system-ui, sans-serif'; c.fillText('SMART QUIZ • LEARNING RESULT', 107, 158);
      c.fillStyle = '#0f172a'; c.font = '900 58px system-ui, sans-serif'; c.fillText('Test Overview', 105, 235);
      const pct = scoreFor(qs, answers, true), correct = scoreFor(qs, answers);
      c.fillStyle = '#2563eb'; c.beginPath(); c.arc(1110, 190, 105, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.font = '900 66px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(String(pct) + '%', 1110, 212); c.font = '700 18px system-ui, sans-serif'; c.fillText(String(correct) + '/' + qs.length + ' correct', 1110, 245); c.textAlign = 'left';
      const card = (x:number,y:number,w:number,h:number,title:string,value:string,fill:string,text:string) => { c.fillStyle = fill; c.beginPath(); c.roundRect(x,y,w,h,24); c.fill(); c.fillStyle = text; c.font = '800 18px system-ui, sans-serif'; c.fillText(title,x+24,y+32); c.font = '700 21px system-ui, sans-serif'; const v=value.length>55?value.slice(0,55)+'…':value; c.fillText(v,x+24,y+67); };
      card(105, 290, 585, 110, 'BOOKS', setup?.books.map((b)=>b.title).join(', ')||'Selected books', '#e0f2fe', '#0c4a6e');
      card(720, 290, 555, 110, 'DIFFICULTY', setup?.difficulty||'Mixed', '#ede9fe', '#4c1d95');
      card(105, 425, 585, 110, 'QUESTIONS', String(qs.length), '#dcfce7', '#166534');
      card(720, 425, 555, 110, 'TIME', setup?.duration ? String(setup.duration) + ' minutes • ' + elapsedText(elapsed) + ' elapsed' : 'No time limit', '#fef3c7', '#92400e');
      c.fillStyle = '#0f172a'; c.font = '900 26px system-ui, sans-serif'; c.fillText('Your result', 105, 600);
      c.fillStyle = '#475569'; c.font = '500 20px system-ui, sans-serif'; c.fillText('Review the corrections in EDUWILLS to strengthen your learning.', 105, 635);
      c.fillStyle = '#eef2ff'; c.beginPath(); c.roundRect(105, 685, 1170, 135, 28); c.fill();
      c.fillStyle = '#4338ca'; c.font = '900 22px system-ui, sans-serif'; c.fillText('EDUWILLS AI REVIEW', 135, 730);
      c.fillStyle = '#334155'; c.font = '500 20px system-ui, sans-serif'; const review=cleanText(feedback)||'Your score has been recorded. Review the corrections below to strengthen your learning.'; c.fillText(review.slice(0, 105), 135, 770);
      c.fillStyle = '#94a3b8'; c.font = '600 16px system-ui, sans-serif'; c.fillText('Generated by EDUWILLS • Keep learning. Keep improving.', 105, 930);
      canvas.toBlob((b)=>resolve(b!), 'image/png', 1);
    });
  }
  async function downloadResult() { const blob = await makeResultImage(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = resultFileName(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1000); }
  async function shareResult() { const blob = await makeResultImage(); const file = new File([blob], resultFileName(), { type: 'image/png' }); if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'My EDUWILLS quiz result', text: 'My EDUWILLS test result', files: [file] }); else await downloadResult(); }
  function scoreFor`;
if (!imageRe.test(s)) throw new Error('result image block not found');
s = s.replace(imageRe, imageReplacement);

fs.writeFileSync(pageFile, s);
console.log('EDUWILLS strict instruction contract, fresh quiz cache namespace and styled unique result-image export applied.');
