import fs from 'node:fs';
const path='lib/quizAiClient.ts';
let s=fs.readFileSync(path,'utf8');
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};

s=s.replace(/const CACHE\s*=\s*'[^']+';/,"const CACHE='v23-runtime-recovery-cache-first';");

const ws=s.indexOf('async function worker(');
const we=s.indexOf('\nasync function geminiFallback',ws);
must(ws>=0&&we>ws,'worker block not found');
s=s.slice(0,ws)+`async function worker(prompt:string,timeout=45000,mode:'quiz'|'chat'='quiz'){
  const url=await workerUrl();const u=auth.currentUser;
  if(!url)throw Error('AI_GATEWAY_NOT_CONFIGURED');if(!u)throw Error('AUTHENTICATION_REQUIRED');
  const token=await u.getIdToken();const c=new AbortController();const timer=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{method:'POST',headers:{Authorization:\`Bearer \${token}\`,'Content-Type':'application/json'},body:JSON.stringify({mode,prompt}),signal:c.signal});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d?.error||d?.message||\`AI_GATEWAY_\${r.status}\`);
    const text=d?.text??d?.response?.text??d?.response??d?.output??d?.content??d?.result?.text??d?.result?.response??d?.choices?.[0]?.message?.content??'';
    if(!String(text).trim())throw Error('AI_GATEWAY_EMPTY_RESPONSE');
    return String(text);
  }catch(e){if(e?.name==='AbortError')throw Error('AI_GATEWAY_TIMEOUT');throw e}finally{clearTimeout(timer)}
}`+s.slice(we);

const gs=s.indexOf('async function geminiFallback');
const ge=s.indexOf('\nfunction parse',gs);
must(gs>=0&&ge>gs,'gemini fallback block not found');
s=s.slice(0,gs)+`async function geminiFallback(prompt:string){let timer:any;try{return await Promise.race([gemini.generateContent(prompt),new Promise((_,rej)=>timer=setTimeout(()=>rej(Error('GEMINI_TIMEOUT')),45000))]) as any}finally{clearTimeout(timer)}}`+s.slice(ge);

s=s.replace(/chunks\.join\('\\n'\)\.slice\(0,90000\)/g,"chunks.join('\\n').slice(0,18000)");
s=s.replace(/research\.slice\(0,45000\)/g,'research.slice(0,14000)');

const start=s.indexOf('async function generateForBook(');
const end=s.indexOf('\nexport async function generateQuiz',start);
must(start>=0&&end>start,'generateForBook block not found');
const fn=`async function generateForBook(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string):Promise<QuizQuestion[]>{
  const requested=Math.max(0,Math.min(100,count));if(!requested)return[];
  const key=await bookCacheKey(book,difficulty,instructions);const cached=await readSharedCache(key,recent);
  const accepted:QuizQuestion[]=[];const seen=new Set(recent.map(fingerprint));
  for(const q of cached){const k=fingerprint(String(q.question||''));if(k&&!seen.has(k)&&valid(q)){accepted.push(q);seen.add(k)}if(accepted.length>=requested)break}
  if(accepted.length>=requested)return accepted.slice(0,requested);
  if(await quotaUsed()>=5)throw Error('AI_QUOTA_EXHAUSTED');
  let attempts=0,lastError:any=null;
  while(accepted.length<requested&&attempts<8){
    attempts++;const remaining=requested-accepted.length;const batch=Math.min(6,remaining);
    const prompt=buildPrompt(book,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],research)+\`\\nReturn exactly \${batch} new questions as valid JSON. No markdown or commentary.\`;
    let questions:QuizQuestion[]=[];
    try{questions=parse(await worker(prompt,45000,'quiz'))}catch(e){lastError=e;try{const r=await geminiFallback(prompt);questions=parse(r.response.text())}catch(e2){lastError=e2}}
    let added=0;
    for(const q of questions){const k=fingerprint(q.question);if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;accepted.push(q);seen.add(k);added++;if(accepted.length>=requested)break}
    if(added>0)await writeSharedCache(key,accepted);
    if(accepted.length>=requested)break;
    if(added===0){
      const recovery=\`Generate exactly \${batch} NEW factual multiple-choice questions about the exact book "\${book.title}" by "\${book.author}". Use only supported book facts. Four options, one correct answer. Return ONLY {"questions":[...]} JSON. No markdown. Avoid duplicates.\`;
      try{questions=parse(await worker(recovery,45000,'quiz'))}catch(e){lastError=e;try{const r=await geminiFallback(recovery);questions=parse(r.response.text())}catch(e2){lastError=e2}}
      let n=0;for(const q of questions){const k=fingerprint(q.question);if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;accepted.push(q);seen.add(k);n++;if(accepted.length>=requested)break}if(n>0)await writeSharedCache(key,accepted);if(n===0)break;
    }
  }
  if(accepted.length<requested){const detail=lastError?.message?String(lastError.message):\`verified questions available: \${accepted.length}/\${requested}\`;throw Error(\`AI_GENERATION_FAILED:\${detail}\`)}
  await recordQuota();await writeSharedCache(key,accepted);return accepted.slice(0,requested);
}`;
s=s.slice(0,start)+fn+s.slice(end);

must(s.includes('AI_GATEWAY_EMPTY_RESPONSE'),'Gateway response recovery missing');
must(s.includes('AI_GATEWAY_TIMEOUT'),'Gateway timeout recovery missing');
must(s.includes('Math.min(6,remaining)'),'Small resilient batches missing');
must(s.includes('writeSharedCache(key,accepted)'),'Partial cache persistence missing');
must(s.includes('AI_GENERATION_FAILED:'),'Useful generation error missing');
fs.writeFileSync(path,s);console.log('Quiz generation runtime v6 applied.');
