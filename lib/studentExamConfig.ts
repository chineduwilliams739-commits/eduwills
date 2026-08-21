'use client';

export type StudentLevel = 'primary' | 'jss' | 'sss';
export type ExamType = 'normal' | 'bece' | 'junior-neco' | 'jamb' | 'waec' | 'neco';
export type ExamMode = 'practice' | 'standard';

export const PRIMARY_CLASSES = ['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'] as const;
export const JSS_CLASSES = ['JSS 1','JSS 2','JSS 3'] as const;
export const SSS_CLASSES = ['SS 1','SS 2','SS 3'] as const;

// Core Nigerian school subjects. Admins can extend these without changing the test engine.
export const PRIMARY_SUBJECTS = [
  'English Studies','Mathematics','Basic Science','Basic Technology','Social Studies',
  'Civic Education','Computer Studies','Agricultural Science','Home Economics',
  'Physical and Health Education','Christian Religious Studies','Islamic Religious Studies',
  'Cultural and Creative Arts','French','Yoruba','Igbo','Hausa','Security Education'
];

export const JSS_SUBJECTS = [
  'English Studies','Mathematics','Basic Science','Basic Technology','Social Studies',
  'Civic Education','Computer Studies','Agricultural Science','Business Studies',
  'Home Economics','Physical and Health Education','Christian Religious Studies',
  'Islamic Religious Studies','Cultural and Creative Arts','French','Yoruba','Igbo','Hausa'
];

export const SSS_SUBJECTS = [
  'English Language','Mathematics','Biology','Chemistry','Physics','Agricultural Science',
  'Economics','Government','Geography','Literature in English','Commerce','Accounting',
  'Further Mathematics','Computer Science','Data Processing','Civic Education',
  'Christian Religious Studies','Islamic Religious Studies','French','Yoruba','Igbo','Hausa'
];

export const EXAM_RULES: Record<ExamType, { label: string; level: StudentLevel[]; maxObjective: number; maxSubjective: number; years: boolean; modes: ExamMode[] }> = {
  normal: { label: 'Normal Test', level: ['primary','jss','sss'], maxObjective: 100, maxSubjective: 10, years: false, modes: [] },
  bece: { label: 'BECE', level: ['jss'], maxObjective: 100, maxSubjective: 10, years: true, modes: ['practice','standard'] },
  'junior-neco': { label: 'Junior NECO', level: ['jss'], maxObjective: 100, maxSubjective: 10, years: true, modes: ['practice','standard'] },
  jamb: { label: 'JAMB', level: ['sss'], maxObjective: 50, maxSubjective: 0, years: true, modes: ['practice','standard'] },
  waec: { label: 'WAEC', level: ['sss'], maxObjective: 100, maxSubjective: 10, years: true, modes: ['practice','standard'] },
  neco: { label: 'NECO', level: ['sss'], maxObjective: 100, maxSubjective: 10, years: true, modes: ['practice','standard'] },
};

export function subjectsFor(level: StudentLevel) {
  return level === 'primary' ? PRIMARY_SUBJECTS : level === 'jss' ? JSS_SUBJECTS : SSS_SUBJECTS;
}

export function allowedQuestionCount(level: StudentLevel, active: boolean) {
  return active ? EXAM_RULES.normal.maxObjective : 20;
}
