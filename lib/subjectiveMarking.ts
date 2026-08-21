import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BankQuestion } from '@/lib/studentQuestionBank';

export type SubjectiveMark = { score: number; maxScore: number; feedback: string; matchedBy: 'cache'|'ai' };

function norm(v: string) { return String(v || '').toLowerCase().replace(/\s+/g,' ').trim(); }

export async function findCachedMarkingScheme(question: BankQuestion) {
  const key = norm(question.question);
  try {
    const snap = await getDocs(query(collection(db,'subjectiveMarkingCache'), where('questionKey','==',key), limit(1)));
    if (!snap.empty) return snap.docs[0].data() as { scheme: string[]; maxScore: number };
  } catch {}
  return null;
}

export function markFromScheme(answer: string, scheme: string[], maxScore: number): SubjectiveMark {
  const text = norm(answer);
  if (!text) return { score: 0, maxScore, feedback: 'No answer was submitted.', matchedBy: 'cache' };
  const hits = scheme.filter(k => text.includes(norm(k))).length;
  const score = Math.min(maxScore, Math.round((hits / Math.max(1, scheme.length)) * maxScore));
  return { score, maxScore, feedback: score === maxScore ? 'Excellent: the key marking points were covered.' : `You covered ${hits} of ${scheme.length} cached marking points.`, matchedBy: 'cache' };
}
