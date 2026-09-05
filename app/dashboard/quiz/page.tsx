'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  ChevronDown,
  Loader2,
  Search,
  Share2,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  explainFailure as explainQuizFailure,
  generateQuiz,
  generateRemarks,
  researchBooks,
} from '@/lib/quizAiClient';

const BASE = '/eduwills';
const FREE_DAILY_QUIZZES = 5;
const FREE_MAX_QUESTIONS = 20;
const PAID_MAX_QUESTIONS = 100;

type Book = {
  id: string;
  slot: number;
  title: string;
  author: string;
};

type Q = {
  question: string;
  options: string[];
  answer: number;
  explanation?: string;
  evidence?: string;
};

type Setup = {
  id: string;
  books: { title: string; author: string }[];
  questions: number;
  duration: number | null;
  difficulty: string;
  instructions: string;
  startedAtMs: number;
  endAtMs: number | null;
  freeDay?: string;
};

type CuratedBook = {
  title: string;
  aliases: string[];
  authors: string[];
};

type QuizDropdownOption = {
  value: string;
  label: string;
};

const CURATED_BOOKS: CuratedBook[] = [
  {
    title: 'Sànyà',
    aliases: ['sanya', 'sanya novel', 'sanya oyin olugbile'],
    authors: ['Oyin Olugbile', 'Óyìn Olúgbilé'],
  },
  {
    title: 'SCARS: Nigeria’s Journey and the Boko Haram Conundrum',
    aliases: [
      'scars',
      'scars nigeria',
      'boko haram conundrum',
      'scars lucky irabor',
      'scars leo irabor',
    ],
    authors: [
      'Gen. Leo Irabor',
      'General Lucky Eluonye Onyenuchea Irabor',
      'Lucky Irabor',
    ],
  },
];

function expiryMs(value: any) {
  if (!value) return 0;

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (value.seconds) {
    return value.seconds * 1000;
  }

  const parsed = Date.parse(String(value));

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function elapsedText(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');

  const s = (total % 60).toString().padStart(2, '0');

  return `${m}:${s}`;
}

function cleanText(text: string) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Styled dropdown                                                            */
/* -------------------------------------------------------------------------- */

function QuizDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled = false,
}: {
  value: string;
  options: QuizDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const current =
    options.find((option) => option.value === value)?.label || placeholder;

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);

    document.addEventListener('click', close);

    return () => {
      document.removeEventListener('click', close);
    };
  }, [open]);

  return (
    <div
      className="relative"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left font-bold shadow-sm transition-all focus:outline-none focus:ring-4 ${
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70'
            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-eduBlue hover:bg-white focus:border-eduBlue focus:ring-blue-100'
        }`}
      >
        <span className="min-w-0 truncate">
          {current}
        </span>

        <ChevronDown
          size={18}
          className={`ml-3 shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && !disabled && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[9999] max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
        >
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`mb-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-bold transition last:mb-0 ${
                  selected
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{option.label}</span>

                {selected && <Check size={17} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function QuizPage() {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const [books, setBooks] = useState<Book[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const [questions, setQuestions] = useState(10);
  const [duration, setDuration] = useState('20');
  const [difficulty, setDifficulty] = useState('Mixed');
  const [instructions, setInstructions] = useState('');

  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState<string[]>([]);
  const [author, setAuthor] = useState('');
  const [authorQuery, setAuthorQuery] = useState('');
  const [slot, setSlot] = useState<number | ''>('');

  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');

  const [setup, setSetup] = useState<Setup | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const [seconds, setSeconds] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState('');

  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [exitQuiz, setExitQuiz] = useState(false);
  const [done, setDone] = useState(false);

  const [feedback, setFeedback] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [whyLoading, setWhyLoading] = useState<number | null>(null);
  const [why, setWhy] = useState<Record<number, string>>({});

  const [freeQuizCount, setFreeQuizCount] = useState(0);
  const [timeWarning, setTimeWarning] = useState('');

  const load = async (user: any) => {
    const snap = await getDocs(
      query(
        collection(db, 'bookSlots'),
        where('userId', '==', user.uid)
      )
    );

    setBooks(
      snap.docs
        .map((x) => ({
          id: x.id,
          ...x.data(),
        }) as Book)
        .sort((a, b) => a.slot - b.slot)
    );
  };

  const loadFreeCount = async (user: any) => {
    if (active) return;

    try {
      const snap = await getDocs(
        query(
          collection(db, 'quizHistory'),
          where('userId', '==', user.uid)
        )
      );

      const day = todayKey();

      const count = snap.docs.filter(
        (d) => String(d.data()?.freeDay || '') === day
      ).length;

      setFreeQuizCount(Math.min(FREE_DAILY_QUIZZES, count));
    } catch {
      setFreeQuizCount(0);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        window.location.replace(`${BASE}/login/`);
        return;
      }

      try {
        const s = await getDoc(doc(db, 'users', u.uid));
        const d = s.data() || {};

        const isActive =
          d.activated === true &&
          expiryMs(d.activationExpiresAt) > Date.now();

        setActive(isActive);

        await load(u);

        if (!isActive) {
          const history = await getDocs(
            query(
              collection(db, 'quizHistory'),
              where('userId', '==', u.uid)
            )
          );

          const day = todayKey();

          setFreeQuizCount(
            Math.min(
              FREE_DAILY_QUIZZES,
              history.docs.filter(
                (x) => String(x.data()?.freeDay || '') === day
              ).length
            )
          );
        }
      } catch {
        setMessage('Could not load your quiz library.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const restoreQuiz = () => {
    try {
      const raw = localStorage.getItem('eduwills_active_quiz');

      if (!raw) return;

      const saved = JSON.parse(raw);

      if (!saved?.setup || !Array.isArray(saved.qs)) return;

      if (
        saved.setup.endAtMs &&
        Date.now() >= saved.setup.endAtMs
      ) {
        localStorage.removeItem('eduwills_active_quiz');
        return;
      }

      setSetup(saved.setup);
      setQs(saved.qs);
      setAnswers(saved.answers || []);
      setIdx(Number(saved.idx || 0));

      setSeconds(
        saved.setup.endAtMs
          ? Math.max(
              0,
              Math.ceil(
                (saved.setup.endAtMs - Date.now()) / 1000
              )
            )
          : null
      );

      setElapsed(
        Math.max(
          0,
          Math.floor(
            (Date.now() -
              Number(saved.setup.startedAtMs || Date.now())) /
              1000
          )
        )
      );
    } catch {}
  };

  useEffect(() => {
    restoreQuiz();
  }, []);

  useEffect(() => {
    if (!setup || done || quizLoading) return;

    const timer = setInterval(() => {
      const remaining = setup.endAtMs
        ? Math.max(
            0,
            Math.ceil(
              (setup.endAtMs - Date.now()) / 1000
            )
          )
        : null;

      if (remaining !== null) {
        setSeconds(remaining);

        if (remaining <= 300 && remaining > 299) {
          setTimeWarning(
            '5 minutes remaining. Keep an eye on the timer.'
          );
        }

        if (remaining <= 60 && remaining > 59) {
          setTimeWarning(
            '1 minute remaining. Finish your answers now.'
          );
        }

        if (remaining === 0) {
          setTimeWarning(
            'Time is up. Your quiz is being submitted automatically.'
          );

          submitQuiz(true);
        }
      }

      setElapsed(
        Math.max(
          0,
          Math.floor(
            (Date.now() - setup.startedAtMs) / 1000
          )
        )
      );
    }, 500);

    return () => clearInterval(timer);
  }, [setup, done, quizLoading]);

  useEffect(() => {
    if (!setup || done || !qs.length) return;

    try {
      localStorage.setItem(
        'eduwills_active_quiz',
        JSON.stringify({
          setup,
          qs,
          answers,
          idx,
        })
      );
    } catch {}
  }, [setup, qs, answers, idx, done]);

  const slots = useMemo(
    () =>
      Array.from(
        { length: 5 },
        (_, i) =>
          books.find((b) => b.slot === i + 1)
      ),
    [books]
  );

  const visibleAuthors = authors.filter((a) =>
    normalize(a).includes(normalize(authorQuery))
  );

  const maxQuestions = active
    ? PAID_MAX_QUESTIONS
    : FREE_MAX_QUESTIONS;

  const slotOptions: QuizDropdownOption[] = [
    {
      value: '',
      label: 'Choose an empty slot…',
    },
    ...slots
      .map((book, index) =>
        !book
          ? {
              value: String(index + 1),
              label: `Slot ${index + 1}`,
            }
          : null
      )
      .filter(Boolean) as QuizDropdownOption[],
  ];

  async function findBook() {
    const raw = title.trim();

    if (!raw) return;

    setSearching(true);
    setMessage('');
    setAuthors([]);
    setAuthor('');
    setAuthorQuery('');

    try {
      const n = normalize(raw);

      const curated = CURATED_BOOKS.filter((b) =>
        [b.title, ...b.aliases].some(
          (a) =>
            normalize(a).includes(n) ||
            n.includes(normalize(a))
        )
      ).flatMap((b) => b.authors);

      const found: string[] = [];

      for (const q of Array.from(new Set([raw, n]))) {
        try {
          const r = await fetch(
            `https://openlibrary.org/search.json?title=${encodeURIComponent(
              q
            )}&limit=30`
          );

          if (r.ok) {
            const d = await r.json();

            found.push(
              ...(d.docs || []).flatMap(
                (x: any) => x.author_name || []
              )
            );
          }
        } catch {}

        try {
          const r = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
              q
            )}&maxResults=20`
          );

          if (r.ok) {
            const d = await r.json();

            found.push(
              ...(d.items || []).flatMap(
                (x: any) =>
                  x.volumeInfo?.authors || []
              )
            );
          }
        } catch {}
      }

      const names = Array.from(
        new Set(
          [...curated, ...found].filter(Boolean)
        )
      ).slice(0, 50);

      setAuthors(names);

      setMessage(
        names.length
          ? 'Select a verified author from the search results. Authors cannot be entered manually.'
          : 'No verified author was found. Search for the author by name.'
      );
    } catch {
      setMessage(
        'Book search is temporarily unavailable.'
      );
    } finally {
      setSearching(false);
    }
  }

  async function searchAuthor() {
    const q = authorQuery.trim();

    if (!q) return;

    setSearching(true);

    try {
      const e = encodeURIComponent(q);

      const urls = [
        `https://openlibrary.org/search.json?author=${e}&limit=30`,
        `https://www.googleapis.com/books/v1/volumes?q=inauthor:${e}&maxResults=20`,
      ];

      const names: string[] = [];

      for (const u of urls) {
        try {
          const r = await fetch(u);

          if (!r.ok) continue;

          const d = await r.json();

          names.push(
            ...(d.docs || []).flatMap(
              (x: any) => x.author_name || []
            ),
            ...(d.items || []).flatMap(
              (x: any) =>
                x.volumeInfo?.authors || []
            )
          );
        } catch {}
      }

      setAuthors(
        Array.from(new Set(names)).slice(0, 50)
      );

      setMessage(
        names.length
          ? 'Select a verified author from the search results.'
          : 'No verified author match was found. Try another spelling.'
      );
    } finally {
      setSearching(false);
    }
  }

  async function saveBook() {
    if (!auth.currentUser || !author || !slot) return;

    setSaving(true);

    try {
      if (slots[Number(slot) - 1]) {
        setMessage('That slot is already occupied.');
        return;
      }

      await addDoc(collection(db, 'bookSlots'), {
        userId: auth.currentUser.uid,
        slot: Number(slot),
        title: title.trim(),
        author,
        createdAt: serverTimestamp(),
      });

      setTitle('');
      setAuthors([]);
      setAuthor('');
      setAuthorQuery('');
      setSlot('');
      setMessage('Book saved permanently.');

      await load(auth.currentUser);
    } catch (e: any) {
      setMessage(
        e?.message || 'Could not save the book.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function startQuiz() {
    if (!selected.length) {
      setMessage(
        'Choose at least one book before starting.'
      );
      return;
    }

    if (
      !active &&
      freeQuizCount >= FREE_DAILY_QUIZZES
    ) {
      setMessage(
        'You have used all 5 free quizzes for today. Activate EDUWILLS to continue.'
      );
      return;
    }

    if (questions > maxQuestions) {
      setQuestions(maxQuestions);
    }

    setStarting(true);
    setMessage('');

    try {
      const chosen = books.filter((b) =>
        selected.includes(b.id)
      );

      const startedAtMs = Date.now();

      const minutes =
        duration === 'none'
          ? null
          : Number(duration);

      const next: Setup = {
        id: '',
        books: chosen.map((b) => ({
          title: b.title,
          author: b.author,
        })),
        questions: Math.min(
          questions,
          maxQuestions
        ),
        duration: minutes,
        difficulty,
        instructions,
        startedAtMs,
        endAtMs: minutes
          ? startedAtMs + minutes * 60000
          : null,
        freeDay: active
          ? undefined
          : todayKey(),
      };

      const ref = await addDoc(
        collection(db, 'quizHistory'),
        {
          userId: auth.currentUser!.uid,
          books: next.books,
          questions: next.questions,
          duration: next.duration,
          difficulty,
          instructions,
          status: 'ready',
          freeDay: next.freeDay || null,
          createdAt: serverTimestamp(),
        }
      );

      next.id = ref.id;

      setSetup(next);
      setIdx(0);
      setAnswers([]);
      setDone(false);
      setQuizError('');
      setFeedback('');
      setWhy({});
      setElapsed(0);
      setSeconds(
        minutes ? minutes * 60 : null
      );
      setQuizLoading(true);
      setTimeWarning('');

      try {
        localStorage.removeItem(
          'eduwills_active_quiz'
        );
      } catch {}

      await generate(next);

      if (!active) {
        setFreeQuizCount((v) =>
          Math.min(
            FREE_DAILY_QUIZZES,
            v + 1
          )
        );
      }
    } catch (e: any) {
      setMessage(
        e?.message ||
          'Could not start the quiz. Please try again.'
      );
    } finally {
      setStarting(false);
    }
  }

  async function generate(current: Setup) {
    try {
      const research = await researchBooks(
        current.books
      );

      const recent = Array.isArray(qs)
        ? qs.map((q) => q.question)
        : [];

      const generated = await generateQuiz(
        current.books,
        current.questions,
        current.difficulty,
        current.instructions,
        recent,
        research
      );

      setQs(
        generated.slice(
          0,
          current.questions
        )
      );

      setQuizError('');
    } catch (e: any) {
      console.warn(e);

      const rawError = e instanceof Error ? e.message : String(e?.message || e || 'Unknown error');
      setQuizError(
        rawError === 'AI_QUOTA_EXHAUSTED'
          ? 'EDUWILLS AI has reached today’s generation limit for this account. Please try again tomorrow.'
          : rawError === 'AUTHENTICATION_REQUIRED'
            ? 'Your EDUWILLS login session is not ready. Please sign in again and retry.'
            : rawError || 'EDUWILLS AI could not finish the requested batch. Please try again.'
      );

      setQs([]);
    } finally {
      setQuizLoading(false);
    }
  }

  async function submitQuiz(auto = false) {
    if (!setup || done || !qs.length) return;

    setConfirmSubmit(false);
    setDone(true);
    setTimeWarning('');

    const correct = qs.reduce(
      (n, q, i) =>
        n + (answers[i] === q.answer ? 1 : 0),
      0
    );

    const percentage = Math.round(
      (correct /
        Math.max(1, qs.length)) *
        100
    );

    try {
      await updateDoc(
        doc(db, 'quizHistory', setup.id),
        {
          status: 'completed',
          questionsData: qs,
          answers,
          score: correct,
          total: qs.length,
          percentage,
          elapsedSeconds: elapsed,
          autoSubmitted: auto,
          completedAt: serverTimestamp(),
        }
      );
    } catch {}

    try {
      localStorage.removeItem(
        'eduwills_active_quiz'
      );
    } catch {}

    setFeedbackLoading(true);

    try {
      setFeedback(
        await generateRemarks(
          setup.books,
          correct,
          qs.length,
          percentage,
          setup.difficulty,
          elapsed
        )
      );
    } catch {
      setFeedback(
        'Your score has been recorded. Review the corrections below to strengthen your learning.'
      );
    } finally {
      setFeedbackLoading(false);
    }
  }

  function choose(answer: number) {
    const next = [...answers];

    next[idx] = answer;

    setAnswers(next);
  }

  function resetQuiz() {
    try {
      localStorage.removeItem(
        'eduwills_active_quiz'
      );
    } catch {}

    setSetup(null);
    setQs([]);
    setAnswers([]);
    setDone(false);
    setIdx(0);
    setSeconds(null);
    setElapsed(0);
    setFeedback('');
    setWhy({});
    setConfirmSubmit(false);
    setExitQuiz(false);
  }

  async function explainFailure(i: number) {
    if (
      !setup ||
      !qs[i] ||
      answers[i] === qs[i].answer
    ) {
      return;
    }

    setWhyLoading(i);

    try {
      const q = qs[i];

      const text = await explainQuizFailure(
        setup.books
          .map(
            (b) =>
              `${b.title} by ${b.author}`
          )
          .join('; '),
        q.question,
        q.options[answers[i]] ||
          'Not answered',
        q.options[q.answer]
      );

      setWhy((p) => ({
        ...p,
        [i]: cleanText(text),
      }));
    } catch {
    } finally {
      setWhyLoading(null);
    }
  }

  function makeResultImage(): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas =
        document.createElement('canvas');

      canvas.width = 1200;
      canvas.height = 900;

      const c =
        canvas.getContext('2d')!;

      c.fillStyle = '#f8fafc';
      c.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      c.fillStyle = '#111827';

      c.font =
        'bold 54px sans-serif';

      c.fillText(
        'EDUWILLS TEST OVERVIEW',
        70,
        90
      );

      c.font =
        'bold 92px sans-serif';

      c.fillText(
        `${scoreFor(qs, answers, true)}%`,
        70,
        210
      );

      c.font =
        'bold 34px sans-serif';

      c.fillText(
        `${scoreFor(qs, answers)}/${qs.length} correct`,
        75,
        270
      );

      c.font =
        '24px sans-serif';

      let y = 350;

      [
        `Books: ${setup?.books
          .map((b) => b.title)
          .join(', ')}`,
        `Difficulty: ${setup?.difficulty}`,
        `Questions: ${qs.length}`,
        `Time: ${
          setup?.duration
            ? `${setup.duration} minutes`
            : 'No limit'
        }`,
        `Elapsed: ${elapsedText(elapsed)}`,
      ].forEach((line) => {
        c.fillText(
          line.slice(0, 75),
          75,
          y
        );

        y += 55;
      });

      c.font =
        'bold 24px sans-serif';

      c.fillText(
        'Generated by EDUWILLS',
        75,
        790
      );

      canvas.toBlob(
        (b) => resolve(b!),
        'image/png'
      );
    });
  }

  async function downloadResult() {
    const blob =
      await makeResultImage();

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;
    a.download =
      'eduwills-test-result.png';

    a.click();

    URL.revokeObjectURL(url);
  }

  async function shareResult() {
    const blob =
      await makeResultImage();

    const file = new File(
      [blob],
      'eduwills-test-result.png',
      {
        type: 'image/png',
      }
    );

    if (
      navigator.share &&
      navigator.canShare?.({
        files: [file],
      })
    ) {
      await navigator.share({
        title:
          'My EDUWILLS quiz result',
        text:
          'My EDUWILLS test result',
        files: [file],
      });
    } else {
      await downloadResult();
    }
  }

  function scoreFor(
    list: Q[],
    a: number[],
    percent = false
  ) {
    const score = list.reduce(
      (n, q, i) =>
        n + (a[i] === q.answer ? 1 : 0),
      0
    );

    return percent
      ? Math.round(
          (score /
            Math.max(1, list.length)) *
            100
        )
      : score;
  }

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-soft">
          <Sparkles
            className="mx-auto text-eduBlue"
            size={38}
          />

          <p className="mt-3 font-black">
            Preparing your Quiz Studio…
          </p>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Quiz generation loading                                                  */
  /* ------------------------------------------------------------------------ */

  if (setup && quizLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6">
        <div className="max-w-md rounded-[2rem] bg-white p-9 text-center shadow-soft">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white">
            <Loader2
              className="animate-spin"
              size={30}
            />
          </div>

          <h1 className="mt-5 text-2xl font-black">
            EDUWILLS AI is studying your request…
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Grounding questions to the exact books
            you selected and building the requested
            batch.
          </p>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Results                                                                   */
  /* ------------------------------------------------------------------------ */

  if (setup && done) {
    const correct = scoreFor(qs, answers);
    const pct = scoreFor(
      qs,
      answers,
      true
    );

    return (
      <main className="min-h-screen bg-paper p-5 sm:p-8">
        <div className="mx-auto max-w-4xl">
          <a
            href={`${BASE}/dashboard/`}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"
          >
            <ArrowLeft size={17} />
            Dashboard
          </a>

          <section className="mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white shadow-xl sm:p-10">
            <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">
              Test Overview
            </p>

            <h1 className="mt-3 text-3xl font-black">
              Quiz complete 🎉
            </h1>

            <div className="mt-6 flex flex-wrap items-end gap-5">
              <div className="text-7xl font-black">
                {pct}%
              </div>

              <div className="pb-2 text-lg font-bold text-slate-300">
                {correct}/{qs.length} correct
              </div>
            </div>

            <div className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-4">
                <b>📚 Books</b>
                <br />
                {setup.books
                  .map(
                    (b) =>
                      `${b.title} — ${b.author}`
                  )
                  .join(', ')}
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <b>🎯 Difficulty</b>
                <br />
                {setup.difficulty}
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <b>⏱ Time allocated</b>
                <br />
                {setup.duration
                  ? `${setup.duration} minutes`
                  : 'No time limit'}
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <b>⌛ Time elapsed</b>
                <br />
                {elapsedText(elapsed)}
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-cyan-300/20 bg-white/10 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/20 text-cyan-200">
                  <Sparkles size={21} />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-cyan-200">
                    EDUWILLS AI Review
                  </p>

                  <h2 className="text-lg font-black">
                    Your learning review
                  </h2>
                </div>
              </div>

              <p className="mt-4 leading-7 text-slate-200">
                {feedbackLoading
                  ? 'EDUWILLS AI is reviewing your strengths and weaknesses…'
                  : cleanText(feedback) ||
                    'Your score has been recorded. Review the corrections below to strengthen your learning.'}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={downloadResult}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-black text-slate-900"
              >
                <Download size={17} />
                Download image
              </button>

              <button
                onClick={shareResult}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950"
              >
                <Share2 size={17} />
                Share result
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-eduBlue">
                  Complete review
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Every question
                </h2>
              </div>

              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">
                {correct}/{qs.length} correct
              </div>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Green = correct. Red = failed. Blue
              corrections explain what to learn next.
            </p>

            <div className="mt-6 space-y-5">
              {qs.map((q, i) => {
                const right =
                  answers[i] === q.answer;

                return (
                  <article
                    key={i}
                    className={`rounded-[1.5rem] border p-5 sm:p-6 ${
                      right
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-red-200 bg-red-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Question {i + 1}
                      </p>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                          right
                            ? 'bg-emerald-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {right ? (
                          <>
                            <Check size={13} />
                            Correct
                          </>
                        ) : (
                          <>
                            <XCircle size={13} />
                            Failed
                          </>
                        )}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-black leading-7 text-slate-900">
                      {q.question}
                    </h3>

                    {right ? (
                      <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-100 p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                          Answer gotten
                        </p>

                        <p className="mt-1 font-bold text-emerald-950">
                          {q.options[q.answer]}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-4 rounded-2xl border border-red-300 bg-red-100 p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-red-700">
                            Answer failed
                          </p>

                          <p className="mt-1 font-bold text-red-950">
                            {answers[i] == null
                              ? 'Not answered'
                              : q.options[
                                  answers[i]
                                ]}
                          </p>
                        </div>

                        <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                          <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                            Correction
                          </p>

                          <p className="mt-1 font-bold text-blue-950">
                            Correct answer:{' '}
                            {q.options[q.answer]}
                          </p>

                          <p className="mt-2 text-sm leading-6 text-blue-900">
                            {q.explanation ||
                              'Review the relevant part of the selected book and compare it with the correct answer.'}
                          </p>

                          <button
                            onClick={() =>
                              explainFailure(i)
                            }
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-md"
                          >
                            {whyLoading === i ? (
                              <Loader2
                                className="animate-spin"
                                size={16}
                              />
                            ) : (
                              <Sparkles size={16} />
                            )}

                            {whyLoading === i
                              ? 'Explaining…'
                              : 'Explain why I failed this'}
                          </button>

                          {why[i] && (
                            <div className="mt-3 rounded-xl border border-blue-200 bg-white p-3 text-sm leading-6 text-slate-700">
                              {why[i]}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={resetQuiz}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-black"
            >
              Take another quiz
            </button>

            {active && (
              <a
                href={`${BASE}/dashboard/history/`}
                className="rounded-xl bg-ink px-5 py-3 font-black text-white"
              >
                View Quiz History
              </a>
            )}
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Active quiz                                                              */
  /* ------------------------------------------------------------------------ */

  if (setup && qs.length) {
    const q = qs[idx];

    const mm =
      seconds === null
        ? '--'
        : String(
            Math.floor(seconds / 60)
          ).padStart(2, '0');

    const ss =
      seconds === null
        ? '--'
        : String(seconds % 60).padStart(2, '0');

    const selectedAnswer =
      answers[idx];

    return (
      <main className="min-h-screen bg-paper text-ink">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
            <div className="text-center">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black ${
                  seconds !== null &&
                  seconds <= 60
                    ? 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Clock3 size={16} />
                {mm}:{ss}
              </div>

              <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Time remaining
              </div>
            </div>

            <button
              onClick={() =>
                setExitQuiz(true)
              }
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 shadow-sm"
            >
              <X size={15} />
              Exit Quiz
            </button>
          </div>
        </header>

        {timeWarning && (
          <div className="mx-auto max-w-4xl px-5 pt-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              ⏰ {timeWarning}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl px-5 py-5">
          <div className="flex items-center justify-between text-xs font-black text-slate-400">
            <span>
              QUESTION {idx + 1} OF {qs.length}
            </span>

            <span>
              {
                answers.filter(
                  (x) => x !== undefined
                ).length
              }{' '}
              answered
            </span>
          </div>

          {quizError && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
              {quizError}
            </p>
          )}

          <section className="mt-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
            <h1 className="text-xl font-black leading-8 sm:text-2xl">
              {q.question}
            </h1>

            <div className="mt-6 grid gap-3">
              {q.options.map(
                (o, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() =>
                      choose(i)
                    }
                    className={`rounded-2xl border p-3.5 text-left text-sm font-bold transition sm:p-4 ${
                      selectedAnswer === i
                        ? 'border-eduBlue bg-blue-50 shadow-md ring-2 ring-blue-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`mr-3 inline-grid h-8 w-8 place-items-center rounded-xl ${
                        selectedAnswer === i
                          ? 'bg-eduBlue text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {String.fromCharCode(
                        65 + i
                      )}
                    </span>

                    {o}
                  </button>
                )
              )}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="overflow-x-auto pb-1">
                <div className="flex w-max min-w-full gap-2">
                  {qs.map(
                    (_, i) => (
                      <button
                        key={i}
                        onClick={() =>
                          setIdx(i)
                        }
                        className={`grid h-9 min-w-9 place-items-center rounded-xl border px-3 text-xs font-black ${
                          i === idx
                            ? 'border-eduBlue bg-eduBlue text-white'
                            : answers[i] !==
                              undefined
                            ? 'border-slate-300 bg-slate-100 text-slate-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </button>
                    )
                  )}
                </div>
              </div>

              <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Swipe sideways to navigate questions
              </p>
            </div>
          </section>

          <div className="mt-4 flex gap-3">
            <button
              disabled={idx === 0}
              onClick={() =>
                setIdx((v) =>
                  Math.max(0, v - 1)
                )
              }
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black disabled:opacity-40"
            >
              ← Back
            </button>

            {idx === qs.length - 1 ? (
              <button
                disabled={
                  selectedAnswer ===
                  undefined
                }
                onClick={() =>
                  setConfirmSubmit(true)
                }
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                Submit ✓
              </button>
            ) : (
              <button
                disabled={
                  selectedAnswer ===
                  undefined
                }
                onClick={() =>
                  setIdx((v) => v + 1)
                }
                className="flex-1 rounded-xl bg-ink px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                Next →
              </button>
            )}
          </div>
        </div>

        {confirmSubmit && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              <div className="bg-gradient-to-r from-indigo-600 to-cyan-500 p-6 text-white">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
                  <CheckCircle2 />
                </div>

                <h2 className="mt-4 text-2xl font-black">
                  Ready to submit?
                </h2>

                <p className="mt-1 text-sm text-white/80">
                  Your answers will be graded
                  and your personalized Test
                  Overview will appear next.
                </p>
              </div>

              <div className="p-6">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
                  {
                    answers.filter(
                      (x) => x !== undefined
                    ).length
                  }{' '}
                  of {qs.length} questions
                  answered.
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() =>
                      setConfirmSubmit(false)
                    }
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-black"
                  >
                    Keep working
                  </button>

                  <button
                    onClick={() =>
                      submitQuiz(false)
                    }
                    className="flex-1 rounded-xl bg-ink px-4 py-3 font-black text-white"
                  >
                    Submit quiz
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {exitQuiz && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              <div className="bg-gradient-to-br from-red-600 via-rose-600 to-indigo-600 p-7 text-white">
                <div className="flex items-center justify-between">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
                    <XCircle size={30} />
                  </div>

                  <button
                    onClick={() =>
                      setExitQuiz(false)
                    }
                    className="rounded-full bg-white/10 p-2"
                  >
                    <X size={19} />
                  </button>
                </div>

                <h2 className="mt-5 text-2xl font-black">
                  Leave this quiz?
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/85">
                  Your progress is saved on this
                  device. Exiting now will abandon
                  this attempt and it will not be
                  graded.
                </p>
              </div>

              <div className="p-6">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                  ⚠️ You have{' '}
                  {
                    answers.filter(
                      (x) => x !== undefined
                    ).length
                  }{' '}
                  answered questions. Your timer
                  will not stop while you leave.
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() =>
                      setExitQuiz(false)
                    }
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-black"
                  >
                    Continue quiz
                  </button>

                  <button
                    onClick={resetQuiz}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-black text-white"
                  >
                    Exit and discard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Quiz Studio setup                                                        */
  /* ------------------------------------------------------------------------ */

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50 text-ink">
      <header className="border-b border-white/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <a
            href={`${BASE}/dashboard/`}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"
          >
            <ArrowLeft size={17} />
            Dashboard
          </a>

          <div className="font-black">
            <Sparkles className="mr-1 inline text-eduBlue" />
            QUIZ STUDIO
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white shadow-xl sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-200">
            <Sparkles size={13} />
            EDUWILLS AI
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-4xl">
            Your personal Quiz Studio
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Choose your saved books and let
            EDUWILLS build questions from the exact
            books you select.
          </p>

          {!active && (
            <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-white/10 p-4">
              <p className="text-sm font-black">
                Free quiz access today
              </p>

              <p className="mt-1 text-sm text-slate-300">
                <span className="font-black text-white">
                  {freeQuizCount}/
                  {FREE_DAILY_QUIZZES}
                </span>{' '}
                quizzes used. You can generate up
                to {FREE_MAX_QUESTIONS} questions per
                quiz before activation is required.
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-400"
                  style={{
                    width: `${Math.min(
                      100,
                      (freeQuizCount /
                        FREE_DAILY_QUIZZES) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Book Library                                                      */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white">
              <BookOpen size={20} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-eduBlue">
                Book Library
              </p>

              <h2 className="text-xl font-black">
                Your five permanent slots
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {slots.map((b, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
              >
                {b ? (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Slot {i + 1}
                    </p>

                    <p className="mt-1 font-black">
                      {b.title}
                    </p>

                    <p className="text-sm text-slate-500">
                      {b.author} · Saved permanently
                    </p>
                  </>
                ) : (
                  <p className="font-bold text-slate-400">
                    Slot {i + 1} · Empty
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm font-black">
              Add a book
            </p>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  findBook()
                }
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-eduBlue focus:bg-white"
                placeholder="Search by book title…"
              />

              <button
                type="button"
                onClick={findBook}
                disabled={searching}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3.5 font-black text-white disabled:opacity-60"
              >
                {searching ? (
                  <>
                    <Loader2
                      className="animate-spin"
                      size={18}
                    />
                    Searching…
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Search book
                  </>
                )}
              </button>
            </div>

            {authors.length > 0 && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-black">
                      Verified author results
                    </p>

                    <p className="text-xs text-slate-500">
                      An author must be returned by
                      search before it can be saved.
                    </p>
                  </div>

                  <div className="flex w-full gap-2 sm:w-auto">
                    <input
                      value={authorQuery}
                      onChange={(e) =>
                        setAuthorQuery(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        searchAuthor()
                      }
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-eduBlue"
                      placeholder="Search author…"
                    />

                    <button
                      type="button"
                      onClick={searchAuthor}
                      disabled={searching}
                      className="rounded-xl bg-ink px-3 py-2 text-white"
                    >
                      <Search size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {visibleAuthors.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() =>
                        setAuthor(a)
                      }
                      className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm font-bold ${
                        author === a
                          ? 'border-eduBlue bg-white shadow-md'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {a}

                      {author === a && (
                        <Check
                          size={17}
                          className="text-eduBlue"
                        />
                      )}
                    </button>
                  ))}
                </div>

                <label className="mt-4 block text-sm font-black">
                  Save to slot

                  <div className="mt-2">
                    <QuizDropdown
                      value={
                        slot === ''
                          ? ''
                          : String(slot)
                      }
                      options={slotOptions}
                      onChange={(value) =>
                        setSlot(
                          value
                            ? Number(value)
                            : ''
                        )
                      }
                      placeholder="Choose an empty slot…"
                    />
                  </div>
                </label>

                <button
                  disabled={
                    saving ||
                    !author ||
                    !slot
                  }
                  onClick={saveBook}
                  className="mt-3 w-full rounded-2xl bg-ink py-3.5 font-black text-white disabled:opacity-40"
                >
                  {saving
                    ? 'Saving…'
                    : 'Save book permanently'}
                </button>
              </div>
            )}

            {message && (
              <p className="mt-4 rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-800">
                {message}
              </p>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Quiz Builder                                                      */}
        {/* ---------------------------------------------------------------- */}

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-soft sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white">
              <Sparkles size={20} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-wider text-eduBlue">
                Quiz Builder
              </p>

              <h2 className="text-xl font-black">
                Design your quiz
              </h2>
            </div>
          </div>

          <label className="mt-6 block text-sm font-black">
            Select book/s

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {books.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  onClick={() =>
                    setSelected((s) =>
                      s.includes(b.id)
                        ? s.filter(
                            (x) =>
                              x !== b.id
                          )
                        : [
                            ...s,
                            b.id,
                          ]
                    )
                  }
                  className={`rounded-2xl border p-4 text-left font-bold ${
                    selected.includes(
                      b.id
                    )
                      ? 'border-eduBlue bg-blue-50 shadow-md'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-lg bg-slate-100">
                    {selected.includes(
                      b.id
                    )
                      ? '✓'
                      : ''}
                  </span>

                  {b.title}

                  <span className="mt-1 block text-xs font-medium text-slate-500">
                    {b.author}
                  </span>
                </button>
              ))}
            </div>

            {!books.length && (
              <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Add a book above to start building
                your quiz.
              </p>
            )}
          </label>

          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {/* Questions */}
            <label className="text-sm font-black">
              Questions

              <input
                type="number"
                min="1"
                max={maxQuestions}
                value={questions}
                onChange={(e) =>
                  setQuestions(
                    Math.min(
                      maxQuestions,
                      Math.max(
                        1,
                        Number(
                          e.target.value
                        ) || 1
                      )
                    )
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold"
              />

              <span className="mt-1 block text-xs font-medium text-slate-400">
                Maximum {maxQuestions}
              </span>
            </label>

            {/* Duration */}
            <label className="text-sm font-black">
              Duration

              <div className="mt-2">
                <QuizDropdown
                  value={duration}
                  options={[
                    {
                      value: '10',
                      label: '10 minutes',
                    },
                    {
                      value: '20',
                      label: '20 minutes',
                    },
                    {
                      value: '30',
                      label: '30 minutes',
                    },
                    {
                      value: '45',
                      label: '45 minutes',
                    },
                    {
                      value: '60',
                      label: '60 minutes',
                    },
                    {
                      value: 'none',
                      label: 'No time limit',
                    },
                  ]}
                  onChange={setDuration}
                />
              </div>
            </label>

            {/* Difficulty */}
            <label className="text-sm font-black">
              Difficulty

              <div className="mt-2">
                <QuizDropdown
                  value={difficulty}
                  options={[
                    {
                      value: 'Easy',
                      label: 'Easy',
                    },
                    {
                      value: 'Medium',
                      label: 'Medium',
                    },
                    {
                      value: 'Hard',
                      label: 'Hard',
                    },
                    {
                      value: 'Mixed',
                      label: 'Mixed',
                    },
                  ]}
                  onChange={setDifficulty}
                />
              </div>
            </label>
          </div>

          <label className="mt-5 block text-sm font-black">
            Instructions for EDUWILLS AI{' '}
            <span className="font-normal text-slate-400">
              (max 100 characters)
            </span>

            <textarea
              maxLength={100}
              value={instructions}
              onChange={(e) =>
                setInstructions(
                  e.target.value
                )
              }
              className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none"
              placeholder="e.g. Focus on chapter 2 and questions about Okonkwo."
            />

            <span className="mt-1 block text-right text-xs text-slate-400">
              {instructions.length}/100
            </span>
          </label>

          <button
            type="button"
            onClick={startQuiz}
            disabled={
              starting ||
              !selected.length ||
              (!active &&
                freeQuizCount >=
                  FREE_DAILY_QUIZZES)
            }
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-4 font-black text-white shadow-lg disabled:opacity-40"
          >
            {starting ? (
              <>
                <Loader2
                  className="animate-spin"
                  size={19}
                />
                Preparing…
              </>
            ) : (
              <>
                <Sparkles size={19} />
                Generate quiz with EDUWILLS AI
              </>
            )}
          </button>
        </section>
      </div>
    </main>
  );
}
