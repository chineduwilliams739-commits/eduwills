'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, KeyRound, WalletCards, MessageCircle, ExternalLink } from 'lucide-react';

const account = { number: '8129002773', bank: 'Palmpay', holder: 'Helen Umunnakwe' };
const whatsappNumber = '2349077735074';

export default function ActivationPage() {
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState('');
  const copy = async () => { await navigator.clipboard?.writeText(account.number); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const openWhatsApp = () => {
    const text = `Hello EDUWILLS Admin. I want to activate my account. My username is: ${username || '[ENTER USERNAME]'}. I have made my activation payment and will send my payment receipt/proof here. I confirm that I have a working WhatsApp account.`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };
  return (
    <main className="min-h-screen bg-paper px-5 py-6 sm:px-8"><div className="mx-auto max-w-6xl"><a href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Back to dashboard</a>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_390px]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft sm:p-9"><div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-eduBlue"><WalletCards size={14}/> Activation</div><h1 className="mt-5 text-3xl font-black tracking-tight text-ink">Activate your EDUWILLS account</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Registration is free. To unlock Quiz and History, complete the activation payment, then contact the EDUWILLS admin on WhatsApp with your receipt.</p>
          <div className="mt-8 rounded-3xl bg-ink p-6 text-white"><div className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">Payment account</div><div className="mt-5 space-y-4"><div><div className="text-xs text-slate-400">Account holder</div><div className="font-black">{account.holder}</div></div><div><div className="text-xs text-slate-400">Bank</div><div className="font-black">{account.bank}</div></div><div className="flex items-end justify-between gap-4"><div><div className="text-xs text-slate-400">Account number</div><div className="text-2xl font-black tracking-wider">{account.number}</div></div><button onClick={copy} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">{copied ? 'Copied' : <span className="inline-flex items-center gap-1"><Copy size={13}/> Copy</span>}</button></div></div></div>
          <div className="mt-6 rounded-3xl border border-slate-200 p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-eduBlue"><MessageCircle size={18}/></div><div><h2 className="font-black">Submit your payment proof on WhatsApp</h2><p className="text-xs text-slate-500">Your receipt will be sent directly to the admin.</p></div></div>
            <div className="mt-5 rounded-2xl bg-amber-50 p-5"><div className="text-sm font-black text-amber-900">Before opening WhatsApp</div><ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-5 text-amber-900/80"><li>Copy your EDUWILLS username below exactly as it appears on your account.</li><li>Make your activation payment to the account displayed above.</li><li>Keep a clear screenshot/photo of the payment receipt showing the transaction details.</li><li>Open WhatsApp and send your username, payment receipt, amount paid, date/time of payment and the phone number used on EDUWILLS.</li><li>Wait for the admin to verify your payment and give you a WilliToken.</li></ol></div>
            <label className="mt-5 block text-sm font-bold text-ink">Your EDUWILLS username<input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 outline-none focus:border-eduBlue" placeholder="e.g. ginika123"/><span className="mt-1 block text-xs font-normal text-slate-400">Copy this username before opening WhatsApp.</span></label>
            <button onClick={() => navigator.clipboard?.writeText(username)} disabled={!username} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-ink disabled:opacity-40"><Copy size={16}/> Copy username</button>
            <button onClick={openWhatsApp} disabled={!username} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><MessageCircle size={18}/> Continue to WhatsApp</button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-400">WhatsApp: +234 907 773 5074. EDUWILLS will pre-fill your username and submission instructions.</p>
          </div>
        </section>
        <aside className="space-y-6"><div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-soft"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><KeyRound size={22}/></div><h2 className="mt-5 text-xl font-black">Have a WilliToken?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Enter the token supplied by EDUWILLS admin to activate your account for the duration assigned to it.</p><input className="mt-5 w-full rounded-xl border border-slate-200 bg-paper px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-eduBlue" placeholder="AB12CD34EF"/><button className="mt-3 w-full rounded-xl bg-ink px-5 py-3.5 font-black text-white">Activate with WilliToken</button><div className="mt-4 flex gap-2 text-xs leading-5 text-slate-400"><CheckCircle2 size={15} className="mt-0.5 shrink-0"/> Tokens are generated by EDUWILLS admin and expire according to their assigned duration.</div></div>
        <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-7"><div className="flex items-center gap-2 text-sm font-black text-emerald-800"><MessageCircle size={18}/> WhatsApp verification</div><p className="mt-3 text-sm leading-6 text-emerald-900/70">A working WhatsApp account is required for activation. Your receipt is sent to the admin through WhatsApp for manual verification.</p><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-emerald-800 shadow-sm">WhatsApp +234 907 773 5074 <ExternalLink size={14}/></a></div></aside>
      </div></div>
    </main>
  );
}
