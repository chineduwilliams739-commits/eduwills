import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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
export const storage = getStorage(app);

let firestore: ReturnType<typeof getFirestore>;
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  firestore = getFirestore(app);
}
export const db = firestore;

export const appCheckSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || '';

if (typeof window !== 'undefined' && appCheckSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {}
}

export default app;
