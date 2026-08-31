export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-6 text-center text-ink">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-xl font-black text-white">E</div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-eduBlue">EDUWILLS offline mode</p>
        <h1 className="mt-2 text-2xl font-black">You’re temporarily offline.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Previously opened EDUWILLS pages and saved account data may still be available. Reconnect to sync new information and use network-dependent services.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 w-full rounded-xl bg-ink px-5 py-3.5 text-sm font-black text-white">Try again</button>
      </section>
    </main>
  );
}
