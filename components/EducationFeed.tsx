'use client';

import { useEffect, useState } from 'react';

const BASE = '/eduwills';
type NewsItem = { title: string; link: string; source: string; publishedAt: string; description?: string };

export default function EducationFeed() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/education-news.json?v=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setItems(Array.isArray(d.items) ? d.items.slice(0, 12) : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return <section className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-600">EDUWILLS feed</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">Education news & updates</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Fresh education stories collected daily from education and news sources. EDUWILLS does not alter the source article.</p>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">Updated daily</span>
    </div>
    {loading ? <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="h-24 animate-pulse rounded-2xl bg-slate-100"/><div className="h-24 animate-pulse rounded-2xl bg-slate-100"/></div> : items.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">
      {items.map((item, i) => <a key={`${item.link}-${i}`} href={item.link} target="_blank" rel="noreferrer" className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-white">
        <div className="flex items-start justify-between gap-4"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-700">{item.source || 'Education news'}</span><span className="text-[10px] font-bold text-slate-400">{item.publishedAt || ''}</span></div>
        <h3 className="mt-3 font-black leading-6 text-slate-900 group-hover:text-cyan-700">{item.title}</h3>
        {item.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.description}</p>}
        <p className="mt-4 text-xs font-black text-cyan-700">Read source →</p>
      </a>)}
    </div> : <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">The daily feed is preparing its next update. Please check back shortly.</div>}
  </section>;
}
