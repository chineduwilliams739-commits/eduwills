import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: 'AIzaSyBS9zmc9SZolZJqNr4kTwQpWCNv26ECly0',
  authDomain: 'eduwills.firebaseapp.com',
  projectId: 'eduwills',
  storageBucket: 'eduwills.firebasestorage.app',
  messagingSenderId: '247368503313',
  appId: '1:247368503313:web:b09dfef6e8cf1e76e561b0',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Firebase App Check must be initialized in the browser before Firebase AI Logic
// makes a protected request. The reCAPTCHA Enterprise site key is public and is
// supplied at build time by GitHub Actions.
export const appCheckSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || '';

if (typeof window !== 'undefined' && appCheckSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check may already be initialized during client-side module reloads.
    // Firebase will reuse the existing App Check instance.
  }
}

export default app;
