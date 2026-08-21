import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const must = (ok, msg) => { if (!ok) throw new Error(msg); };

// Dashboard: add the daily education feed inside the existing content wrapper.
let dashboard = read('app/dashboard/page.tsx');
if (!dashboard.includes("import EducationFeed from '@/components/EducationFeed';")) {
  dashboard = dashboard.replace("import { auth, db } from '@/lib/firebase';", "import { auth, db } from '@/lib/firebase';\nimport EducationFeed from '@/components/EducationFeed';");
}
if (!dashboard.includes('<EducationFeed />')) {
  const marker = '  <nav className="fixed bottom-0';
  must(dashboard.includes(marker), 'Dashboard navigation insertion point not found');
  dashboard = dashboard.replace(marker, '  <EducationFeed />\n  <nav className="fixed bottom-0');
}
write('app/dashboard/page.tsx', dashboard);

// Quiz policy: no quiz may be configured below five minutes.
let quiz = read('app/dashboard/quiz/page.tsx');
if (!quiz.includes('const MIN_QUIZ_DURATION_MINUTES = 5;')) {
  quiz = quiz.replace("const PAID_MAX_QUESTIONS = 100;", "const PAID_MAX_QUESTIONS = 100;\nconst MIN_QUIZ_DURATION_MINUTES = 5;");
}
quiz = quiz.replace(/const \[questions,setQuestions\] = useState\([^;]+\);/g, (m) => m);
quiz = quiz.replace(/\[questions, setQuestions\] = useState\(10\), \[duration, setDuration\] = useState\('[^']+'\)/, "[questions, setQuestions] = useState(10), [duration, setDuration] = useState('5')");
quiz = quiz.replace(
  "const minutes = duration === 'none' ? null : Number(duration);",
  "const minutes = Math.max(MIN_QUIZ_DURATION_MINUTES, Number(duration) || MIN_QUIZ_DURATION_MINUTES);"
);
quiz = quiz.replace(
  /options=\[\{value:\"10\",label:\"10 minutes\"\},\{value:\"20\",label:\"20 minutes\"\},\{value:\"30\",label:\"30 minutes\"\},\{value:\"45\",label:\"45 minutes\"\},\{value:\"60\",label:\"60 minutes\"\},\{value:\"none\",label:\"No time limit\"\}\]/g,
  'options={[{value:"5",label:"5 minutes"},{value:"10",label:"10 minutes"},{value:"15",label:"15 minutes"},{value:"20",label:"20 minutes"},{value:"30",label:"30 minutes"},{value:"45",label:"45 minutes"},{value:"60",label:"60 minutes"}]}'
);
quiz = quiz.replace(/min=\"1\"/g, 'min="5"');
quiz = quiz.replace(/min=\{1\}/g, 'min={5}');

// Authoritative Quiz Studio styling. This is intentionally run here, after all
// other quiz edits, so later deployments cannot silently remove the controls.
if (!quiz.includes('function Menu({label,value,options,onChange}')) {
  const marker = "function cleanText(text: string) { return String(text || '').replace(/```[\\s\\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/\\s+/g, ' ').trim(); }";
  must(quiz.includes(marker), 'Quiz page marker not found for Quiz Studio controls');
  const menu = String.raw`
function Menu({label,value,options,onChange}:{label:string;value:string|number;options:{value:string|number;label:string}[];onChange:(v:string|number)=>void}) {
  const [open,setOpen]=useState(false);
  const selected=options.find((o)=>String(o.value)===String(value));
  return <div className="relative">
    <span className="block text-sm font-black text-slate-900">{label}</span>
    <button type="button" onClick={()=>setOpen((v)=>!v)} className="mt-2 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-4 py-3.5 text-left font-bold text-slate-900 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
      <span>{selected?.label || 'Choose…'}</span><ChevronDown size={18} className={'text-slate-400 transition '+(open?'rotate-180':'')}/>
    </button>
    {open && <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
      {options.map((o)=><button key={String(o.value)} type="button" onClick={()=>{onChange(o.value);setOpen(false)}} className={'flex w-full items-center justify-between rounded-xl px-3 py-3 text-left font-bold transition '+(String(value)===String(o.value)?'bg-gradient-to-r from-indigo-50 to-cyan-50 text-eduBlue':'hover:bg-slate-50')}>
        {o.label}{String(value)===String(o.value)&&<Check size={17}/>}</button>)}
    </div>}
  </div>;
}
`;
  quiz = quiz.replace(marker, marker + menu);
}

quiz = quiz.replace(/<label className="mt-4 block text-sm font-black">Save to slot[\s\S]*?<\/label>/, '<Menu label="Save to slot" value={slot} options={slots.map((b,i)=>({value:String(i+1),label:`Slot ${i+1}`})).filter((_,i)=>!slots[i])} onChange={(v)=>setSlot(v ? Number(v) : "")}/>');
quiz = quiz.replace(/<label className="text-sm font-black">Duration[\s\S]*?<\/label>/, '<Menu label="Duration" value={duration} options={[{value:"5",label:"5 minutes"},{value:"10",label:"10 minutes"},{value:"15",label:"15 minutes"},{value:"20",label:"20 minutes"},{value:"30",label:"30 minutes"},{value:"45",label:"45 minutes"},{value:"60",label:"60 minutes"}]} onChange={(v)=>setDuration(String(v))}/>');
quiz = quiz.replace(/<label className="text-sm font-black">Difficulty[\s\S]*?<\/label>/, '<Menu label="Difficulty" value={difficulty} options={[{value:"Easy",label:"Easy"},{value:"Medium",label:"Medium"},{value:"Hard",label:"Hard"},{value:"Mixed",label:"Mixed"}]} onChange={(v)=>setDifficulty(String(v))}/>');

quiz = quiz.replace(/You have \{answers\.filter\(\(x\) => x !== undefined\)\} answered questions\./g, 'You have {answers.filter((x) => x !== undefined).length} answered questions.');

must(quiz.includes('function Menu({label,value,options,onChange}'), 'Quiz Studio Menu was not installed');
must(quiz.includes('{value:"5",label:"5 minutes"}'), 'Five-minute duration option missing');
must(quiz.includes('const MIN_QUIZ_DURATION_MINUTES = 5;'), 'Five-minute minimum constant missing');
must(quiz.includes('Math.max(MIN_QUIZ_DURATION_MINUTES'), 'Five-minute duration enforcement missing');
write('app/dashboard/quiz/page.tsx', quiz);

// Broaden exact-book grounding with conservative, verified anchors for commonly missed Nigerian titles.
let client = read('lib/quizAiClient.ts');
if (!client.includes('BOOK_KNOWLEDGE_PACKS')) {
  const marker = "const CACHE='";
  const i = client.indexOf(marker);
  must(i >= 0, 'Quiz AI cache marker not found');
  const end = client.indexOf('\n', i);
  const packs = `\n\nconst BOOK_KNOWLEDGE_PACKS: Record<string,string> = {\n  'sanya': 'Verified anchor: Sànyà is Oyin Olugbile’s 2022 debut novel, published by Masobe Books. It is a mythological-fantasy retelling inspired by Yoruba mythology, centred on Sànyà, her family, dangerous love, prophecy, extraordinary powers, and a conflict that threatens her family and world. The author’s official site identifies Sànyà as the 2025 Nigeria Prize for Literature winner.',\n  'the lekki headmaster': 'Verified anchor: The Lekki Headmaster by Kabir Alabi Garba is the 2026 JAMB UTME Use-of-English recommended novel. It centres on Mr. Adebepo (Bepo) Adewale, a principal at Stardom Schools in Lekki, Lagos, and examines education, integrity, migration/japa pressures, leadership, and the Nigerian school system. Use the learner’s copy as the authoritative text for fine-grained plot questions.',\n  'scars nigeria s journey and the boko haram conundrum': 'Verified anchor: SCARS: Nigeria’s Journey and the Boko Haram Conundrum is by retired General Leo Irabor. The author describes it as a catalogue of facts informed by his first-hand military command experience addressing terrorism and insurgency in Nigeria’s North-East, examining insecurity, political and social challenges, drivers of extremist activity, peace-building, governance and national reconciliation.'\n};\nfunction knowledgePack(books:QuizBook[]): string {\n  return books.map(b => {\n    const k=norm(b.title);\n    if(k==='sanya') return BOOK_KNOWLEDGE_PACKS.sanya;\n    if(k==='the lekki headmaster') return BOOK_KNOWLEDGE_PACKS['the lekki headmaster'];\n    if(k.includes('scars') && k.includes('boko haram')) return BOOK_KNOWLEDGE_PACKS['scars nigeria s journey and the boko haram conundrum'];\n    return '';\n  }).filter(Boolean).join('\\n');\n}`;
  client = client.slice(0, end) + packs + client.slice(end);
}
client = client.replace(
  "const result=chunks.join('\\n').slice(0,90000)||`Research the exact book ${books.map(b=>`${b.title} by ${b.author}`).join('; ')} and do not invent unsupported facts.`;",
  "const pack=knowledgePack(books);const result=[pack,...chunks].filter(Boolean).join('\\n').slice(0,90000)||`Research the exact book ${books.map(b=>`${b.title} by ${b.author}`).join('; ')} and do not invent unsupported facts.`;"
);
client = client.replace(
  "Research evidence for THIS BOOK ONLY:\\n${research.slice(0,45000)}",
  "Verified knowledge anchors for THIS BOOK:\\n${knowledgePack([book])}\\nResearch evidence for THIS BOOK ONLY:\\n${research.slice(0,45000)}"
);
write('lib/quizAiClient.ts', client);

if (!fs.existsSync('public/education-news.json')) {
  write('public/education-news.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    items: [
      { title: 'JAMB bulletins and current admission updates', link: 'https://www.jamb.gov.ng/bulletins', source: 'JAMB', publishedAt: 'Current official bulletin feed', description: 'Official JAMB bulletins covering admissions, UTME and examination updates.' },
      { title: 'WAEC Nigeria official news and examination updates', link: 'https://www.waecnigeria.org/news', source: 'WAEC Nigeria', publishedAt: 'Current official feed', description: 'Official WAEC Nigeria news, examination notices, selected texts and candidate updates.' },
      { title: 'Federal Ministry of Education — latest education news', link: 'https://education.gov.ng/', source: 'Federal Ministry of Education', publishedAt: 'Current official feed', description: 'National education policy, scholarship, teacher, TVET and sector updates.' },
      { title: 'Nigeria Education Sector Renewal Initiative updates', link: 'https://nesri.education.gov.ng/', source: 'NESRI', publishedAt: 'Current official feed', description: 'Updates on TVET, STEMM, out-of-school children, girl-child education, digitalisation and quality assurance.' },
      { title: 'AI cheating, leaked papers and marking errors: exam protests went global', link: 'https://www.theguardian.com/global-development/2026/aug/16/ai-cheating-leaked-papers-marking-errors-how-exam-protests-went-global', source: 'The Guardian', publishedAt: '16 Aug 2026', description: 'A global look at examination integrity, AI-driven cheating, digital marking and student pressure.' },
      { title: 'Teachers are AI-curious, but worried about screens', link: 'https://www.axios.com/local/columbus/2026/08/19/mcgraw-hill-teacher-study-survey-ohio-ai-schools', source: 'Axios', publishedAt: '19 Aug 2026', description: 'A teacher survey highlights optimism about classroom AI alongside concerns about screen time and student focus.' },
      { title: '2026 Education Data Refresh: global progress and persistent gaps', link: 'https://www.uis.unesco.org/en/news/2026-education-data-refresh', source: 'UNESCO UIS', publishedAt: '2026', description: 'UNESCO education data highlights progress alongside persistent global and regional learning gaps.' },
      { title: 'Schools whose 2026/2027 admission lists have been released', link: 'https://myschoolgist.com/news/admission-list/', source: 'MySchoolGist', publishedAt: '16 Aug 2026', description: 'A running guide to Nigerian university, polytechnic and college admission-list releases.' }
    ]
  }, null, 2));
}

console.log('EDUWILLS education feed, five-minute quiz minimum, broader book grounding, and Quiz Studio customization applied.');
