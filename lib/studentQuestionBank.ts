import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ExamType, StudentLevel } from '@/lib/studentExamConfig';

export type BankQuestion = {
  id?: string;
  level: StudentLevel;
  className: string;
  subject: string;
  topic?: string;
  examType: ExamType;
  year?: number | null;
  type: 'objective' | 'subjective';
  question: string;
  options?: string[];
  answer?: number;
  markingScheme?: string[];
  explanation?: string;
  source?: string;
};

export function questionKey(q: Pick<BankQuestion,'level'|'className'|'subject'|'topic'|'examType'|'year'|'type'|'question'>) {
  return [q.level,q.className,q.subject,q.topic || '',q.examType,String(q.year || 'all'),q.type,q.question]
    .map(v => String(v).trim().toLowerCase().replace(/\s+/g,' ')).join('|');
}

export async function getCachedQuestions(params: {
  level: StudentLevel; className: string; subjects: string[]; examType: ExamType;
  year?: number | 'all'; topics?: string[]; objective: number; subjective: number;
}) {
  const result: BankQuestion[] = [];
  const seen = new Set<string>();
  const base = collection(db,'studentQuestionBank');
  for (const subject of params.subjects.slice(0,10)) {
    const constraints = [
      where('level','==',params.level),
      where('className','==',params.className),
      where('subject','==',subject),
      where('examType','==',params.examType),
      limit(Math.max(100, params.objective + params.subjective + 30)),
    ];
    try {
      const snap = await getDocs(query(base,...constraints));
      for (const doc of snap.docs) {
        const q = { id: doc.id, ...doc.data() } as BankQuestion;
        if (params.year !== undefined && params.year !== 'all' && q.year && q.year !== params.year) continue;
        if (params.topics?.length && q.topic && !params.topics.includes(q.topic)) continue;
        const k = questionKey(q); if (seen.has(k)) continue; seen.add(k); result.push(q);
      }
    } catch { /* Missing indexes must never stop the test builder. */ }
  }
  const objectives = result.filter(q => q.type === 'objective').slice(0, params.objective);
  const subjective = result.filter(q => q.type === 'subjective').slice(0, params.subjective);
  return { questions: [...objectives,...subjective], objectiveAvailable: objectives.length, subjectiveAvailable: subjective.length };
}

export function hasEnoughCached(bank: Awaited<ReturnType<typeof getCachedQuestions>>, objective: number, subjective: number) {
  return bank.objectiveAvailable >= objective && bank.subjectiveAvailable >= subjective;
}
