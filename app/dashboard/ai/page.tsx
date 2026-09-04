'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, LockKeyhole, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getAiEntitlement, watchAiEntitlement, type AiEntitlement } from '@/lib/aiAccess';
import { askEduwills } from '@/lib/quizAiClient';

const BASE = '/eduwills';
const QUESTIONS_PER_CATEGORY = 10;
const DAILY_KEY = 'eduwills-ai-category-questions';
const CATEGORIES = ['Book Learner', 'Senior Secondary', 'Junior Secondary', 'Primary'] as const;
const CATEGORY_IDS: Record<string, string> = { 'Book Learner': 'book', 'Senior Secondary': 'senior', 'Junior Secondary': 'junior', Primary: 'primary' };
const THINKING = ['Reading your question…', 'Checking the learning context…', 'Thinking through the answer…', 'Building a clear explanation…'];
type Category = typeof CATEGORIES[number];
type Msg = { role: 'ai' | 'user'; text: string };
const welcome = 'Hello! I’m EDUWILLS AI. I can help with schoolwork, books, explanations, general knowledge, reasoning, writing, calculations, and everyday questions. Ask me anything.';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function categoryLabel(v: unknown): Category | '' { const s = String(v || '').trim().toLowerCase(); if (s === 'book' || s === 'books' || s === 'book learner') return 'Book Learner'; if (s === 'senior' || s === 'sss' || s === 'senior secondary') return 'Senior Secondary'; if (s === 'junior' || s === 'jss' || s === 'junior secondary') return 'Junior Secondary'; if (s === 'primary' || s === 'primary school' || s === 'pupil' || s === 'pupils') return 'Primary'; return ''; }
function normaliseCategories(values: unknown[]): Category[] { return [...new Set(values.map(categoryLabel).filter(Boolean))] as Category[]; }
function loadUsage(uid: string): Record<string, number> { try { const raw = localStorage.getItem(`${DAILY_KEY}:${uid}`); if (!raw) return {}; const data = JSON.parse(raw); return data.date === todayKey() && data.used && typeof data.used === 'object' ? data.used : {}; } catch { return {}; } }
function saveUsage(uid: string, used: Record<string, number>) { try { localStorage.setItem(`${DAILY_KEY}:${uid}`, JSON.stringify({ date: todayKey(), used })); } catch {} }
function tokenExpiry(v: any) { if (!v) return 0; if (typeof v?.toMillis === 'function') return v.toMillis(); if (v?.seconds) return Number(v.seconds) * 1000; const n = Date.parse(String(v)); return Number.isFinite(n) ? n : 0; }

export default function AIPage() {
  const [entitlement, setEntitlement] = useState<AiEntitlement | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [unlocked, setUnlocked] = useState<Category[]>(['Book Learner']);
  const [category, setCategory] = useState<Category>('Book Learner');
  const [thinking, setThinking] = useState(THINKING[0]);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'ai', text: welcome }]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => watchAiEntitlement(state => {
    if (!state.user) { window.location.replace(`${BASE}/login/`); return; }
    setEntitlement(state.entitlement); setUsage(loadUsage(state.user.uid)); setAuthLoading(false);
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', state.user!.uid));
        const d: any = snap.exists() ? snap.data() : {};
        let tokenCategories: unknown[] = [];
        try {
          const tokens = await getDocs(query(collection(db, 'williTokens'), where('userId', '==', state.user!.uid)));
          const now = Date.now();
          tokenCategories = tokens.docs.flatMap(x => { const t: any = x.data(); const exp = tokenExpiry(t.expiresAt || t.activationExpiresAt || t.expiry); if (t.revoked === true || t.cancelled === true || (exp && exp <= now)) return []; return Array.isArray(t.categories) ? t.categories : []; });
        } catch {}
        const categories = normaliseCategories([...(Array.isArray(d.categories) ? d.categories : []), ...(Array.isArray(d.educationLevels) ? d.educationLevels : []), ...(Array.isArray(d.schoolLevels) ? d.schoolLevels : []), d.category, d.educationLevel, d.schoolLevel, ...tokenCategories]);
        const available: Category[] = categories.length ? categories : ['Book Learner'];
        setUnlocked(available);
        const saved = categoryLabel(d.activeCategory || sessionStorage.getItem('eduwills_active_category') || localStorage.getItem('eduwills_active_category'));
        if (saved && available.includes(saved)) setCategory(saved); else if (!available.includes(category)) setCategory(available[0]);
      } catch (error) { console.error('EDUWILLS AI category loading error', error); }
    })();
  }), []);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);
  useEffect(() => { if (!sending) return; let i = 0; const timer = setInterval(() => { i = (i + 1) % THINKING.length; setThinking(THINKING[i]); }, 1800); return () => clearInterval(timer); }, [sending]);

  async function refreshAccess() { const user = auth.currentUser; if (!user) return; setEntitlement(await getAiEntitlement(user)); setUsage(loadUsage(user.uid)); }
  async function send() {
    const text = input.trim(), user = auth.currentUser, currentUsed = user ? loadUsage(user.uid) : usage;
    const usedHere = Number(currentUsed[category] || 0);
    if (!text || sending || !user || !entitlement?.allowed || usedHere >= QUESTIONS_PER_CATEGORY) return;
    setInput(''); setMessages(v => [...v, { role: 'user', text }]); setSending(true);
    try {
      const history = [...messages, { role: 'user' as const, text }].map(m => `${m.role === 'user' ? 'Learner' : 'EDUWILLS AI'}: ${m.text}`);
      const systemContext = `You are EDUWILLS AI, the general educational and knowledge assistant of EDUWILLS. CHINEDU WILLIAMS UCHENNA is the maker and owner of EDUWILLS. Always identify him as the maker/owner when asked who created, made, founded, or owns EDUWILLS. You are not limited to books. Answer general questions as well as educational questions. The learner currently has the ${category} category unlocked. Use that category as educational level/context when relevant, but do not refuse a reasonable general question merely because it is outside the category. Be accurate, explain concepts clearly, admit uncertainty rather than inventing facts, and distinguish current information from timeless knowledge. Conversation follows.\n${history.join('\n')}`;
      const answer = await askEduwills(`${systemContext}\n\nLearner's latest question: ${text}`, history);
      if (!answer) throw new Error('EMPTY_AI_RESPONSE');
      const nextUsage = { ...currentUsed, [category]: usedHere + 1 };
      saveUsage(user.uid, nextUsage); setUsage(nextUsage); setMessages(v => [...v, { role: 'ai', text: answer }]);
    } catch (error) { console.error('EDUWILLS AI error', error); setMessages(v => [...v, { role: 'ai', text: 'I’m temporarily unable to answer that. Please try again shortly.' }]); }
    finally { setSending(false); }
  }

  if (authLoading) return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><p className="font-bold">Loading EDUWILLS AI…</p></main>;
  if (!entitlement?.allowed) return <main className="min-h-screen bg-slate-950 px-5 py-7 text-white"><div className="mx-auto max-w-4xl"><a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200"><ArrowLeft size={17} /> Dashboard</a><section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl"><div className="p-8 sm:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><LockKeyhole size={25} /></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">EDUWILLS • AI</p><h1 className="mt-2 text-3xl font-black">EDUWILLS AI is locked</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">A valid account activation is required.</p><div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300">Activation check: <strong className="text-white">{entitlement?.reason || 'checking'}</strong></div><div className="mt-6 flex flex-wrap gap-3"><button onClick={refreshAccess} className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Refresh activation</button><a href={`${BASE}/dashboard/activation/`} className="rounded-xl border border-white/15 px-5 py-3 font-black text-white">Activate with WilliToken</a></div></div></section></div></main>;

  const usedHere = Number(usage[category] || 0); const remaining = Math.max(0, QUESTIONS_PER_CATEGORY - usedHere); const totalRemaining = unlocked.reduce((sum, c) => sum + Math.max(0, QUESTIONS_PER_CATEGORY - Number(usage[c] || 0)), 0);
  return <main className="min-h-screen bg-slate-950 text-white"><header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black hover:bg-white/10"><ArrowLeft size={17} /> Dashboard</a><div className="flex items-center gap-2"><div className="hidden text-right sm:block"><p className="text-sm font-black">EDUWILLS AI</p><p className="text-[9px] font-bold uppercase tracking-[.18em] text-slate-500">General learning assistant</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-lg"><Sparkles size={19} /></span><button onClick={() => setMessages([{ role: 'ai', text: welcome }])} aria-label="New chat" className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10"><RotateCcw size={17} /></button></div></div></header><div className="mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-6xl flex-col px-4 py-5 sm:px-6"><section className="mb-5 overflow-hidden rounded-[2rem] border border-cyan-400/10 bg-gradient-to-br from-cyan-400/10 via-blue-500/5 to-white/[.03] p-7 shadow-2xl sm:p-9"><div className="flex flex-col justify-between gap-6"><div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/10 bg-cyan-300/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300"><Bot size={12} /> General educational intelligence</div><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Ask EDUWILLS AI anything.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Your unlocked category sets the learning level, but EDUWILLS AI can answer general questions too—not just questions about books.</p></div><div className="flex flex-wrap gap-2">{unlocked.map(c => <button key={c} type="button" onClick={() => setCategory(c)} className={`rounded-xl border px-4 py-2.5 text-xs font-black transition ${category === c ? 'border-cyan-300/30 bg-cyan-400/15 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'}`}>{c}<span className="ml-2 opacity-70">{Math.max(0, QUESTIONS_PER_CATEGORY - Number(usage[c] || 0))}/10</span></button>)}<div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-xs font-black text-slate-400">{totalRemaining} total questions left today</div></div></div></section><div className="flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.03] shadow-2xl backdrop-blur"><div className="min-h-[55vh] flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">{messages.map((m, i) => <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.role === 'user' ? 'bg-white/10 text-slate-300' : 'bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950'}`}>{m.role === 'user' ? <UserRound size={17} /> : <Bot size={17} />}</div><div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'border-cyan-300/10 bg-cyan-500/15 text-white' : 'border-white/10 bg-white/[.04] text-slate-300'}`}>{m.text}</div></div>)}{sending && <div className="flex gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950"><Bot size={17} /></div><div className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-slate-500">{thinking}</div></div>}<div ref={end} /></div><div className="border-t border-white/10 bg-black/10 p-3 sm:p-4"><div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-2"><textarea value={input} disabled={remaining === 0} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} className="min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-50" placeholder={remaining === 0 ? `${category} daily limit reached. Switch category or return tomorrow.` : 'Ask EDUWILLS AI anything…'} /><button onClick={() => void send()} disabled={!input.trim() || sending || remaining === 0} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-lg disabled:opacity-30"><Send size={18} /></button></div><p className="mt-2 text-center text-[10px] text-slate-600">{category} • {usedHere}/10 used today • resets daily</p></div></div></div></main>;
}
