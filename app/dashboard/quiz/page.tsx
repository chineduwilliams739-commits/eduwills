'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Check, CheckCircle2, Clock3, Plus, Search, Sparkles, Loader2, ChevronDown } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
type Book = { id: string; slot: number; title: string; author: string };
type Q = { question: string; options: string[]; answer: number; explanation?: string };
type Setup = { id: string; books: { title: string; author: string }[]; questions: number; duration: number | null; difficulty: string; instructions: string };
type CuratedBook = { title: string; aliases: string[]; authors: string[] };

const CURATED_BOOKS: CuratedBook[] = [
  { title: 'Sànyà', aliases: ['sanya', 'sanya novel', 'sanya oyin olugbile'], authors: ['Oyin Olugbile', 'Óyìn Olúgbilé'] },
  { title: 'SCARS: Nigeria’s Journey and the Boko Haram Conundrum', aliases: ['scars', 'scars nigeria', 'boko haram conundrum', 'scars lucky irabor', 'scars leo irabor'], authors: ['Gen. Leo Irabor', 'General Lucky Eluonye Onyenuchea Irabor', 'Lucky Irabor'] },
];

function expiryMs(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fallback(setup: Setup): Q[] {
  return Array.from({ length: setup.questions }, () => ({
    question: `Which study approach is most appropriate when learning ${setup.books.map((b) => b.title).join(' and ')}?`,
    options: ['Read the relevant material carefully and review evidence', 'Ignore the text and guess', 'Study only the cover', 'Avoid reviewing your answers'],
    answer: 0,
    explanation: 'Practice fallback: the free AI service was unavailable.',
  }));
}

function cleanAI(text: string): Q[] {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  if (!Array.isArray(parsed)) throw new Error('Invalid AI output');
  return parsed.map((q: any) => ({ question: String(q.question || ''), options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : [], answer: Number(q.answer), explanation: q.explanation ? String(q.explanation) : '' })).filter((q) => q.question && q.options.length === 4 && q.answer >= 0 && q.answer < 4);
}

async function authorSearchOpenLibrary(queryText: string) {
  const response = await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(queryText)}&limit=30`);
  if (!response.ok) return [] as string[];
  const data = await response.json();
  return (data.docs || []).flatMap((item: any) => item.author_name || []).filter(Boolean) as string[];
}

async function authorSearchGoogle(queryText: string) {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`inauthor:${queryText}`)}&maxResults=20`);
  if (!response.ok) return [] as string[];
  const data = await response.json();
  return (data.items || []).flatMap((item: any) => item.volumeInfo?.authors || []).filter(Boolean) as string[];
}

export default function QuizPage() {
  const [active, setActive] = useState(false), [loading, setLoading] = useState(true), [books, setBooks] = useState<Book[]>([]), [selected, setSelected] = useState<string[]>([]), [questions, setQuestions] = useState(10), [duration, setDuration] = useState('20'), [difficulty, setDifficulty] = useState('Mixed'), [instructions, setInstructions] = useState(''), [title, setTitle] = useState(''), [authors, setAuthors] = useState<string[]>([]), [author, setAuthor] = useState(''), [authorQuery, setAuthorQuery] = useState(''), [slot, setSlot] = useState<number | ''>(''), [saving, setSaving] = useState(false), [searching, setSearching] = useState(false), [starting, setStarting] = useState(false), [message, setMessage] = useState(''), [setup, setSetup] = useState<Setup | null>(null), [qs, setQs] = useState<Q[]>([]), [idx, setIdx] = useState(0), [answers, setAnswers] = useState<number[]>([]), [seconds, setSeconds] = useState<number | null>(null), [quizLoading, setQuizLoading] = useState(false), [quizError, setQuizError] = useState(''), [done, setDone] = useState(false);

  const load = async (user: any) => {
    const snapshot = await getDocs(query(collection(db, 'bookSlots'), where('userId', '==', user.uid)));
    setBooks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Book)).sort((a, b) => a.slot - b.slot));
  };

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.replace(`${BASE}/login/`); return; }
    try { const snapshot = await getDoc(doc(db, 'users', user.uid)); const data = snapshot.data() || {}; setActive(data.activated === true && expiryMs(data.activationExpiresAt) > Date.now()); await load(user); }
    catch { setMessage('Could not load your quiz library.'); }
    finally { setLoading(false); }
  }), []);

  useEffect(() => { if (seconds === null || done) return; const timer = setInterval(() => setSeconds((value) => value !== null && value > 0 ? value - 1 : 0), 1000); return () => clearInterval(timer); }, [seconds, done]);
  useEffect(() => { if (seconds === 0 && !done && qs.length) finish(answers); }, [seconds]);

  const slots = useMemo(() => Array.from({ length: 5 }, (_, i) => books.find((book) => book.slot === i + 1)), [books]);
  const visibleAuthors = authors.filter((name) => normalize(name).includes(normalize(authorQuery)));

  async function findBook() {
    const raw = title.trim(); if (!raw) return;
    setMessage(''); setAuthors([]); setAuthor(''); setAuthorQuery(''); setSearching(true);
    try {
      const normalizedTitle = normalize(raw);
      const curatedAuthors = CURATED_BOOKS.filter((book) => [book.title, ...book.aliases].some((alias) => { const a = normalize(alias); return a.includes(normalizedTitle) || normalizedTitle.includes(a); })).flatMap((book) => book.authors);
      const discovered: string[] = [];
      for (const queryText of Array.from(new Set([raw, normalizedTitle]))) {
        try { const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(queryText)}&limit=30`); if (response.ok) { const data = await response.json(); discovered.push(...(data.docs || []).flatMap((item: any) => item.author_name || []).filter(Boolean)); } } catch {}
        try { const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryText)}&maxResults=20`); if (response.ok) { const data = await response.json(); discovered.push(...(data.items || []).flatMap((item: any) => item.volumeInfo?.authors || []).filter(Boolean)); } } catch {}
      }
      const names = Array.from(new Set([...curatedAuthors, ...discovered]));
      setAuthors(names.slice(0, 50));
      setMessage(curatedAuthors.length ? 'EDUWILLS found a match in its expanded Nigerian book catalogue. Select the verified author below.' : names.length ? 'Possible authors found. Select the author that matches your book.' : 'No author candidates were found. Search for the author by name below.');
    } catch { setMessage('Book search is temporarily unavailable. Please try again.'); }
    finally { setSearching(false); }
  }

  async function searchAuthor() {
    const queryText = authorQuery.trim(); if (!queryText) return;
    setSearching(true); setMessage('');
    try {
      const normalizedQuery = normalize(queryText);
      const curated = CURATED_BOOKS.flatMap((book) => book.authors).filter((name) => normalize(name).includes(normalizedQuery));
      const [openNames, googleNames] = await Promise.all([authorSearchOpenLibrary(queryText), authorSearchGoogle(queryText)]);
      const names = Array.from(new Set([...curated, ...openNames, ...googleNames]));
      setAuthors((previous) => Array.from(new Set([...previous, ...names])).slice(0, 50));
      setMessage(names.length ? 'Select an author from the verified search results.' : 'No verified author match was found. Try another spelling or the author’s full name.');
    } catch { setMessage('Author search is temporarily unavailable.'); }
    finally { setSearching(false); }
  }

  async function saveBook() {
    if (!auth.currentUser || !author || !slot) return;
    setSaving(true); setMessage('');
    try {
      if (slots[Number(slot) - 1]) { setMessage('That slot is already occupied.'); return; }
      await addDoc(collection(db, 'bookSlots'), { userId: auth.currentUser.uid, slot: Number(slot), title: title.trim(), author, createdAt: serverTimestamp() });
      setTitle(''); setAuthors([]); setAuthor(''); setAuthorQuery(''); setSlot(''); setMessage('Book saved permanently.'); await load(auth.currentUser);
    } catch (error: any) { setMessage(error?.message || 'Could not save the book.'); }
    finally { setSaving(false); }
  }

  async function startQuiz() {
    if (!selected.length) { setMessage('Choose at least one book before starting.'); return; }
    setMessage(''); setStarting(true);
    try {
      const chosen = books.filter((book) => selected.includes(book.id));
      const ref = await addDoc(collection(db, 'quizHistory'), { userId: auth.currentUser!.uid, books: chosen.map((book) => ({ title: book.title, author: book.author })), questions, duration: duration === 'none' ? null : Number(duration), difficulty, instructions, status: 'ready', createdAt: serverTimestamp() });
      const nextSetup: Setup = { id: ref.id, books: chosen.map((book) => ({ title: book.title, author: book.author })), questions, duration: duration === 'none' ? null : Number(duration), difficulty, instructions };
      setSetup(nextSetup); setIdx(0); setAnswers([]); setDone(false); setQuizError(''); setSeconds(nextSetup.duration ? nextSetup.duration * 60 : null); setQuizLoading(true); await generate(nextSetup);
    } catch { setMessage('Could not start the quiz. Please try again.'); }
    finally { setStarting(false); }
  }

  async function generate(current: Setup) {
    try {
      const prompt = `You are EDUWILLS, an educational quiz generator. Create exactly ${current.questions} multiple-choice questions for the selected books: ${current.books.map((book) => `${book.title} by ${book.author}`).join('; ')}. Difficulty: ${current.difficulty}. User instruction: ${current.instructions || 'None'}. Do not invent quotations. Return ONLY a JSON array with question, options (exactly four strings), answer (integer 0-3), explanation.`;
      const response = await fetch('https://text.pollinations.ai/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: 'openai' }) });
      if (!response.ok) throw new Error('AI unavailable');
      const parsed = cleanAI(await response.text()); if (parsed.length < Math.min(3, current.questions)) throw new Error('Insufficient AI questions'); setQs(parsed.slice(0, current.questions));
    } catch (error) { console.warn(error); setQuizError('EDUWILLS AI is temporarily unavailable, so practice questions are being used.'); setQs(fallback(current)); }
    finally { setQuizLoading(false); }
  }

  async function finish(answerList = answers) {
    setDone(true); if (!setup) return;
    const correct = qs.reduce((score, question, questionIndex) => score + (answerList[questionIndex] === question.answer ? 1 : 0), 0);
    try { await updateDoc(doc(db, 'quizHistory', setup.id), { status: 'completed', score: correct, total: qs.length, percentage: Math.round((correct / Math.max(1, qs.length)) * 100), completedAt: serverTimestamp() }); } catch {}
  }

  function choose(answer: number) { const next = [...answers]; next[idx] = answer; setAnswers(next); if (idx < qs.length - 1) setIdx(idx + 1); else finish(next); }

  if (loading) return <main className="grid min-h-screen place-items-center bg-paper p-6"><div className="rounded-3xl bg-white p-8 text-center shadow-soft"><Sparkles className="mx-auto text-eduBlue" size={38} /><p className="mt-3 font-black">Preparing your Quiz Studio…</p></div></main>;
  if (!active) return <main className="min-h-screen bg-paper p-6"><div className="mx-auto max-w-xl pt-12 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white shadow-lg"><Sparkles size={34} /></div><h1 className="mt-6 text-3xl font-black">Your Quiz Studio is waiting for you</h1><p className="mt-3 text-slate-500">Activate EDUWILLS to unlock personalized book quizzes, AI-powered practice and your learning history.</p><a href={`${BASE}/dashboard/activation/`} className="mt-7 inline-flex rounded-2xl bg-ink px-6 py-3.5 font-black text-white shadow-lg">Unlock Quiz Studio ✨</a></div></main>;
  if (setup && quizLoading) return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6"><div className="max-w-md rounded-[2rem] bg-white p-9 text-center shadow-soft"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white"><Loader2 className="animate-spin" size={30} /></div><h1 className="mt-5 text-2xl font-black">EDUWILLS AI is studying your request…</h1><p className="mt-2 text-sm leading-6 text-slate-500">Finding the best question mix for your selected books, difficulty and instructions.</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" /></div></div></main>;
  if (setup && done) { const score = qs.reduce((total, question, questionIndex) => total + (answers[questionIndex] === question.answer ? 1 : 0), 0); return <main className="min-h-screen bg-paper p-6"><div className="mx-auto max-w-3xl pt-10"><section className="rounded-[2rem] bg-white p-8 text-center shadow-soft sm:p-12"><CheckCircle2 className="mx-auto text-emerald-600" size={54} /><h1 className="mt-5 text-3xl font-black">Quiz complete!</h1><div className="mt-4 text-5xl font-black text-eduBlue">{score}/{qs.length}</div><p className="mt-2 font-bold">{Math.round((score / Math.max(1, qs.length)) * 100)}%</p>{quizError && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{quizError}</p>}<div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center"><a href={`${BASE}/dashboard/history/`} className="rounded-xl bg-ink px-5 py-3 font-black text-white">View History</a><button onClick={() => { setSetup(null); setQs([]); setDone(false); setAnswers([]); setQuizError(''); }} className="rounded-xl border border-slate-200 px-5 py-3 font-black">Take another quiz</button></div></section></div></main>; }
  if (setup && qs.length) { const question = qs[idx]; const mm = seconds === null ? '--' : String(Math.floor(seconds / 60)).padStart(2, '0'); const ss = seconds === null ? '--' : String(seconds % 60).padStart(2, '0'); return <main className="min-h-screen bg-paper text-ink"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4"><button type="button" onClick={() => { setSetup(null); setQs([]); }} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17} /> Exit</button><div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black"><Clock3 className="mr-1 inline" size={14} />{mm}:{ss}</div></div></header><div className="mx-auto max-w-3xl px-5 py-8"><div className="mb-5 flex justify-between text-xs font-black text-slate-400"><span>QUESTION {idx + 1} OF {qs.length}</span><span>{answers.filter((value) => value !== undefined).length} answered</span></div>{quizError && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{quizError}</p>}<section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><h1 className="text-xl font-black leading-8 sm:text-2xl">{question.question}</h1><div className="mt-7 grid gap-3">{question.options.map((option, optionIndex) => <button type="button" key={optionIndex} onClick={() => choose(optionIndex)} className={`rounded-2xl border p-4 text-left text-sm font-bold transition hover:-translate-y-0.5 ${answers[idx] === optionIndex ? 'border-eduBlue bg-blue-50 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}><span className="mr-3 inline-grid h-8 w-8 place-items-center rounded-lg bg-slate-100">{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div></section></div></main>; }

  return <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50 text-ink"><header className="border-b border-white/70 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17} /> Dashboard</a><div className="font-black"><Sparkles className="mr-1 inline text-eduBlue" />QUIZ STUDIO</div></div></header><div className="mx-auto max-w-5xl px-5 py-8"><section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 p-7 text-white shadow-xl sm:p-10"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-200"><Sparkles size={13} /> EDUWILLS AI</div><h1 className="mt-4 text-3xl font-black sm:text-4xl">Your personal Quiz Studio</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Search your books, choose the right author and let EDUWILLS build a quiz around exactly what you want to study.</p></section>

<section className="mt-6 rounded-[2rem] border border-white/80 bg-white p-6 shadow-soft sm:p-8"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white"><BookOpen size={20} /></div><div><p className="text-xs font-black uppercase tracking-wider text-eduBlue">Book Library</p><h2 className="text-xl font-black">Your five permanent slots</h2></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{slots.map((book, index) => <div key={index} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">{book ? <><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Slot {index + 1}</p><p className="mt-1 font-black">{book.title}</p><p className="text-sm text-slate-500">{book.author} · Saved permanently</p></> : <div className="flex items-center gap-3 text-slate-400"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><Plus size={18} /></div><span className="font-bold">Slot {index + 1} · Empty</span></div>}</div>)}</div>

<div className="mt-6 border-t border-slate-100 pt-6"><p className="text-sm font-black">Add a book</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && findBook()} className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-eduBlue focus:bg-white" placeholder="Search by book title…" /><button type="button" onClick={findBook} disabled={searching} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3.5 font-black text-white shadow-md disabled:opacity-60">{searching ? <><Loader2 className="animate-spin" size={18} /> Searching…</> : <><Search size={18} /> Search book</>}</button></div>{searching && <div className="mt-4 flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-800"><Loader2 className="animate-spin" size={19} /><div><p>EDUWILLS AI is searching for your book…</p><p className="mt-0.5 text-xs font-medium text-indigo-600">Checking multiple book sources and verified author records.</p></div></div>}

<div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-black">Find the author</p><p className="text-xs text-slate-500">Authors must come from a verified search result. You cannot enter an author manually.</p></div><div className="flex w-full gap-2 sm:w-auto"><input value={authorQuery} onChange={(event) => setAuthorQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && searchAuthor()} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-eduBlue" placeholder="Search author…" /><button type="button" onClick={searchAuthor} disabled={searching} className="rounded-xl bg-ink px-3 py-2 text-white"><Search size={16} /></button></div></div>{authors.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{visibleAuthors.map((name) => <button type="button" key={name} onClick={() => setAuthor(name)} className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm font-bold transition hover:-translate-y-0.5 ${author === name ? 'border-eduBlue bg-white shadow-md' : 'border-slate-200 bg-white'}`}>{name}{author === name && <Check size={17} className="text-eduBlue" />}</button>)}</div>}{authors.length > 0 && visibleAuthors.length === 0 && <p className="mt-3 text-sm text-slate-500">No displayed match. Search the author again.</p>}
<label className="mt-4 block text-sm font-black">Save to slot<div className="relative mt-2"><select value={slot} onChange={(event) => setSlot(event.target.value ? Number(event.target.value) : '')} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold outline-none focus:border-eduBlue"><option value="">Choose an empty slot…</option>{slots.map((book, index) => !book && <option key={index} value={index + 1}>Slot {index + 1}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /></div></label><button type="button" disabled={saving || !author || !slot} onClick={saveBook} className="mt-3 w-full rounded-2xl bg-ink py-3.5 font-black text-white shadow-md transition hover:-translate-y-0.5 disabled:opacity-40">{saving ? 'Saving your book…' : 'Save book permanently'}</button></div>{message && <p className="mt-4 rounded-2xl bg-indigo-50 p-4 text-sm font-bold text-indigo-800">{message}</p>}</div></section>

<section className="mt-6 rounded-[2rem] border border-white/80 bg-white p-6 shadow-soft sm:p-8"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-white"><Sparkles size={20} /></div><div><p className="text-xs font-black uppercase tracking-wider text-eduBlue">Quiz Builder</p><h2 className="text-xl font-black">Design your quiz</h2></div></div><label className="mt-6 block text-sm font-black">Select book/s<div className="mt-2 grid gap-2 sm:grid-cols-2">{books.map((book) => <button type="button" key={book.id} onClick={() => setSelected((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} className={`rounded-2xl border p-4 text-left font-bold transition hover:-translate-y-0.5 ${selected.includes(book.id) ? 'border-eduBlue bg-gradient-to-r from-indigo-50 to-cyan-50 shadow-md' : 'border-slate-200 bg-white'}`}><span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-lg bg-slate-100">{selected.includes(book.id) ? '✓' : ''}</span>{book.title}<span className="mt-1 block text-xs font-medium text-slate-500">{book.author}</span></button>)}</div>{!books.length && <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Add a book above to start building your quiz.</p>}</label><div className="mt-6 grid gap-5 sm:grid-cols-3"><label className="text-sm font-black">Questions<input type="number" min="1" max="100" value={questions} onChange={(event) => setQuestions(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold outline-none focus:border-eduBlue" /></label><label className="text-sm font-black">Duration<div className="relative mt-2"><select value={duration} onChange={(event) => setDuration(event.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold outline-none focus:border-eduBlue"><option value="10">10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="none">No time limit</option></select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /></div></label><label className="text-sm font-black">Difficulty<div className="relative mt-2"><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold outline-none focus:border-eduBlue"><option>Easy</option><option>Medium</option><option>Hard</option><option>Mixed</option></select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /></div></label></div><label className="mt-5 block text-sm font-black">Instructions for EDUWILLS AI <span className="font-normal text-slate-400">(max 100 characters)</span><textarea maxLength={100} value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 outline-none focus:border-eduBlue" placeholder="e.g. Focus on chapter 2 and questions about Okonkwo." /><span className="mt-1 block text-right text-xs text-slate-400">{instructions.length}/100</span></label><button type="button" onClick={startQuiz} disabled={starting || !selected.length} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-4 font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-40">{starting ? <><Loader2 className="animate-spin" size={19} /> Building your quiz…</> : <><Sparkles size={19} /> Generate quiz with EDUWILLS AI</>}</button></section></div></main>;
}
