'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_WARNINGS = 3;

export default function QuizTabSwitchGuard({
  quizId,
  active,
  onAutoSubmit,
}: {
  quizId: string;
  active: boolean;
  onAutoSubmit: () => void;
}) {
  const [violations, setViolations] = useState(0);
  const [warningVisible, setWarningVisible] = useState(false);
  const awayRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!quizId) return;
    try {
      const raw = localStorage.getItem(`eduwills_quiz_tab_switches:${quizId}`);
      const count = Number(raw || 0);
      setViolations(Number.isFinite(count) ? Math.min(MAX_WARNINGS, Math.max(0, count)) : 0);
    } catch {
      setViolations(0);
    }
  }, [quizId]);

  useEffect(() => {
    if (!active || !quizId || submittingRef.current) return;

    const registerViolation = () => {
      if (submittingRef.current || awayRef.current) return;
      awayRef.current = true;

      setViolations((current) => {
        const next = Math.min(MAX_WARNINGS, current + 1);
        try {
          localStorage.setItem(`eduwills_quiz_tab_switches:${quizId}`, String(next));
        } catch {}

        if (next >= MAX_WARNINGS) {
          submittingRef.current = true;
          window.setTimeout(() => onAutoSubmit(), 0);
        } else {
          setWarningVisible(true);
        }

        return next;
      });
    };

    const markReturned = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        awayRef.current = false;
      } else if (document.visibilityState === 'visible') {
        window.setTimeout(() => {
          if (document.visibilityState === 'visible') awayRef.current = false;
        }, 250);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') registerViolation();
      else markReturned();
    };

    const onBlur = () => {
      if (!document.hidden) registerViolation();
    };

    const onFocus = () => markReturned();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [active, quizId, onAutoSubmit]);

  if (!warningVisible || violations >= MAX_WARNINGS || !active) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/75 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-amber-500 to-red-500 p-6 text-white">
          <p className="text-xs font-black uppercase tracking-[.18em]">Quiz integrity warning</p>
          <h2 className="mt-2 text-2xl font-black">Please stay on the quiz</h2>
          <p className="mt-2 text-sm leading-6 text-white/90">
            You left the quiz tab or browser window. This is warning {violations} of 2.
          </p>
        </div>
        <div className="p-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
            Leaving the quiz a third time will automatically submit your current answers.
          </div>
          <button
            type="button"
            onClick={() => setWarningVisible(false)}
            className="mt-5 w-full rounded-xl bg-ink px-4 py-3 font-black text-white"
          >
            Return to quiz
          </button>
        </div>
      </div>
    </div>
  );
}
