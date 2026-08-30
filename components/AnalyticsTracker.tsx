'use client';

import { useEffect } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const VISITOR_KEY = 'eduwills_visitor_id_v1';
const SOURCE_KEY = 'eduwills_first_source_v2';
const LANDING_KEY = 'eduwills_landing_path_v1';

export function getEduWillsVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch { return `v_${Math.random().toString(36).slice(2)}_${Date.now()}`; }
}

function detectSource() {
  try {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('utm_source') || params.get('source') || params.get('ref');
    if (explicit) return explicit.trim().toLowerCase().slice(0, 80);
    const ref = document.referrer;
    if (!ref) return 'direct';
    try {
      const host = new URL(ref).hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com') || host === 'chat.openai.com' || host.endsWith('.openai.com')) return 'chatgpt';
      if (host.includes('google.')) return 'google';
      if (host.includes('facebook.')) return 'facebook';
      if (host.includes('instagram.')) return 'instagram';
      if (host.includes('tiktok.')) return 'tiktok';
      if (host.includes('youtube.')) return 'youtube';
      if (host.includes('whatsapp.')) return 'whatsapp';
      return host.slice(0, 80);
    } catch { return 'referral'; }
  } catch { return 'unknown'; }
}

function getFirstSource(currentSource: string) {
  try {
    const existing = localStorage.getItem(SOURCE_KEY);
    if (existing) return existing;
    localStorage.setItem(SOURCE_KEY, currentSource);
    return currentSource;
  } catch { return currentSource; }
}

function getLandingPath(path: string) {
  try {
    const existing = localStorage.getItem(LANDING_KEY);
    if (existing) return existing;
    localStorage.setItem(LANDING_KEY, path);
    return path;
  } catch { return path; }
}

function getCoarseLocation() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    const language = navigator.language || 'unknown';
    let region = '';
    try { region = new Intl.Locale(language).region || ''; } catch {}
    return { region: region || 'unknown', timezone: timezone.slice(0, 80), language: language.slice(0, 35) };
  } catch { return { region: 'unknown', timezone: 'unknown', language: 'unknown' }; }
}

export async function trackEduWillsEvent(event: string, properties: Record<string, unknown> = {}) {
  try {
    const visitorId = getEduWillsVisitorId();
    const day = new Date().toISOString().slice(0, 10);
    const eventId = crypto.randomUUID();
    await setDoc(doc(db, 'siteAnalytics', day, 'events', eventId), {
      event: event.slice(0, 80), eventId, visitorId,
      userId: auth.currentUser?.uid || null,
      firstSource: (() => { try { return localStorage.getItem(SOURCE_KEY) || 'unknown'; } catch { return 'unknown'; } })(),
      path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
      properties, createdAt: new Date().toISOString(),
    });
  } catch {}
}

export default function AnalyticsTracker() {
  useEffect(() => {
    const visitorId = getEduWillsVisitorId();
    const currentSource = detectSource();
    const firstSource = getFirstSource(currentSource);
    const day = new Date().toISOString().slice(0, 10);
    const path = `${window.location.pathname}${window.location.search}`.slice(0, 500);
    const now = new Date().toISOString();
    const location = getCoarseLocation();
    const visitorRef = doc(collection(db, 'siteAnalytics', day, 'visitors'), visitorId);

    const writeVisitor = (userId?: string) => setDoc(visitorRef, {
      visitorId, day, firstSeenAt: now, lastSeenAt: new Date().toISOString(), source: firstSource, firstSource, currentSource, path,
      landingPath: getLandingPath(path), language: location.language, region: location.region, timezone: location.timezone,
      locationMethod: 'browser_locale_timezone', ...(userId ? { userId, uid: userId } : {}),
    }, { merge: true }).catch(() => {});

    writeVisitor(auth.currentUser?.uid);
    const unsubscribe = onAuthStateChanged(auth, user => { if (user) writeVisitor(user.uid); });
    trackEduWillsEvent('page_view');

    const handleConversionClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest('a') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute('href') || '';
      let conversionEvent = '';
      if (href.includes('/signup')) conversionEvent = 'signup_cta_click';
      else if (href.includes('/dashboard/activation')) conversionEvent = 'activation_cta_click';
      else if (href === '#pricing') conversionEvent = 'pricing_cta_click';
      else if (href.includes('/login')) conversionEvent = 'login_cta_click';
      if (!conversionEvent) return;
      trackEduWillsEvent(conversionEvent, { href: href.slice(0, 300), text: (link.textContent || '').trim().slice(0, 120) });
    };

    document.addEventListener('click', handleConversionClick, true);
    return () => { document.removeEventListener('click', handleConversionClick, true); unsubscribe(); };
  }, []);
  return null;
}
