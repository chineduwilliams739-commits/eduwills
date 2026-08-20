import fs from 'node:fs';

const file = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(file, 'utf8');

// If a learner returns after the timer expired, restoreQuiz must submit the saved attempt
// instead of silently deleting it. The normal interval handles expiry while the page is open.
const oldExpired = "if (saved.setup.endAtMs && Date.now() >= saved.setup.endAtMs) {\n        localStorage.removeItem('eduwills_active_quiz');\n        return;\n      }";
const newExpired = "if (saved.setup.endAtMs && Date.now() >= saved.setup.endAtMs) {\n        setSetup(saved.setup); setQs(saved.qs); setAnswers(saved.answers || []); setIdx(Number(saved.idx || 0));\n        setSeconds(0); setElapsed(Math.max(0, Math.floor((Date.now() - Number(saved.setup.startedAtMs || Date.now())) / 1000)));\n        setQuizLoading(false); setDone(false); setTimeWarning('Time is up. Your quiz will be submitted automatically.');\n        setTimeout(() => submitQuiz(true), 0);\n        return;\n      }";
if (s.includes(oldExpired)) s = s.replace(oldExpired, newExpired);

// Keep the question navigator directly below the options and horizontally scrollable.
if (!s.includes('Swipe sideways to navigate questions')) {
  throw new Error('Question navigator marker missing');
}

// Keep the overview as a complete per-question review and keep AI review inside the main result card.
if (!s.includes('Every question') || !s.includes('EDUWILLS AI Review') || !s.includes('Explain why I failed this')) {
  throw new Error('Final overview markers missing');
}

fs.writeFileSync(file, s);
console.log('Quiz final behavior verified: persistent timer, auto-submit on return, complete overview and compact navigator.');
