'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Bot,Send,Sparkles,UserRound,RotateCcw,BookOpen,LockKeyhole} from 'lucide-react';
import {onAuthStateChanged} from 'firebase/auth';
import {collection,doc,getDocs,getDoc,query,setDoc,updateDoc,where,deleteDoc} from 'firebase/firestore';
import {auth,db} from '../../../lib/firebase';
import {askEduwills} from '../../../lib/quizAiClient';
const BASE='/eduwills';
const DAILY_AI_QUESTIONS=10;
const THINKING_MESSAGES=['Reading your question…','Checking the learning context…','Thinking through the answer…','Building a clear explanation…','Double-checking the important details…','Almost ready — polishing the answer…'];
function expiryMs(v:any){if(!v)return 0;if(typeof v.toMillis==='function')return v.toMillis();if(v.seconds)return Number(v.seconds)*1000;const n=Date.parse(String(v));return Number.isFinite(n)?n:0;}
function activeFromRecord(d:any){
 const now=Date.now();
 const expires=expiryMs(d.activationExpiresAt);
 const explicitActive=d.activationStatus==='active'||d.williTokenActive===true||d.activationActive===true||d.isActive===true;
 if(explicitActive&&(!expires||expires>now))return true;
 if(d.activated===true&&(!expires||expires>now))return true;
 const lists=[d.activeWilliTokens,d.activeTokens,d.activations,d.williTokens];
 for(const list of lists){if(!Array.isArray(list))continue;for(const item of list){
   if(!item||item.active===false||item.revoked===true||item.cancelled===true)continue;
   const e=expiryMs(item.expiresAt||item.activationExpiresAt||item.expiry);
   if(e>now)return true;
 }}
 return false;
}
async function reconcileActivation(uid:string,d:any){
 const now=Date.now();
 const direct=activeFromRecord(d);
 if(d.activationExpiresAt && expiryMs(d.activationExpiresAt)<=now){
   await updateDoc(doc(db,'users',uid),{activated:false,activationStatus:'inactive',activationActive:false,williTokenActive:false,activationExpiresAt:null,activeWilliToken:null}).catch(()=>undefined);
   return false;
 }
 try{
   const snap=await getDocs(query(collection(db,'williTokens'),where('userId','==',uid)));
   let active=false;
   let latestExpiry=0;
   for(const item of snap.docs){
     const x=item.data()||{};
     const exp=expiryMs(x.expiresAt||x.activationExpiresAt||x.expiry);
     if(exp>now&&x.active!==false){active=true;if(exp>latestExpiry)latestExpiry=exp;}
     else if(exp&&exp<=now) await deleteDoc(item.ref).catch(()=>undefined);
   }
   if(active&&!direct){
     await updateDoc(doc(db,'users',uid),{activated:true,activationStatus:'active',activationActive:true,williTokenActive:true,activationExpiresAt:new Date(latestExpiry).toISOString(),activeWilliToken:snap.docs.find(item=>{const x=item.data()||{};return expiryMs(x.expiresAt||x.activationExpiresAt||x.expiry)===latestExpiry})?.id||null}).catch(()=>undefined);
   }
   return direct||active;
 }catch{return direct;}
}
type Msg={role:'ai'|'user';text:string};
const welcome='Hello! I’m EDUWILLS AI. Ask me about a book, character, theme, vocabulary, difficult passage, or study strategy.';
const dayKey=()=>new Date().toISOString().slice(0,10);
export default function AIPage(){const [active,setActive]=useState(false),[loading,setLoading]=useState(true),[input,setInput]=useState(''),[sending,setSending]=useState(false),[used,setUsed]=useState(0),[thinking,setThinking]=useState(THINKING_MESSAGES[0]),[messages,setMessages]=useState<Msg[]>([{role:'ai',text:welcome}]);const end=useRef<HTMLDivElement>(null);
 useEffect(()=>onAuthStateChanged(auth,async u=>{if(!u){window.location.replace(`${BASE}/login/`);return;}try{const s=await getDoc(doc(db,'users',u.uid));if(!s.exists()){window.location.replace(`${BASE}/login/`);return;}const d=s.data()||{};const isActive=await reconcileActivation(u.uid,d);setActive(isActive);console.info('EDUWILLS AI activation check',{uid:u.uid,activated:d.activated,activationStatus:d.activationStatus,activationActive:d.activationActive,williTokenActive:d.williTokenActive,activationExpiresAt:d.activationExpiresAt,isActive});const q=await getDoc(doc(db,'learnerAiQuota',`${u.uid}_${dayKey()}`));setUsed(q.exists()?Number(q.data().asked||0):0);}catch(e){console.error('EDUWILLS AI activation check failed',e);setActive(false)}finally{setLoading(false)}}),[]);
 useEffect(()=>end.current?.scrollIntoView({behavior:'smooth'}),[messages,sending]);
 useEffect(()=>{if(!sending)return;let i=0;setThinking(THINKING_MESSAGES[0]);const t=setInterval(()=>{i=(i+1)%THINKING_MESSAGES.length;setThinking(THINKING_MESSAGES[i])},2200);return()=>clearInterval(t)},[sending]);
 async function send(){const text=input.trim();if(!text||sending)return;if(used>=DAILY_AI_QUESTIONS)return;const u=auth.currentUser;if(!u)return;setInput('');setMessages(m=>[...m,{role:'user',text}]);setSending(true);try{const history=[...messages,{role:'user' as const,text}].map(m=>`${m.role==='user'?'Learner':'EDUWILLS AI'}: ${m.text}`);const textOut=await askEduwills(text,history);if(!textOut)throw new Error('EMPTY');const ref=doc(db,'learnerAiQuota',`${u.uid}_${dayKey()}`);const snap=await getDoc(ref);const current=snap.exists()?Number(snap.data().asked||0):0;if(current>=DAILY_AI_QUESTIONS)throw new Error('AI_QUOTA_EXHAUSTED');const next=current+1;if(!snap.exists())await setDoc(ref,{uid:u.uid,day:dayKey(),asked:next});else await updateDoc(ref,{asked:next});setUsed(next);setMessages(m=>[...m,{role:'ai',text:textOut}]);}catch(e){console.warn(e);setMessages(m=>[...m,{role:'ai',text:e instanceof Error&&e.message==='AI_QUOTA_EXHAUSTED'?'You have reached today’s EDUWILLS AI limit. Please come back tomorrow.':'I’m temporarily unable to answer that. Please try again shortly.'}]);if(e instanceof Error&&e.message==='AI_QUOTA_EXHAUSTED')setUsed(DAILY_AI_QUESTIONS);}finally{setSending(false)}}
 const reset=()=>setMessages([{role:'ai',text:welcome}]);
 if(loading)return <main className="grid min-h-screen place-items-center bg-paper p-6"><p className="font-bold">Loading EDUWILLS AI…</p></main>;
 if(!active)return <main className="min-h-screen bg-paper px-5 py-8"><div className="mx-auto max-w-3xl"><a href={`${BASE}/dashboard/`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft size={17}/> Dashboard</a><section className="mt-8 overflow-hidden rounded-[2rem] bg-ink text-white shadow-soft"><div className="p-8 sm:p-10"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><LockKeyhole size={25}/></div><p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">EDUWILLS • Book Learner</p><h1 className="mt-2 text-3xl font-black">EDUWILLS AI is locked</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">EDUWILLS AI is available to activated learners with a valid WilliToken. If you already activated your account, your activation status will be read from the same account record and active WilliToken records used by EDUWILLS.</p><a href={`${BASE}/dashboard/`} className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-ink">Back to dashboard</a></div></section></div></main>;
 const remaining=Math.max(0,DAILY_AI_QUESTIONS-used);
 return <main className="min-h-screen bg-paper text-ink"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8"><a href={`${BASE}/dashboard/`} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><BookOpen size={20}/></span><span><span className="block font-black">EDUWILLS</span><span className="block text-[9px] font-bold uppercase tracking-[.18em] text-slate-400">Book Learner</span></span></a><div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:block">Activated</span><button onClick={reset} className="rounded-xl border border-slate-200 p-2" title="New chat"><RotateCcw size={17}/></button></div></div></header><div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col px-4 py-5 sm:px-6"><section className="mb-5 rounded-[2rem] bg-ink p-7 text-white shadow-soft sm:p-9"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-200"><Sparkles size={12}/> Study assistant</div><h1 className="mt-4 text-3xl font-black">Ask EDUWILLS AI.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Get help understanding books, characters, themes, vocabulary and study strategies.</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-center"><div className="text-2xl font-black">{remaining}</div><div className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">questions left today</div></div></div></section><div className="flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft"><div className="min-h-[55vh] flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">{messages.map((m,i)=><div key={i} className={`flex gap-3 ${m.role==='user'?'justify-end':''}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.role==='user'?'bg-slate-100 text-slate-600':'bg-ink text-white'}`}>{m.role==='user'?<UserRound size={17}/>:<Bot size={17}/>}</div><div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${m.role==='user'?'bg-eduBlue text-white':'bg-slate-50 text-slate-700'}`}>{m.text}</div></div>)}{sending&&<div className="flex gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white"><Bot size={17}/></div><div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{thinking}</div></div>}<div ref={end}/></div><div className="border-t border-slate-100 p-3 sm:p-4"><div className="flex items-end gap-2"><textarea value={input} disabled={remaining===0} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} rows={1} className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm outline-none focus:border-eduBlue disabled:opacity-50" placeholder={remaining===0?'Daily AI limit reached. Come back tomorrow.':'Ask EDUWILLS AI…'}/><button onClick={()=>void send()} disabled={!input.trim()||sending||remaining===0} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-eduBlue text-white disabled:opacity-40"><Send size={18}/></button></div><p className="mt-2 text-center text-[10px] text-slate-400">Daily limit: {DAILY_AI_QUESTIONS} questions. AI responses can be inaccurate; verify important information.</p></div></div></div></main>;
}
