'use client';

import { useEffect } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

const VISITOR_KEY = 'eduwills_visitor_id_v1';
const SOURCE_KEY = 'eduwills_first_source_v2';

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  }
}

function detectSource() {
  try {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('utm_source') || params.get('source') || params.get('ref');
    if (explicit) return explicit.trim().toLowerCase().slice(0, 80);
    const ref = document.referrer;
    if (!ref) return 'direct';
    try {
      const url = new URL(ref);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
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

/** Coarse, browser-derived location only. No IP address or precise GPS location is collected. */
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
    const visitorId = getVisitorId();
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
    const visitorId = getVisitorId();
    const currentSource = detectSource();
    const firstSource = getFirstSource(currentSource);
    const day = new Date().toISOString().slice(0, 10);
    const path = `${window.location.pathname}${window.location.search}`.slice(0, 500);
    const now = new Date().toISOString();
    const location = getCoarseLocation();
    const visitorRef = doc(collection(db, 'siteAnalytics', day, 'visitors'), visitorId);

    const writeVisitor = (userId?: string) => setDoc(visitorRef, {
      visitorId, day, firstSeenAt: now, lastSeenAt: new Date().toISOString(),
      source: firstSource, currentSource, path,
      landingPath: (() => { try { return localStorage.getItem('eduwills_landing_path_v1') || path; } catch { return path; } })(),
      language: location.language, region: location.region, timezone: location.timezone,
      locationMethod: 'browser_locale_timezone',
      ...(userId ? { userId, uid: userId } : {}),
    }, { merge: true }).catch(() => {});

    writeVisitor(auth.currentUser?.uid);
    const unsubscribe = onAuthStateChanged(auth, user => { if (user) writeVisitor(user.uid); });
    try { if (!localStorage.getItem('eduwills_landing_path_v1')) localStorage.setItem('eduwills_landing_path_v1', path); } catch {}
    trackEduWillsEvent('page_view');
    return unsubscribe;
  }, []);
  return null;
}
