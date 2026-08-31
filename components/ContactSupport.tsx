'use client';

import { MessageCircle } from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/2349077735074?text=Hello%20EduWills%20Support%2C%20I%20need%20help%20with%20my%20account.';

export default function ContactSupport({ box = false }: { box?: boolean }) {
  const content = (
    <>
      <MessageCircle size={22} strokeWidth={2.5} />
      <span>Contact Support</span>
    </>
  );

  return (
    <>
      {box && (
        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
          <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Need help?</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">Chat with EduWills support on WhatsApp. Your phone number is not displayed anywhere on the page.</p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="Contact EduWills support on WhatsApp" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-400">
            {content}
          </a>
        </div>
      )}
      {!box && (
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="Contact EduWills support on WhatsApp" title="Contact Support" className="fixed bottom-24 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-950/40 ring-2 ring-white/10 transition hover:scale-105 hover:bg-emerald-400">
          <MessageCircle size={27} strokeWidth={2.5} />
          <span className="sr-only">Contact Support on WhatsApp</span>
        </a>
      )}
    </>
  );
};
