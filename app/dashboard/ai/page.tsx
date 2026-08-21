'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Bot, LockKeyhole, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { getAiEntitlement, watchAiEntitlement, type AiEntitlement } from '@/lib/aiAccess';
import { askEduwills } from '@/lib/quizAiClient';

const BASE = '/eduwills';
const DAILY_LIMIT = 10;
const THINKING = ['Reading your question…', 'Checking the learning context…', 'Thinking through the answer…', 'Building a clear explanation…'];
type Msg = { role: 'ai' | 'user'; text: string };
const welcome = 'Hello! I’m EDUWILLS AI. Ask me about a book, character, theme, vocabulary, difficult passage, or study strategy.';

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
    setEntitlement(state.entitlement);
    setAuthLoading(false);
    if (state.error) console.error(state.error);
  }), []);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);
  useEffect(() => { if (!sending) return; let i = 0; const timer = setInterval(() => { i = (i + 1) % THINKING.length; setThinking(THINKING[i]); }, 2000); return () => clearInterval(timer); }, [sending]);

  async function refreshAccess() {
    const user = auth.currentUser;
    if (!user) return;
    const next = await getAiEntitlement(user);
    setEntitlement(next);
  }

  async function send() {
    const text = input.trim();
    const user = auth.currentUser;
    if (!text || sending || !user || !entitlement?.allowed || used >= DAILY_LIMIT) return;
    setInput(''); setMessages(value => [...value, { role: 'user', text }]); setSending(true);
    try {
      const history = [...messages, { role: 'user' as const, text }].map(m => `${m.role === 'user' ? 'Learner' : 'EDUWILLS AI'}: ${m.text}`);
      const answer = await askEduwills(text, history);
      if (!answer) throw new Error('EMPTY_AI_RESPONSE');
      setUsed(value => value + 1); setMessages(value => [...value, { role: 'ai', text: answer }]);
    } catch (error) { console.error('EDUWILLS AI error', error); setMessages(value => [...value, { role: 'ai', text: 'I’m temporarily unable to answer that. Please try again shortly.' }]); }
    finally { setSending(false); }
  }

  if (authLoading) return <main className="grid min-h-screen place-items-center bg-paper p-6"><p className="font-bold">Loading EDUWILLS AI…</p></main>;
  if (!entitlement?.allowed) return <main className="min-h-screen bg-paper px-5 py-8"><div className="mx-auto max-w-3xl"><a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17} /> Dashboard</a><section className="mt-8 overflow-hidden rounded-[2rem] bg-ink text-white shadow-soft"><div className="p-8 sm:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><LockKeyhole size={25} /></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">EDUWILLS • Book Learner</p><h1 className="mt-2 text-3xl font-black">EDUWILLS AI is locked</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">A valid account activation is required.</p><div className="mt-5 rounded-2xl bg-white/10 p-4 text-xs text-slate-300">Activation check: <strong className="text-white">{entitlement?.reason || 'checking'}</strong></div><div className="mt-6 flex flex-wrap gap-3"><button onClick={refreshAccess} className="rounded-xl bg-white px-5 py-3 font-black text-ink">Refresh activation</button><a href={`${BASE}/dashboard/activation/`} className="rounded-xl border border-white/20 px-5 py-3 font-black text-white">Activate with WilliToken</a></div></div></section></div></main>;

  const remaining = Math.max(0, DAILY_LIMIT - used);
  return <main className="min-h-screen bg-paper text-ink"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8"><a href={`${BASE}/dashboard/`} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><BookOpen size={20} /></span><span><span className="block font-black">EDUWILLS</span><span className="block text-[9px] font-bold uppercase tracking-[.18em] text-slate-400">Book Learner</span></span></a><div className="flex items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Activated</span><button onClick={() => setMessages([{ role: 'ai', text: welcome }])} className="rounded-xl border border-slate-200 p-2"><RotateCcw size={17} /></button></div></div></header><div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col px-4 py-5 sm:px-6"><section className="mb-5 rounded-[2rem] bg-ink p-7 text-white shadow-soft sm:p-9"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200"><Sparkles size={12} /> Study assistant</div><h1 className="mt-4 text-3xl font-black">Ask EDUWILLS AI.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Get help understanding books, characters, themes, vocabulary and study strategies.</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-center"><div className="text-2xl font-black">{remaining}</div><div className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">questions left today</div></div></div></section><div className="flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft"><div className="min-h-[55vh] flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">{messages.map((m, i) => <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.role === 'user' ? 'bg-slate-100 text-slate-600' : 'bg-ink text-white'}`}>{m.role === 'user' ? <UserRound size={17} /> : <Bot size={17} />}</div><div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'bg-eduBlue text-white' : 'bg-slate-50 text-slate-700'}`}>{m.text}</div></div>)}{sending && <div className="flex gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white"><Bot size={17} /></div><div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{thinking}</div></div>}<div ref={end} /></div><div className="border-t border-slate-100 p-3 sm:p-4"><div className="flex items-end gap-2"><textarea value={input} disabled={remaining === 0} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm outline-none focus:border-eduBlue disabled:opacity-50" placeholder={remaining === 0 ? 'Daily AI limit reached.' : 'Ask EDUWILLS AI…'} /><button onClick={() => void send()} disabled={!input.trim() || sending || remaining === 0} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-eduBlue text-white disabled:opacity-40"><Send size={18} /></button></div><p className="mt-2 text-center text-[10px] text-slate-400">Daily limit: {DAILY_LIMIT} questions.</p></div></div></div></main>;
}
