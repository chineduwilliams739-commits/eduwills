import fs from 'node:fs';

const path='app/dashboard/quiz/page.tsx';
let p=fs.readFileSync(path,'utf8');

// Unactivated learners are allowed into Quiz Studio. They are capped at 20
// questions and five successful generations per UTC day. Activation is checked
// only when that allowance has been exhausted.
p=p.replace(/const \[active, \[loading\],/g,'const [active, [loading],');

// Ensure the question selector remains 20 for unactivated users and 100 for activated users.
p=p.replace(/max=\{active\?100:20\}/g,'max={active?100:20}');
p=p.replace(/max=\{100\}/g,'max={active?100:20}');
p=p.replace(/Math\.min\(100,Math\.max\(1,Number\(e\.target\.value\)\|\|1\)\)/g,'Math.min(active?100:20,Math.max(1,Number(e.target.value)||1))');

const start=p.indexOf('  async function startQuiz() {');
const gen=p.indexOf('\n  async function generate(current: Setup) {',start);
if(start<0||gen<=start) throw new Error('Final free-quiz repair: startQuiz boundary not found');

const replacement=`  async function startQuiz() {
    if (!selected.length) { setMessage('Choose at least one book before starting.'); return; }
    const day=new Date().toISOString().slice(0,10);
    const freeKey=auth.currentUser ? 'eduwills_free_quizzes_'+auth.currentUser.uid+'_'+day : '';
    const freeUsed=freeKey ? Number(localStorage.getItem(freeKey)||'0') : 0;
    if (!active && freeUsed >= 5) { setMessage('FREE_QUIZ_LIMIT'); return; }
    setStarting(true); setMessage('');
    try {
      const chosen=books.filter((b)=>selected.includes(b.id));
      const maxForAccount=active?100:20;
      const requested=Math.min(maxForAccount,Math.max(1,Number(questions)||10));
      const next: Setup={id:'',books:chosen.map((b)=>({title:b.title,author:b.author})),questions:requested,duration:duration==='none'?null:Number(duration),difficulty,instructions};
      if(active){
        const ref=await addDoc(collection(db,'quizHistory'),{userId:auth.currentUser!.uid,books:next.books,questions:next.questions,duration:next.duration,difficulty,instructions,status:'ready',createdAt:serverTimestamp()});
        next.id=ref.id;
      } else {
        next.id='free-'+Date.now();
      }
      setSetup(next);setIdx(0);setAnswers([]);setDone(false);setQuizError('');setFeedback('');setWhy({});setElapsed(0);setSeconds(next.duration?next.duration*60:null);setQuizLoading(true);await generate(next);
    } catch(e:any) { setMessage(e?.message||'Could not start the quiz. Please try again.'); }
    finally { setStarting(false); }
  }
`;
p=p.slice(0,start)+replacement+p.slice(gen);

// Count only a successfully generated free quiz. Failed generation never consumes an attempt.
p=p.replace(/setQs\(parsed\.slice\(0, current\.questions\)\);/g,
  "setQs(parsed.slice(0,current.questions)); if(!active){const day=new Date().toISOString().slice(0,10);const k='eduwills_free_quizzes_'+auth.currentUser!.uid+'_'+day;localStorage.setItem(k,String(Number(localStorage.getItem(k)||'0')+1));}");
p=p.replace(/setQs\(fallback\(current\)\);/g,'throw new Error(\'AI_UNAVAILABLE\');');

// Never write free quizzes to History. Activated users keep normal history.
p=p.replace(/try \{ await updateDoc\(doc\(db,'quizHistory',setup\.id\), \{ status: 'completed',[\s\S]*?\}\); \} catch \{\}/,
  "try { if(!setup.id.startsWith('free-')) await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',questionsData:qs,answers,score:correct,total:qs.length,percentage,elapsedSeconds:elapsed,completedAt:serverTimestamp()}); } catch {}" );

// Failed free generations must not attempt a Firestore history update.
p=p.replace(/try \{ await updateDoc\(doc\(db,'quizHistory',current\.id\), \{ status: 'failed',[\s\S]*?\}\); \} catch \{\}/g,
  "try { if(!current.id.startsWith('free-')) await updateDoc(doc(db,'quizHistory',current.id),{status:'failed',error:String(e?.message||e)}); } catch {}" );

// Replace the plain activation text with the existing EDUWILLS warning marker.
p=p.replace(/setMessage\('FREE_QUIZ_LIMIT'\);/g,"setMessage('FREE_QUIZ_LIMIT');");

fs.writeFileSync(path,p);
console.log('Final free quiz gate applied: unactivated users can start immediately, 5 successful quizzes/day, 20 questions max, no free-history writes.');
