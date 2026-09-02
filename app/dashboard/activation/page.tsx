'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, KeyRound, Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const BASE = '/eduwills';
const PAYMENT_CONFIG_URL = `${BASE}/payment-backend.json`;
const PRICES: Record<string, number> = {
  Primary: 2000,
  'Junior Secondary': 3000,
  'Senior Secondary': 3000,
  'Book Learner': 4000,
};
const COUNTRIES = [
  ['NG', 'Nigeria', 'NGN'],
  ['INT', 'Other countries', 'USD'],
] as const;
const CURRENCIES = [
  ['NGN', 'NGN — Nigerian Naira'],
  ['USD', 'USD — US Dollar'],
] as const;
const BENEFITS: Record<string, string[]> = {
  Primary: ['Primary-level practice quizzes', 'Book-based learning support', 'Progress tracking'],
  'Junior Secondary': ['BECE-focused practice', 'Book-based learning support', 'Progress tracking'],
  'Senior Secondary': ['Senior-school practice', 'JAMB-style preparation support', 'Progress tracking'],
  'Book Learner': ['AI-powered book quizzes', 'Author and book discovery', 'Progress tracking'],
};

type Quote = {
  localCurrency: string;
  localAmount: number;
  paymentCurrency: string;
  paymentAmount: number;
  international: boolean;
};

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

function Menu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string, ...string[]])[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option[0] === value);

  return (
    <div className="relative">
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-cyan-400/30 bg-slate-950 px-4 py-3 text-left text-sm font-bold"
      >
        <span>{current?.[1] || value}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-2xl">
            {options.map((option) => (
              <button
                type="button"
                key={option[0]}
                onClick={() => {
                  onChange(option[0]);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-bold hover:bg-white/10"
              >
                <span>{option[1]}</span>
                {option[0] === value && <CheckCircle2 size={16} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ActivationPage() {
  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [country, setCountry] = useState('NG');
  const [currency, setCurrency] = useState('NGN');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<{ code?: string; emailSent: boolean; emailError?: string } | null>(null);

  const getBackend = async () => {
    const response = await fetch(PAYMENT_CONFIG_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('PAYMENT_BACKEND_CONFIG_MISSING');
    const data = await response.json();
    const url = String(data?.baseUrl || '').replace(/\/$/, '');
    if (!url) throw new Error('PAYMENT_BACKEND_CONFIG_MISSING');
    return url;
  };

  const verifyPayment = async (current: any, reference: string) => {
    const jwt = await current.getIdToken(true);
    const backend = await getBackend();
    const response = await fetch(`${backend}/paystack/verify?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${jwt}`, 'X-Firebase-ID-Token': jwt },
      cache: 'no-store',
    });
    const text = await response.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    if (!response.ok) throw new Error(data.error || `Payment verification failed (${response.status}).`);
    return data;
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (current) => {
      if (!current) {
        window.location.replace(`${BASE}/login/`);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, 'users', current.uid));
        const data = snapshot.exists() ? snapshot.data() : {};
        setUser({ ...data, email: current.email || '' });
        if (Array.isArray(data.categories)) {
          setSelected(data.categories.filter((category: string) => Object.hasOwn(PRICES, category)));
        }

        const params = new URLSearchParams(window.location.search);
        const reference = params.get('reference') || params.get('trxref');
        if (reference) {
          setMessage('Confirming your Paystack payment…');
          let result: any = null;
          let lastError: any = null;
          for (let attempt = 0; attempt < 3 && !result; attempt += 1) {
            try {
              result = await verifyPayment(current, reference);
            } catch (error) {
              lastError = error;
              if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1800));
            }
          }
          if (!result) throw lastError || new Error('Payment confirmation failed.');
          setPaymentSuccess({
            code: String(result.code || ''),
            emailSent: result.emailSent === true,
            emailError: result.emailError ? String(result.emailError) : undefined,
          });
          setMessage('');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (error: any) {
        setMessage(error?.message || 'Could not load or confirm your account. Please refresh.');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selected.length) {
        setQuote(null);
        return;
      }
      try {
        const current = auth.currentUser;
        if (!current) {
          setQuote(null);
          return;
        }
        const jwt = await current.getIdToken(true);
        const backend = await getBackend();
        const response = await fetch(`${backend}/paystack/quote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
            'X-Firebase-ID-Token': jwt,
          },
          body: JSON.stringify({ categories: selected, country, currency }),
          cache: 'no-store',
        });
        const text = await response.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch {}
        if (!response.ok) throw new Error(data.error || 'Could not calculate the payment total.');
        if (!cancelled) setQuote(data);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, country, currency]);

  async function pay() {
    if (!selected.length) {
      setMessage('Select at least one learning category.');
      return;
    }
    const current = auth.currentUser;
    if (!current) {
      setMessage('Please sign in again.');
      return;
    }
    try { await current.reload(); } catch {}
    if (!current.email || !current.emailVerified) {
      setMessage('Please verify your email address before paying.');
      return;
    }

    setPaying(true);
    setMessage('');
    try {
      const jwt = await current.getIdToken(true);
      const backend = await getBackend();
      const response = await fetch(`${backend}/paystack/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          'X-Firebase-ID-Token': jwt,
        },
        body: JSON.stringify({
          categories: selected,
          country,
          currency,
          fullName: user?.fullName || '',
          username: user?.username || '',
        }),
      });
      const text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (!response.ok || !data.authorization_url) {
        throw new Error(data.error || `Payment service returned ${response.status}.`);
      }
      window.location.assign(data.authorization_url);
    } catch (error: any) {
      setMessage(
        error?.message === 'Failed to fetch'
          ? 'The secure payment service could not be reached. Please refresh and try again.'
          : error?.message || 'Could not open Paystack checkout.',
      );
    } finally {
      setPaying(false);
    }
  }

  async function redeem() {
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(clean)) {
      setMessage('Enter the 10-character activation code from your email.');
      return;
    }
    const current = auth.currentUser;
    if (!current) {
      setMessage('Please sign in again.');
      return;
    }

    setRedeeming(true);
    setMessage('');
    try {
      const tokenRef = doc(db, 'williTokens', clean);
      const snapshot = await getDoc(tokenRef);
      if (!snapshot.exists()) throw new Error('This WilliToken was not found. If you just paid, wait a moment and check your verified email.');

      const token: any = snapshot.data();
      if (String(token.userId || token.uid || '') !== current.uid) throw new Error('This WilliToken belongs to a different account.');
      if (token.revoked === true || token.cancelled === true) throw new Error('This WilliToken has been revoked.');
      if (token.used === true || token.redeemed === true) throw new Error('This WilliToken has already been redeemed.');

      const expiry = token.expiresAt?.toDate?.() || (
        token.createdAt?.toDate?.() && typeof token.durationMs === 'number'
          ? new Date(token.createdAt.toDate().getTime() + token.durationMs)
          : null
      );
      if (expiry && expiry.getTime() <= Date.now()) throw new Error('This WilliToken has expired.');

      const categories = Array.isArray(token.categories)
        ? token.categories.filter((value: any) => typeof value === 'string' && Object.hasOwn(PRICES, value))
        : [];
      const userRef = doc(db, 'users', current.uid);
      const userSnapshot = await getDoc(userRef);
      const existing: any = userSnapshot.data() || {};
      const merged = [...new Set([
        ...(Array.isArray(existing.categories) ? existing.categories : []),
        ...categories,
      ])];

      await updateDoc(tokenRef, {
        used: true,
        redeemed: true,
        redeemedBy: current.uid,
        redeemedAt: serverTimestamp(),
        active: true,
      });

      const activationExpiry = expiry || new Date(Date.now() + 31536000000);
      await updateDoc(userRef, {
        activated: true,
        activationStatus: 'active',
        williTokenActive: true,
        activationExpiresAt: activationExpiry,
        categories: merged,
        category: merged[0] || existing.category || '',
        educationLevels: merged,
        schoolLevels: merged,
      });
      setCode('');
      setMessage('Activation successful.');
    } catch (error: any) {
      setMessage(
        error?.code === 'permission-denied'
          ? 'Activation was denied by Firebase. Please refresh and try again.'
          : error?.message || 'Activation failed.',
      );
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-white"><Loader2 className="animate-spin" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <a href={`${BASE}/dashboard/`} className="text-sm font-bold text-slate-300">← Back to dashboard</a>
        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl sm:p-9">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><KeyRound /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">EDUWILLS activation</p>
              <h1 className="mt-2 text-3xl font-black">Choose your learning category</h1>
              <p className="mt-2 text-sm text-slate-400">Get one year of access to the learning tools for every category you activate.</p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {Object.keys(PRICES).map((category) => {
              const active = selected.includes(category);
              return (
                <button
                  type="button"
                  key={category}
                  onClick={() => setSelected((previous) => active ? previous.filter((item) => item !== category) : [...previous, category])}
                  className={`rounded-2xl border p-5 text-left ${active ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/10 bg-slate-900/60'}`}
                >
                  <div className="flex items-center justify-between"><span className="font-black">{category}</span>{active && <CheckCircle2 size={20} />}</div>
                  <p className="mt-2 text-sm text-slate-400">Base price: {money(PRICES[category], 'NGN')}</p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">{BENEFITS[category].map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:grid-cols-2">
            <Menu
              label="Country"
              value={country}
              options={COUNTRIES}
              onChange={(value) => {
                setCountry(value);
                setCurrency(COUNTRIES.find((item) => item[0] === value)?.[2] || 'USD');
              }}
            />
            <Menu label="Currency" value={currency} options={CURRENCIES} onChange={setCurrency} />
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-5">
            <div className="flex justify-between gap-4 text-sm"><span className="text-slate-400">Selected categories</span><span className="text-right font-bold">{selected.length ? selected.join(', ') : 'None'}</span></div>
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3"><span className="text-slate-400">Total</span><span className="font-black">{selected.length ? (quote ? money(quote.localAmount, quote.localCurrency) : 'Calculating…') : '—'}</span></div>
            {quote && quote.international && <p className="mt-2 text-xs text-slate-500">Paystack checkout currency: {quote.paymentCurrency} ({money(quote.paymentAmount, quote.paymentCurrency)}).</p>}
          </div>

          <button type="button" onClick={pay} disabled={paying || !selected.length || !quote} className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 px-5 py-4 font-black text-slate-950 disabled:opacity-50">
            {paying ? 'Opening Paystack…' : 'Continue to secure Paystack payment'}
          </button>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4 text-xs text-slate-400"><ShieldCheck size={18} /><span><strong className="text-slate-200">Secure checkout.</strong> Payment is handled by Paystack.</span></div>
            <div className="flex gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-400"><Mail size={18} /><span><strong className="text-slate-200">Activation by email.</strong> Your WilliToken is sent to your verified email after successful payment.</span></div>
          </div>

          {user?.email && <div className="mt-3 flex gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-400"><Mail size={18} /><span>Verified account email: <strong className="text-white">{user.email}</strong></span></div>}

          <div className="mt-7 border-t border-white/10 pt-7">
            <h2 className="text-xl font-black">Already received your activation code?</h2>
            <p className="mt-2 text-sm text-slate-400">Enter the code from your email to activate your account.</p>
            <div className="mt-4 flex gap-2">
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} maxLength={10} placeholder="AB12CD34EF" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-mono tracking-widest outline-none" />
              <button type="button" onClick={redeem} disabled={redeeming} className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{redeeming ? 'Activating…' : 'Activate'}</button>
            </div>
          </div>

          {message && <p className="mt-5 rounded-xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-200">{message}</p>}
        </section>
      </div>

      {paymentSuccess && (
        <div className="fixed inset-0 z-[220] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-[2rem] border border-emerald-400/30 bg-slate-900 p-7 text-white shadow-2xl">
            <button aria-label="Close" onClick={() => setPaymentSuccess(null)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white/10"><X size={20} /></button>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><CheckCircle2 size={46} /></div>
            <p className="mt-5 text-center text-xs font-black uppercase tracking-[.25em] text-emerald-300">Payment confirmed</p>
            <h2 className="mt-2 text-center text-3xl font-black">🎉 Congratulations!</h2>
            <p className="mt-3 text-center text-slate-300">Your activation payment was successful.</p>
            <div className="mt-6 rounded-2xl bg-slate-950 p-5">
              <p className="text-xs font-black uppercase text-slate-500">What to do next</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>✓ Check your verified email for your WilliToken.</li>
                <li>✓ Enter the 10-character WilliToken below to activate your account.</li>
                {paymentSuccess.code && <li>✓ Payment reference: <span className="font-mono">{paymentSuccess.code}</span></li>}
              </ul>
              {!paymentSuccess.emailSent && <p className="mt-4 text-xs text-amber-300">Your payment was confirmed, but the activation email could not be confirmed as sent. Please check your email or contact support.</p>}
              {paymentSuccess.emailError && <p className="mt-2 text-xs text-slate-400">{paymentSuccess.emailError}</p>}
            </div>
            <button type="button" onClick={() => setPaymentSuccess(null)} className="mt-6 w-full rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950">Continue</button>
          </div>
        </div>
      )}
    </main>
  );
}
