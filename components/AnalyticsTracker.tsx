'use client';

import { useEffect } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const VISITOR_KEY = 'eduwills_visitor_id_v1';
const SOURCE_KEY = 'eduwills_first_source_v1';

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

function getSource() {
  try {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('utm_source') || params.get('source');
    const ref = document.referrer;
    if (explicit) return explicit.slice(0, 80);
    if (!ref) return 'direct';
    try {
      const host = new URL(ref).hostname.replace(/^www\./, '');
      if (host.includes('chatgpt')) return 'chatgpt';
      if (host.includes('google')) return 'google';
      if (host.includes('facebook')) return 'facebook';
      if (host.includes('instagram')) return 'instagram';
      if (host.includes('tiktok')) return 'tiktok';
      if (host.includes('youtube')) return 'youtube';
      if (host.includes('whatsapp')) return 'whatsapp';
      return host.slice(0, 80);
    } catch { return 'referral'; }
  } catch { return 'unknown'; }
}

export default function AnalyticsTracker() {
  useEffect(() => {
    const visitorId = getVisitorId();
    const source = getSource();
    const day = new Date().toISOString().slice(0, 10);
    const path = `${window.location.pathname}${window.location.search}`.slice(0, 500);
    const now = new Date().toISOString();

    try { localStorage.setItem(SOURCE_KEY, source); } catch {}

    // One document per visitor per day gives the admin a true unique-visitor count
    // without collecting IP addresses or other sensitive identifiers.
    const ref = doc(collection(db, 'siteAnalytics', day, 'visitors'), visitorId);
    setDoc(ref, {
      visitorId,
      day,
      firstSeenAt: now,
      lastSeenAt: now,
      source,
      path,
      userAgent: navigator.userAgent.slice(0, 300),
      language: navigator.language || 'unknown',
    }, { merge: true }).catch(() => {});
  }, []);

  return null;
}
