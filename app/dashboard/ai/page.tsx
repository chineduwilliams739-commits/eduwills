'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, LockKeyhole, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { getAiEntitlement, watchAiEntitlement, type AiEntitlement } from '@/lib/aiAccess';
import { askEduwills } from '@/lib/quizAiClient';

const BASE = '/eduwills';
const DAILY_LIMIT = 10;
const DAILY_KEY = 'eduwills-ai-questions';
const THINKING = ['Reading your question…', 'Checking the learning context…', 'Thinking through the answer…', 'Building a clear explanation…'];
type Msg = { role: 'ai' | 'user'; text: string };
const welcome = 'Hello! I’m EDUWILLS AI. Ask me about a book, character, theme, vocabulary, difficult passage, or study strategy.';

function todayKey() { return new Date().toISOString().slice(0, 10); }
function loadUsed(uid: string) { try { const raw = localStorage.getItem(`${DAILY_KEY}:${uid}`); if (!raw) return 0; const data = JSON.parse(raw); return data.date === todayKey() ? Math.max(0, Number(data.used) || 0) : 0; } catch { return 0; } }
function saveUsed(uid: string, used: number) { try { localStorage.setItem(`${DAILY_KEY}:${uid}`, JSON.stringify({ date: todayKey(), used })); } catch {} }

export default function AIPage() {
  const [entitlement, setEntitlement] = useState<AiEntitlement | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [used, setUsed] = useState(0);
  const [thinking, setThinking] = useState(THINKING[0]);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'ai', text: welcome }]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => watchAiEntitlement(state => {
    if (!state.user) { window.location.replace(`${BASE}/login/`); return; }
    setEntitlement(state.entitlement); setUsed(loadUsed(state.user.uid)); setAuthLoading(false);
    if (state.error) console.error(state.error);
  }), []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);
  useEffect(() => { if (!sending) return; let i = 0; const timer = setInterval(() => { i = (i + 1) % THINKING.length; setThinking(THINKING[i]); }, 2000); return () => clearInterval(timer); }, [sending]);

  async function refreshAccess() { const user = auth.currentUser; if (!user) return; setEntitlement(await getAiEntitlement(user)); setUsed(loadUsed(user.uid)); }
  async function send() {
    const text = input.trim(), user = auth.currentUser, currentUsed = user ? loadUsed(user.uid) : used;
    if (!text || sending || !user || !entitlement?.allowed || currentUsed >= DAILY_LIMIT) return;
    setInput(''); setMessages(v => [...v, { role: 'user', text }]); setSending(true);
    try {
      const history = [...messages, { role: 'user' as const, text }].map(m => `${m.role === 'user' ? 'Learner' : 'EDUWILLS AI'}: ${m.text}`);
      const answer = await askEduwills(text, history); if (!answer) throw new Error('EMPTY_AI_RESPONSE');
      const nextUsed = currentUsed + 1;
      saveUsed(user.uid, nextUsed); setUsed(nextUsed); setMessages(v => [...v, { role: 'ai', text: answer }]);
    } catch (error) { console.error('EDUWILLS AI error', error); setMessages(v => [...v, { role: 'ai', text: 'I’m temporarily unable to answer that. Please try again shortly.' }]); }
    finally { setSending(false); }
  }

  if (authLoading) return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><p className="font-bold">Loading EDUWILLS AI…</p></main>;
  if (!entitlement?.allowed) return <main className="min-h-screen bg-slate-950 px-5 py-7 text-white"><div className="mx-auto max-w-4xl"><a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-200"><ArrowLeft size={17} /> Dashboard</a><section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl"><div className="p-8 sm:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><LockKeyhole size={25} /></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">EDUWILLS • Book Learner</p><h1 className="mt-2 text-3xl font-black">EDUWILLS AI is locked</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">A valid account activation is required.</p><div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300">Activation check: <strong className="text-white">{entitlement?.reason || 'checking'}</strong></div><div className="mt-6 flex flex-wrap gap-3"><button onClick={refreshAccess} className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Refresh activation</button><a href={`${BASE}/dashboard/activation/`} className="rounded-xl border border-white/15 px-5 py-3 font-black text-white">Activate with WilliToken</a></div></div></section></div></main>;

  const remaining = Math.max(0, DAILY_LIMIT - used);
  return <main className="min-h-screen bg-slate-950 text-white"><header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6"><a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black hover:bg-white/10"><ArrowLeft size={17} /> Dashboard</a><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-black">EDUWILLS AI</p><p className="text-[9px] font-bold uppercase tracking-[.18em] text-slate-500">Book Learner</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-lg"><Sparkles size={19} /></span><button onClick={() => setMessages([{ role: 'ai', text: welcome }])} aria-label="New chat" className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 hover:bg-white/10"><RotateCcw size={17} /></button></div></div></header><div className="mx-auto flex min-h-[calc(100vh-65px)] w-full max-w-6xl flex-col px-4 py-5 sm:px-6"><section className="mb-5 overflow-hidden rounded-[2rem] border border-cyan-400/10 bg-gradient-to-br from-cyan-400/10 via-blue-500/5 to-white/[.03] p-7 shadow-2xl sm:p-9"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/10 bg-cyan-300/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300"><Bot size={12} /> Intelligent study assistant</div><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Ask EDUWILLS AI.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Understand books, characters, themes, vocabulary and difficult passages with a focused learning assistant.</p></div><div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-center"><div className="text-2xl font-black">{remaining}</div><div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">questions left today</div></div></div></section><div className="flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.03] shadow-2xl backdrop-blur"><div className="min-h-[55vh] flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">{messages.map((m, i) => <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.role === 'user' ? 'bg-white/10 text-slate-300' : 'bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950'}`}>{m.role === 'user' ? <UserRound size={17} /> : <Bot size={17} />}</div><div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'border-cyan-300/10 bg-cyan-500/15 text-white' : 'border-white/10 bg-white/[.04] text-slate-300'}`}>{m.text}</div></div>)}{sending && <div className="flex gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950"><Bot size={17} /></div><div className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-slate-500">{thinking}</div></div>}<div ref={end} /></div><div className="border-t border-white/10 bg-black/10 p-3 sm:p-4"><div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[.03] p-2"><textarea value={input} disabled={remaining === 0} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} className="min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-50" placeholder={remaining === 0 ? 'Daily AI limit reached.' : 'Ask EDUWILLS AI anything about your learning…'} /><button onClick={() => void send()} disabled={!input.trim() || sending || remaining === 0} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-lg disabled:opacity-30"><Send size={18} /></button></div><p className="mt-2 text-center text-[10px] text-slate-600">EDUWILLS AI • {DAILY_LIMIT} questions daily</p></div></div></div></main>;
}
