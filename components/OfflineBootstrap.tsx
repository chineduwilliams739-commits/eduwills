'use client';
import { useEffect } from 'react';

export default function OfflineBootstrap() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/eduwills/sw.js', { scope: '/eduwills/' }).catch(error => {
      console.warn('EDUWILLS offline support could not be registered:', error);
    });
  }, []);
  return null;
}
