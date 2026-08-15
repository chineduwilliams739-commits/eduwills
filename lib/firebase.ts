import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export default app;
