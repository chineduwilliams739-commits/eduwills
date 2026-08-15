import { ArrowLeft, Clock3 } from 'lucide-react';

export default function HistoryPage() {
  return <main className="min-h-screen bg-paper px-5 py-8 sm:px-8"><div className="mx-auto max-w-5xl"><a href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Dashboard</a><div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-10"><Clock3 className="text-eduBlue"/><h1 className="mt-5 text-3xl font-black text-ink">Quiz History</h1><p className="mt-2 text-sm leading-6 text-slate-500">Your completed book quizzes, scores and performance summaries will appear here.</p><div className="mt-8 rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm font-bold text-slate-400">No completed quizzes yet.</div></div></div></main>;
}
