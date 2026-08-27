import fs from 'node:fs';

const path = 'app/dashboard/quiz/page.tsx';
let s = fs.readFileSync(path, 'utf8');
const must = (ok, msg) => { if (!ok) throw new Error(msg); };

// Add exam-security state once.
if (!s.includes('tabWarning')) {
  s = s.replace(
    "const [freeQuizCount, setFreeQuizCount] = useState(0), [timeWarning, setTimeWarning] = useState('');",
    "const [freeQuizCount, setFreeQuizCount] = useState(0), [timeWarning, setTimeWarning] = useState('');\n  const [tabWarning, setTabWarning] = useState('');\n  const [leaveSubmitted, setLeaveSubmitted] = useState(false);"
  );
}

// Add visibility/focus monitoring. A tab switch/background transition warns; losing
// browser focus submits the attempt automatically. Browser APIs cannot reliably tell
// whether the user switched to another Chrome window versus another application, so
// blur is treated as leaving the active exam window.
if (!s.includes('EDUWILLS_EXAM_SECURITY_V1')) {
  const marker = "  // EDUWILLS_EXAM_SECURITY_V1";
  const block = `\n${marker}\n  useEffect(() => {\n    if (!setup || done || quizLoading || !qs.length) return;\n    let submitting = false;\n    const warnTab = () => {\n      if (document.visibilityState === 'hidden') {\n        setTabWarning('⚠️ You switched away from the quiz. Return to EDUWILLS immediately. Leaving the test window will submit your quiz automatically.');\n      }\n    };\n    const leaveWindow = () => {\n      if (document.visibilityState !== 'hidden' || submitting || done) return;\n      submitting = true;\n      setLeaveSubmitted(true);\n      setTimeWarning('You left the active quiz window. Your quiz is being submitted automatically.');\n      void submitQuiz(true);\n    };\n    document.addEventListener('visibilitychange', warnTab);\n    window.addEventListener('blur', leaveWindow);\n    return () => {\n      document.removeEventListener('visibilitychange', warnTab);\n      window.removeEventListener('blur', leaveWindow);\n    };\n  }, [setup, done, quizLoading, qs.length]);\n`;
  const needle = "  useEffect(() => {\n    if (!setup || done || !qs.length) return;";
  must(s.includes(needle), 'Quiz persistence effect insertion point missing');
  s = s.replace(needle, block + '\n' + needle);
}

// Make the question/options area visibly premium without changing quiz logic.
s = s.replace(
  'className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8"><h1 className="text-xl font-black leading-8 sm:text-2xl">{q.question}</h1><div className="mt-6 grid gap-3">',
  'className="mt-4 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50 sm:p-0"><div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-6 py-5 sm:px-8"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-indigo-700">Question {idx + 1}</span><span className="text-xs font-black text-slate-400">{Math.round(((idx + 1) / Math.max(1, qs.length)) * 100)}% complete</span></div></div><div className="p-6 sm:p-8"><h1 className="text-xl font-black leading-8 text-slate-900 sm:text-2xl">{q.question}</h1><p className="mt-2 text-xs font-bold text-slate-400">Choose the best answer.</p><div className="mt-6 grid gap-3">'
);
s = s.replace(
  "className={`rounded-2xl border p-3.5 text-left text-sm font-bold transition sm:p-4 ${selectedAnswer === i ? 'border-eduBlue bg-blue-50 shadow-md ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}",
  "className={`group flex items-center rounded-2xl border p-3.5 text-left text-sm font-bold transition duration-200 sm:p-4 ${selectedAnswer === i ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-cyan-50 shadow-lg ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-md'}`}`
);
// Close the new inner padding wrapper before the existing section close.
s = s.replace(
  '</div>\n          <div className="mt-5 border-t border-slate-100 pt-4">',
  '</div></div>\n          <div className="border-t border-slate-100 px-6 pb-5 pt-4 sm:px-8">'
);

// Warning banner in the active exam.
const warningNeedle = '      {timeWarning && <div className="mx-auto max-w-4xl px-5 pt-3">';
if (!s.includes('You switched away from the quiz')) {
  must(s.includes(warningNeedle), 'Quiz warning insertion point missing');
  s = s.replace(warningNeedle, '      {tabWarning && <div className="mx-auto max-w-4xl px-5 pt-3"><div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black text-amber-950 shadow-sm">{tabWarning}<button type="button" onClick={() => setTabWarning(\'\')} className="ml-3 rounded-lg bg-amber-200 px-2 py-1 text-xs font-black">Dismiss</button></div></div>}\n' + warningNeedle);
}

must(s.includes('EDUWILLS_EXAM_SECURITY_V1'), 'Exam security was not applied');
must(s.includes('setTabWarning'), 'Tab warning state missing');
must(s.includes('window.addEventListener(\'blur\''), 'Leave-window auto-submit listener missing');
must(s.includes('submitQuiz(true)'), 'Automatic submission missing');
fs.writeFileSync(path, s);
console.log('Quiz exam security/UI v1 applied: tab-switch warning, leave-window auto-submit, and premium question/options styling.');
