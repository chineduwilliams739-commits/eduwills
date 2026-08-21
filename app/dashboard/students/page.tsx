'use client';

import { useMemo, useState } from 'react';
import { BookOpenCheck, ChevronRight, Clock3, GraduationCap, Layers3, LockKeyhole, Sparkles, Target, Trophy } from 'lucide-react';
import { EXAM_RULES, PRIMARY_CLASSES, JSS_CLASSES, SSS_CLASSES, subjectsFor, type ExamMode, type ExamType, type StudentLevel } from '@/lib/studentExamConfig';
import { getCachedQuestions, hasEnoughCached } from '@/lib/studentQuestionBank';

const BASE = '/eduwills';
const YEARS = Array.from({length: 15}, (_, i) => new Date().getFullYear() - i);

export default function StudentsPage() {
  const [level, setLevel] = useState<StudentLevel>('jss');
  const [className, setClassName] = useState('JSS 3');
  const [examType, setExamType] = useState<ExamType>('normal');
  const [mode, setMode] = useState<ExamMode>('practice');
  const [subjects, setSubjects] = useState<string[]>(['English Studies']);
  const [topics, setTopics] = useState<string[]>([]);
  const [year, setYear] = useState<number | 'all'>('all');
  const [objective, setObjective] = useState(20);
  const [subjective, setSubjective] = useState(1);
  const [duration, setDuration] = useState(30);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [cached, setCached] = useState<{objectiveAvailable:number;subjectiveAvailable:number}|null>(null);

  const classes = level === 'primary' ? PRIMARY_CLASSES : level === 'jss' ? JSS_CLASSES : SSS_CLASSES;
  const allSubjects = subjectsFor(level);
  const rule = EXAM_RULES[examType];
  const maxObjective = level === 'primary' && examType === 'normal' ? 100 : rule.maxObjective;
  const maxSubjective = examType === 'jamb' ? 0 : 10;

  const availableExams = useMemo(() => (['normal','bece','junior-neco','jamb','waec','neco'] as ExamType[]).filter(x => EXAM_RULES[x].level.includes(level)), [level]);

  function changeLevel(next: StudentLevel) {
    setLevel(next);
    const nextClass = next === 'primary' ? 'Primary 6' : next === 'jss' ? 'JSS 3' : 'SS 3';
    setClassName(nextClass);
    setExamType('normal');
    setSubjects([subjectsFor(next)[0]]);
    setTopics([]); setYear('all');
    setObjective(20); setSubjective(1);
  }

  function toggleSubject(subject: string) {
    setSubjects(v => v.includes(subject) ? v.filter(x => x !== subject) : v.length >= 10 ? v : [...v, subject]);
  }

  function selectExam(next: ExamType) {
    setExamType(next);
    if (next === 'jamb') { setObjective(50); setSubjective(0); setDuration(180); setMode('standard'); }
    else { setObjective(Math.min(20, EXAM_RULES[next].maxObjective)); setSubjective(next === 'normal' ? 1 : Math.min(2, maxSubjective)); setDuration(next === 'normal' ? 30 : 120); }
  }

  async function checkCache() {
    setBusy(true); setStatus('Checking EDUWILLS cached question bank first — AI is not called at this stage.');
    try {
      const bank = await getCachedQuestions({ level, className, subjects, examType, year, topics, objective, subjective });
      setCached({ objectiveAvailable: bank.objectiveAvailable, subjectiveAvailable: bank.subjectiveAvailable });
      if (hasEnoughCached(bank, objective, subjective)) setStatus(`Ready offline: ${bank.objectiveAvailable} objective and ${bank.subjectiveAvailable} subjective questions are already cached for this selection.`);
      else setStatus(`Cache found ${bank.objectiveAvailable} objective + ${bank.subjectiveAvailable} subjective questions. The remaining bank must be prepared before this test is offered; EDUWILLS will not waste AI quota regenerating questions already cached.`);
    } catch { setStatus('The cache could not be checked right now. No AI generation was started.'); }
    finally { setBusy(false); }
  }

  function start() {
    if (!subjects.length) { setStatus('Select at least one subject.'); return; }
    if (topics.length > 0 && topics.length > 10) { setStatus('A maximum of 10 subjects/topics may be selected.'); return; }
    const params = new URLSearchParams({ level, className, examType, mode, subjects: subjects.join(','), year: String(year), objective: String(objective), subjective: String(subjective), duration: String(duration), topics: topics.join(',') });
    window.location.href = `${BASE}/dashboard/students/test/?${params.toString()}`;
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-10">
    <div className="mx-auto max-w-7xl">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><a href={`${BASE}/dashboard/`} className="text-sm font-black text-cyan-300 hover:text-cyan-200">← Dashboard</a><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">EDUWILLS Student Academy</h1><p className="mt-1 max-w-3xl text-sm text-slate-400">Primary, Junior Secondary and Senior Secondary learning built around Nigerian curriculum and examination patterns.</p></div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs font-bold text-cyan-200"><Sparkles size={15} className="mr-2 inline"/>Cache-first learning engine</div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {([['primary','Primary School','Foundation & primary subjects'],['jss','Junior Secondary','BECE & Junior NECO'],['sss','Senior Secondary','JAMB, WAEC & NECO']] as const).map(([id,label,desc]) => <button key={id} onClick={() => changeLevel(id)} className={`rounded-3xl border p-5 text-left transition ${level === id ? 'border-cyan-300/60 bg-cyan-300/10 shadow-lg shadow-cyan-950/30' : 'border-white/10 bg-white/[.03] hover:bg-white/[.06]'}`}><GraduationCap className="mb-4 text-cyan-300"/><p className="text-lg font-black">{label}</p><p className="mt-1 text-sm text-slate-400">{desc}</p></button>)}
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[.035] p-5 shadow-2xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Exam builder</p><h2 className="mt-1 text-2xl font-black">Build a test for {className}</h2></div><div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300"><Layers3 size={15}/> Up to 10 subjects</div></div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Class</span><select value={className} onChange={e=>setClassName(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-bold outline-none">{classes.map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="block"><span className="text-xs font-black uppercase tracking-wider text-slate-400">Assessment</span><select value={examType} onChange={e=>selectExam(e.target.value as ExamType)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 font-bold outline-none">{availableExams.map(x=><option key={x} value={x}>{EXAM_RULES[x].label}</option>)}</select></label>
        </div>

        {examType !== 'normal' && <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">Past-question mode uses the selected examination family. The default year is <b>All years</b>; choosing a year narrows the bank to that year.</div>}

        {rule.modes.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3">{rule.modes.map(m=><button key={m} onClick={()=>setMode(m)} className={`rounded-2xl border px-4 py-3 text-sm font-black ${mode===m?'border-cyan-300/50 bg-cyan-300/10 text-cyan-200':'border-white/10 bg-slate-900 text-slate-300'}`}>{m==='practice'?'Practice mode':'Standard mode'}</button>)}</div>}

        <div className="mt-6"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Subjects</p><span className="text-xs font-bold text-slate-500">{subjects.length}/10</span></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{allSubjects.map(s=><button key={s} onClick={()=>toggleSubject(s)} className={`rounded-xl border px-3 py-3 text-left text-xs font-black transition ${subjects.includes(s)?'border-cyan-300/50 bg-cyan-300/10 text-cyan-100':'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{subjects.includes(s)?'✓ ':''}{s}</button>)}</div></div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rule.years && <label><span className="text-xs font-black uppercase tracking-wider text-slate-400">Past-question year</span><select value={String(year)} onChange={e=>setYear(e.target.value==='all'?'all':Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 font-bold"><option value="all">All years</option>{YEARS.map(y=><option key={y}>{y}</option>)}</select></label>}
          <label><span className="text-xs font-black uppercase tracking-wider text-slate-400">Objective</span><input type="number" min={1} max={maxObjective} value={objective} onChange={e=>setObjective(Math.max(1,Math.min(maxObjective,Number(e.target.value)||1)))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 font-bold"/><small className="mt-1 block text-slate-500">Maximum {maxObjective}</small></label>
          {examType !== 'jamb' && <label><span className="text-xs font-black uppercase tracking-wider text-slate-400">Subjective / theory</span><input type="number" min={0} max={maxSubjective} value={subjective} onChange={e=>setSubjective(Math.max(0,Math.min(maxSubjective,Number(e.target.value)||0)))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 font-bold"/><small className="mt-1 block text-slate-500">Maximum {maxSubjective}</small></label>}
          <label><span className="text-xs font-black uppercase tracking-wider text-slate-400">Time (minutes)</span><input type="number" min={5} value={duration} onChange={e=>setDuration(Math.max(5,Number(e.target.value)||5))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 font-bold"/><small className="mt-1 block text-slate-500">Minimum 5 minutes</small></label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3"><button onClick={checkCache} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-black text-cyan-100 disabled:opacity-50"><BookOpenCheck size={17}/>{busy?'Checking cache…':'Check cached questions'}</button><button onClick={start} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-3 text-sm font-black text-slate-950 shadow-lg"><Target size={17}/>Take test<ChevronRight size={17}/></button></div>
        {cached && <p className="mt-4 text-xs font-bold text-slate-400">Cached now: {cached.objectiveAvailable} objective · {cached.subjectiveAvailable} subjective.</p>}
        {status && <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm font-semibold text-slate-300">{status}</div>}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3"><Info icon={<Clock3/>} title="Standard exam timing" text="Exam modes can enforce their configured duration; normal tests use the student's chosen time, never below 5 minutes."/><Info icon={<LockKeyhole/>} title="Quota protection" text="The test engine checks the saved bank before any AI generation. Cached questions are reused instead of regenerated."/><Info icon={<Trophy/>} title="Academic records" text="Scores, attempts, progress, badges and subject performance are designed to feed the Records dashboard."/></section>
    </div>
  </main>;
}
function Info({icon,title,text}:{icon:React.ReactNode;title:string;text:string}) { return <div className="rounded-3xl border border-white/10 bg-white/[.03] p-5"><div className="mb-3 text-cyan-300">{icon}</div><h3 className="font-black">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{text}</p></div>; }
