import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import * as stable from './quizAiClientStable';

export * from './quizAiClientStable';

function waitForAuthenticatedUser(timeoutMs = 10000) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise<NonNullable<typeof auth.currentUser>>((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      callback();
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error('AUTHENTICATION_REQUIRED')));
    }, timeoutMs);

    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        finish(() => resolve(user));
      }
    }, () => {
      finish(() => reject(new Error('AUTHENTICATION_REQUIRED')));
    });
  });
}

export async function generateQuiz(
  ...args: Parameters<typeof stable.generateQuiz>
) {
  await waitForAuthenticatedUser();
  return stable.generateQuiz(...args);
}
