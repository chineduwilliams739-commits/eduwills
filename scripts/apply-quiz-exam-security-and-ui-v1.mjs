import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(path, 'utf8');
const must = (ok, msg) => { if (!ok) throw new Error(msg); };

// Keep this repair script deliberately source-safe. Inserted JSX is plain strings,
// never nested template literals containing JSX markup.
const stateNeedle = "const [freeQuizCount, setFreeQuizCount] = useState(0), [timeWarning, setTimeWarning] = useState('');";
const stateReplacement = stateNeedle + "\n  const [tabWarning, setTabWarning] = useState('');\n  const [examViolationCount, setExamViolationCount] = useState(0);";
if (!s.includes('const [tabWarning, setTabWarning]')) {
  must(s.includes(stateNeedle), 'Quiz state insertion point missing');
  s = s.replace(stateNeedle, stateReplacement);
}

const securityMarker = 'EDUWILLS_EXAM_SECURITY_V2';
if (!s.includes(securityMarker)) {
  const anchor = "  useEffect(() => {\n    if (!setup || done || quizLoading) return;";
  const securityBlock = [
    '  // ' + securityMarker,
    '  useEffect(() => {',
    '    if (!setup || done || quizLoading || !qs.length) return;',
    '    let localViolations = 0;',
    '    let submitting = false;',
    '    const handleVisibility = () => {',
    "      if (document.visibilityState !== 'hidden' || submitting || done) return;",
    '      localViolations += 1;',
    '      setExamViolationCount(localViolations);',
    '      if (localViolations >= 2) {',
    '        submitting = true;',
    "        setTimeWarning('You left the active test window again. Your quiz is being submitted automatically.');",
    '        void submitQuiz(true);',
    '      } else {',
    "        setTabWarning('Warning: you switched away from the quiz. Return to EDUWILLS immediately. Leaving the test window again will automatically submit your quiz.');",
    '      }',
    '    };',
    '    const handleBlur = () => {',
    "      if (document.visibilityState === 'hidden') return;",
    "      setTabWarning('Warning: keep EDUWILLS active while taking your test. Switching away from the test may submit it.');",
    '    };',
    "    document.addEventListener('visibilitychange', handleVisibility);",
    "    window.addEventListener('blur', handleBlur);",
    '    return () => {',
    "      document.removeEventListener('visibilitychange', handleVisibility);",
    "      window.removeEventListener('blur', handleBlur);",
    '    };',
    '  }, [setup, done, quizLoading, qs.length]);',
    ''
  ].join('\n');
  must(s.includes(anchor), 'Quiz security insertion point missing');
  s = s.replace(anchor, securityBlock + anchor);
}

// Premium question/options styling. Keep the replacement structurally balanced.
const oldCard = 'className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8"';
const newCard = 'className="mt-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50"';
if (s.includes(oldCard)) s = s.replace(oldCard, newCard);

const oldQuestion = '<h1 className="text-xl font-black leading-8 sm:text-2xl">{q.question}</h1>';
const newQuestion = '<div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-6 py-5 sm:px-8"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-indigo-700">Question {idx + 1}</span><span className="text-xs font-black text-slate-400">{Math.round(((idx + 1) / Math.max(1, qs.length)) * 100)}% complete</span></div></div><h1 className="px-6 pt-6 text-xl font-black leading-8 text-slate-900 sm:px-8 sm:pt-8 sm:text-2xl">{q.question}</h1><p className="px-6 pt-2 text-xs font-bold text-slate-400 sm:px-8">Choose the best answer.</p>';
if (s.includes(oldQuestion)) s = s.replace(oldQuestion, newQuestion);

const oldOptions = 'className={`rounded-2xl border p-3.5 text-left text-sm font-bold transition sm:p-4 ${selectedAnswer === i ?';
const newOptions = 'className={`group flex items-center rounded-2xl border p-3.5 text-left text-sm font-bold transition duration-200 sm:p-4 ${selectedAnswer === i ?';
if (s.includes(oldOptions)) s = s.replace(oldOptions, newOptions);

const warningNeedle = "      {timeWarning && <div className=\"mx-auto max-w-4xl px-5 pt-3\">";
if (!s.includes('setTabWarning')) throw new Error('Tab warning state missing');
if (!s.includes('{tabWarning &&')) {
  must(s.includes(warningNeedle), 'Quiz warning insertion point missing');
  const warning = '      {tabWarning && <div className="mx-auto max-w-4xl px-5 pt-3"><div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black text-amber-950 shadow-sm">{tabWarning}<button type="button" onClick={() => setTabWarning(\'\')} className="ml-3 rounded-lg bg-amber-200 px-2 py-1 text-xs font-black">Dismiss</button></div></div>}\n';
  s = s.replace(warningNeedle, warning + warningNeedle);
}

must(s.includes(securityMarker), 'Exam security was not applied');
must(s.includes("document.addEventListener('visibilitychange'"), 'Tab monitoring missing');
must(s.includes("window.addEventListener('blur'"), 'Browser focus monitoring missing');
must(s.includes('submitQuiz(true)'), 'Automatic submission missing');
must(s.includes('Choose the best answer.'), 'Professional question interface missing');

fs.writeFileSync(path, s);
console.log('Quiz exam security/UI v3 applied: balanced premium question UI, warning on leaving the test, automatic submission after a second leave.');
