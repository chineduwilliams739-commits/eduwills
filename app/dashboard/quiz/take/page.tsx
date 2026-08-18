'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock3, CheckCircle2, Sparkles } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const BASE = '/eduwills';

type Q = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

type Setup = {
  id: string;
  books: { title: string; author: string }[];
  questions: number;
  duration: number | null;
  difficulty: string;
  instructions: string;
};

function fallback(setup: Setup): Q[] {
  return Array.from({ length: setup.questions }, (_, i) => ({
    question: `Question ${i + 1}: Which statement best describes a useful way to study ${setup.books.map((b) => b.title).join(' and ')}?`,
    options: ['Read and review the material carefully', 'Ignore the text completely', 'Choose answers without reading', 'Study only the title'],
    answer: 0,
    explanation: 'Careful reading and review are fundamental to understanding a book. EDUWILLS will replace this fallback with generated questions when the AI service is available.',
  }));
}

export default function TakeQuiz() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [leaveAttempts, setLeaveAttempts] = useState(0);
  const finishStarted = useRef(false);
  const answersRef = useRef<number[]>([]);
  const deadlineRef = useRef<number | null>(null);
  const allowNavigationRef = useRef(false);
  const leaveAttemptsRef = useRef(0);
  const quizReadyRef = useRef(false);
  const quizUrlRef = useRef('');

  useEffect(() => {
    quizUrlRef.current = window.location.href;
    try {
      const raw = sessionStorage.getItem('eduwills_pending_quiz');
      if (!raw) {
        window.location.replace(`${BASE}/dashboard/quiz/`);
        return;
      }
      const s = JSON.parse(raw) as Setup;
      setSetup(s);
      if (s.duration && s.duration > 0) {
        const deadline = Date.now() + s.duration * 60 * 1000;
        deadlineRef.current = deadline;
        setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      } else {
        deadlineRef.current = null;
        setSeconds(null);
      }
      generate(s);
    } catch {
      window.location.replace(`${BASE}/dashboard/quiz/`);
    }
  }, []);

  useEffect(() => {
    if (!loading) quizReadyRef.current = true;
  }, [loading]);

  useEffect(() => {
    if (deadlineRef.current === null || done || loading) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current! - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining <= 0) void finish(answersRef.current);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [done, loading]);

  async function generate(s: Setup) {
    setLoading(true);
    try {
      const prompt = `Create exactly ${s.questions} multiple-choice quiz questions about these books: ${s.books.map((b) => `${b.title} by ${b.author}`).join('; ')}. Difficulty: ${s.difficulty}. Extra instruction: ${s.instructions || 'None'}. Return ONLY valid JSON array. Each item must have question, options (exactly 4 strings), answer (0-3), explanation.`;
      const r = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: 'openai' }),
      });
      if (!r.ok) throw new Error('AI unavailable');
      const text = await r.text();
      const clean = text.replace(/^```json\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid AI response');
      setQs(parsed.slice(0, s.questions));
    } catch (e) {
      console.warn(e);
      setError('The free AI service is temporarily unavailable, so EDUWILLS loaded a safe practice fallback.');
      setQs(fallback(s));
    } finally {
      setLoading(false);
    }
  }

  function choose(n: number) {
    if (done || submitting) return;
    const nextAnswers = [...answersRef.current];
    nextAnswers[idx] = n;
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    if (idx < qs.length - 1) setIdx(idx + 1);
    else void finish(nextAnswers);
  }

  async function finish(finalAnswers = answersRef.current) {
    if (finishStarted.current || done) return;
    finishStarted.current = true;
    allowNavigationRef.current = true;
    setSubmitting(true);
    setDone(true);
    const safeAnswers = [...finalAnswers];
    answersRef.current = safeAnswers;
    setAnswers(safeAnswers);
    if (setup) {
      const correct = qs.reduce((n, q, i) => n + (safeAnswers[i] === q.answer ? 1 : 0), 0);
      try {
        await updateDoc(doc(db, 'quizHistory', setup.id), {
          status: 'completed',
          score: correct,
          total: qs.length,
          percentage: Math.round((correct / Math.max(1, qs.length)) * 100),
          completedAt: new Date(),
          autoSubmitted: deadlineRef.current !== null && Date.now() >= deadlineRef.current,
          leaveAttempts: leaveAttemptsRef.current,
        });
      } catch (e) {
        console.warn(e);
      }
    }
    setSubmitting(false);
  }

  async function attemptLeave(destination?: string) {
    if (!quizReadyRef.current || done || allowNavigationRef.current) {
      if (destination) window.location.assign(destination);
      return;
    }

    const next = leaveAttemptsRef.current + 1;
    leaveAttemptsRef.current = next;
    setLeaveAttempts(next);

    if (next < 3) {
      // Keep the quiz URL in the history stack. The previous implementation
      // accidentally pushed the dashboard URL after a browser-back event,
      // allowing the user to leave despite the warning.
      window.history.pushState({ eduwillsQuiz: true }, '', quizUrlRef.current);
      window.alert(
        `Warning ${next} of 2: You are currently taking a test. Leaving this page will not be allowed yet. On the third attempt, your test will be submitted and scored with unanswered questions counted as incorrect.`,
      );
      return;
    }

    window.history.pushState({ eduwillsQuiz: true }, '', quizUrlRef.current);
    window.alert('Third leave attempt detected. Your test will be submitted and scored now.');
    await finish(answersRef.current);
    if (destination) window.location.assign(destination);
  }

  useEffect(() => {
    const quizUrl = quizUrlRef.current || window.location.href;
    // Add a dedicated history entry for the active quiz. Browser-back now
    // reliably produces a popstate event that we can intercept.
    window.history.pushState({ eduwillsQuiz: true }, '', quizUrl);

    const onPopState = () => {
      if (allowNavigationRef.current || done) return;
      // Immediately restore the exact quiz URL, not window.location.href
      // (which is already the previous page at this point).
      window.history.pushState({ eduwillsQuiz: true }, '', quizUrlRef.current || quizUrl);
      void attemptLeave(`${BASE}/dashboard/quiz/`);
    };
    window.addEventListener('popstate', onPopState);

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current || done || !quizReadyRef.current) return;
      // Native browser dialogs are the only reliable protection for refresh,
      // closing a tab, or leaving the site. Browsers do not permit reliable
      // asynchronous Firestore writes during beforeunload, so actual scoring
      // is performed by our in-app/back/link interception instead.
      event.preventDefault();
      event.returnValue = 'You are in an active test. Leaving may submit your test.';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    const onDocumentClick = (event: MouseEvent) => {
      if (allowNavigationRef.current || done || !quizReadyRef.current) return;
      const target = event.target as HTMLElement | null;
      const link = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const href = link.href;
      if (!href || href.startsWith('javascript:')) return;
      // Same-page hash links are not an attempt to leave the quiz.
      if (new URL(href, window.location.href).href === window.location.href) return;
      event.preventDefault();
      void attemptLeave(href);
    };
    document.addEventListener('click', onDocumentClick, true);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onDocumentClick, true);
    };
  }, [done]);

  const mm = seconds === null ? '--' : String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = seconds === null ? '--' : String(seconds % 60).padStart(2, '0');

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-paper p-6"><div className="text-center"><Sparkles className="mx-auto animate-pulse text-eduBlue" size={42} /><h1 className="mt-4 text-2xl font-black">EDUWILLS AI is preparing your quiz…</h1><p className="mt-2 text-sm text-slate-500">Creating {setup?.questions || ''} questions.</p></div></main>;
  }

  if (done) {
    const score = qs.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
    return <main className="min-h-screen bg-paper p-5"><div className="mx-auto max-w-3xl"><section className="mt-10 rounded-[2rem] bg-white p-8 text-center shadow-soft sm:p-12"><CheckCircle2 className="mx-auto text-emerald-600" size={52} /><h1 className="mt-5 text-3xl font-black">{seconds === 0 ? 'Time is up — quiz submitted!' : 'Quiz complete!'}</h1>{submitting ? <p className="mt-2 text-sm font-semibold text-slate-500">Saving your results…</p> : <p className="mt-2 text-slate-500">You scored</p>}<div className="mt-2 text-5xl font-black text-eduBlue">{score}/{qs.length}</div><p className="mt-2 font-bold">{Math.round((score / Math.max(1, qs.length)) * 100)}%</p><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center"><a href={`${BASE}/dashboard/history/`} className="rounded-xl bg-ink px-5 py-3 font-black text-white">View History</a><a href={`${BASE}/dashboard/quiz/`} className="rounded-xl border border-slate-200 px-5 py-3 font-black">Take another quiz</a></div></section></div></main>;
  }

  const q = qs[idx];
  return <main className="min-h-screen bg-paper text-ink"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4"><button type="button" onClick={() => void attemptLeave(`${BASE}/dashboard/quiz/`)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17} /> Exit</button><div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${seconds !== null && seconds <= 30 ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}><Clock3 size={14} />{mm}:{ss}</div></div></header><div className="mx-auto max-w-3xl px-5 py-8"><div className="mb-5 flex items-center justify-between text-xs font-black text-slate-400"><span>QUESTION {idx + 1} OF {qs.length}</span><span>{answers.filter((x) => x !== undefined).length} answered</span></div>{error && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{error}</p>}<section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><h1 className="text-xl font-black leading-8 sm:text-2xl">{q.question}</h1><div className="mt-7 grid gap-3">{q.options.map((o, i) => <button key={i} onClick={() => choose(i)} disabled={submitting} className={`rounded-2xl border p-4 text-left text-sm font-bold transition hover:-translate-y-0.5 ${answers[idx] === i ? 'border-eduBlue bg-blue-50' : 'border-slate-200 bg-white'}`}><span className="mr-3 inline-grid h-8 w-8 place-items-center rounded-lg bg-slate-100">{String.fromCharCode(65 + i)}</span>{o}</button>)}</div></section><p className="mt-4 text-center text-xs font-semibold text-slate-400">Leave attempts: {leaveAttempts}/3. Your test is automatically submitted on the third attempt.</p></div></main>;
}
