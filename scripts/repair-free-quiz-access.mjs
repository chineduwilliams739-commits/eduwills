import fs from 'node:fs';

const path='app/dashboard/quiz/page.tsx';
let p=fs.readFileSync(path,'utf8');

// IMPORTANT: being unactivated must not prevent entering Quiz Studio. The free
// allowance is enforced at generation time (5 successful generations/day),
// while unactivated users remain capped at 20 questions per generation.
p=p.replace(/setActive\(d\.activated===true&&expiryMs\(d\.activationExpiresAt\)>Date\.now\(\)\);/g,
  'setActive(d.activated===true&&expiryMs(d.activationExpiresAt)>Date.now());');

const start=p.indexOf('  async function startQuiz() {');
const gen=p.indexOf('\n  async function generate(current: Setup) {',start);
if(start<0||gen<=start) throw new Error('startQuiz/generate boundary not found');

const replacement=`  async function startQuiz() {
    if (!selected.length) { setMessage('Choose at least one book before starting.'); return; }
    if (!active && freeUsed >= 5) { setMessage('FREE QUIZZES USED'); return; }
    setStarting(true); setMessage('');
    try {
      const chosen = books.filter((b) => selected.includes(b.id));
      const maxForAccount = active ? 100 : 20;
      const requested = Math.min(maxForAccount, Math.max(1, Number(questions) || 10));
      const next: Setup = { id: '', books: chosen.map((b) => ({ title: b.title, author: b.author })), questions: requested, duration: duration === 'none' ? null : Number(duration), difficulty, instructions };
      // Activated learners get persistent history. Free learners get an in-memory
      // quiz id so Firestore history rules can never block their five free tries.
      if (active) {
        const ref = await addDoc(collection(db, 'quizHistory'), { userId: auth.currentUser!.uid, books: next.books, questions: next.questions, duration: next.duration, difficulty, instructions, status: 'ready', createdAt: serverTimestamp() });
        next.id = ref.id;
      } else {
        next.id = 'free-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
      }
      setSetup(next); setIdx(0); setAnswers([]); setDone(false); setQuizError(''); setFeedback(''); setWhy({}); setElapsed(0); setSeconds(next.duration ? next.duration * 60 : null); setQuizLoading(true); await generate(next);
    } catch (e:any) { setMessage(e?.message || 'Could not start the quiz. Please try again.'); } finally { setStarting(false); }
  }
`;
p=p.slice(0,start)+replacement+p.slice(gen);

// A failed free quiz must not try to update a non-existent history document.
p=p.replace(/try \{ await updateDoc\(doc\(db,'quizHistory',current\.id\),\{status:'failed',error:String\(e\?\.message\|\|e\)\}\); \} catch \{\}/g,
  "try { if(!current.id.startsWith('free-')) await updateDoc(doc(db,'quizHistory',current.id),{status:'failed',error:String(e?.message||e)}); } catch {}" );

// Completed free quizzes must not be written to history either.
p=p.replace(/try \{ await updateDoc\(doc\(db,'quizHistory',setup\.id\),\{status:'completed',[\s\S]*?completedAt: serverTimestamp\(\)\}\); \} catch \{\}/,
  "try { if(!setup.id.startsWith('free-')) await updateDoc(doc(db,'quizHistory',setup.id),{status:'completed',questionsData:qs,answers,score:correct,total:qs.length,percentage,elapsedSeconds:elapsed,completedAt:serverTimestamp()}); } catch {}" );

// Replace the old non-standard free-limit message with a warning-card marker.
p=p.replace(/setMessage\('FREE QUIZZES USED'\);/, "setMessage('FREE_QUIZ_LIMIT');");

// Keep unactivated selection capped at 20 even if an older UI repair exposed 100.
p=p.replace(/max=\{100\} value=\{questions\} onChange=\{e=>setQuestions\(Math\.min\(100,/g,
  'max={active?100:20} value={questions} onChange={e=>setQuestions(Math.min(active?100:20,' );

fs.writeFileSync(path,p);
console.log('Free Quiz Studio access fixed: unactivated learners can enter, get up to 5 successful generations/day, max 20 questions each, and no history write is attempted for free quizzes.');
