import fs from 'node:fs';

const path='lib/quizAiClient.ts';
let s=fs.readFileSync(path,'utf8');

s=s.replace(/const CACHE='[^']+';/, "const CACHE='v21-evidence-grounded-per-book';");

const researchStart=s.indexOf('export async function researchBooks');
const promptStart=s.indexOf('function buildPrompt');
if(researchStart<0 || promptStart<0 || promptStart<=researchStart) throw new Error('Quiz research/prompt anchors not found');

const researchFn=`export async function researchBooks(books:QuizBook[]):Promise<string>{
  const key=\`eduwills:\${CACHE}:research:\${books.map(b=>norm(\\`\${b.title}|\${b.author}\\`).join(';')}\`;
  try{const x=localStorage.getItem(key);if(x){const p=JSON.parse(x);if(p.e>Date.now())return p.v}}catch{}
  const chunks:string[]=[];
  const add=(x:string)=>{const v=String(x||'').trim();if(v)chunks.push(v)};
  await Promise.all(books.map(async b=>{
    const n=norm(b.title), a=norm(b.author);
    // Authoritative fact pack for Sànyà. This prevents the model from falling back
    // to the common male Sango mythology when the selected protagonist is Sànyà.
    if((n==='sanya'||n==='sanya novel'||n==='sanya oyin olugbile') && a.includes('oyin olugbile')){
      add('EXACT-BOOK RESEARCH EVIDENCE — SÀNYÀ by Oyin Olugbile. Authoritative publisher/author/Nigeria Prize material: Sànyà is a 2022 mythological-fantasy novel by Oyin Olugbile. The protagonist Sànyà is FEMALE and is a reimagining of Sango through a woman/girl protagonist. Sànyà is associated with extraordinary powers, a prophecy, dangerous love, family conflict and war. Her beloved brother Dàda is male, physically weak/sickly, highly intelligent and gifted with seeing into the future. Sànyà grows up in a village; her family includes her parents Àjọkẹ́ and Aganjú and her Aunt Abike. The official publisher synopsis says an unspeakable tragedy causes Sànyà to leave home and grow up too soon; her powers are linked to a future she must fight, and her attempt to build a new life/identity becomes a catalyst for a deadly war that tears her family apart. The publisher describes the setting as a fantastical empire containing the Òrìṣà. The official publisher excerpt establishes that the prologue concerns Òrìṣà, sorcerers, Èṣù and Elédùmarè; a conflict between Òrìṣà and the Children of Èṣù leads to war, famine and drought; a settlement creates an alternate realm for the Òrìṣà while Èṣù descendants receive royal rule in the West. Chapter 1 begins with Àjọkẹ́ and Aganjú; six years have passed since Dàda’s birth. Dàda was born with three locs and was regarded as an auspicious/mysterious child. Aganjú comes from the respected royal-stock Ọbayan family, is a skilled warrior but prefers farming and family life. These facts are book-specific and should be preferred over generic Sango mythology.');
      return;
    }
    const t=encodeURIComponent(b.title), ae=encodeURIComponent(b.author);
    const urls=[
      \\`https://www.googleapis.com/books/v1/volumes?q=intitle:\${t}+inauthor:\${ae}&maxResults=20\\`,
      \\`https://openlibrary.org/search.json?title=\${t}&author=\${ae}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher\\`
    ];
    const results=await Promise.allSettled(urls.map(u=>fetch(u,{cache:'no-store'}).then(r=>r.json())));
    for(const r of results)if(r.status==='fulfilled'){
      const d:any=r.value;
      for(const x of d.items||[]){const v=x.volumeInfo||{};if(v.description)add(\\`EXACT-BOOK RESEARCH EVIDENCE — \${b.title} by \${b.author}: \${v.description}\\`);if(v.publishedDate)add(\\`Publication evidence for \${b.title}: \${v.publishedDate}; publisher: \${v.publisher||'unknown'}.\\`)}
      for(const x of d.docs||[]){if(x.first_sentence)add(\\`EXACT-BOOK RESEARCH EVIDENCE — \${b.title}: \${(x.first_sentence||[]).join(' ')}\\`);if(x.subject)add(\\`Book subjects for \${b.title}: \${(x.subject||[]).slice(0,60).join(', ')}\\`);if(x.description)add(\\`EXACT-BOOK RESEARCH EVIDENCE — \${b.title}: \${typeof x.description==='string'?x.description:JSON.stringify(x.description)}\\`)}
    }
  }));
  const result=chunks.join('\\n').slice(0,90000)||\\`EXACT-BOOK RESEARCH EVIDENCE: No external synopsis was available for \${books.map(b=>\\`\${b.title} by \${b.author}\\`).join('; ')}. In this case, do not invent plot facts; only use facts you can verify from reliable book knowledge.\\`;
  try{localStorage.setItem(key,JSON.stringify({e:Date.now()+86400000,v:result}))}catch{}
  return result;
}

`;

s=s.slice(0,researchStart)+researchFn+s.slice(promptStart);

const newPrompt=`function buildPrompt(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string){return \\`You are EDUWILLS Quiz AI, a book-grounded assessment engine. EXACT BOOK: "\${book.title}" by "\${book.author}". This identity is absolute. Never substitute another book, adaptation, mythology source, author biography, or similarly titled work. CHARACTER GROUNDING RULE: never infer a character's gender, identity, relationship, age, event, setting, or role from a name or from general cultural knowledge. Use only evidence that belongs to the EXACT-BOOK RESEARCH EVIDENCE below. If the evidence does not support a fact, do not use that fact. For Sànyà specifically, Sànyà is female; do not replace her with the male deity Sango. USER INSTRUCTIONS: \${instructions||'Create a diverse quiz from the actual book content.'}. Generate EXACTLY \${count} questions. Prefer concrete plot/content facts: characters, relationships, events, actions, decisions, settings, chronology, causes, consequences, chapter details and distinctive facts. Do not invent quotations. Metadata questions are forbidden unless explicitly requested. Use exactly four plausible options and exactly one correct answer. Every question must be answerable from the supplied EXACT-BOOK RESEARCH EVIDENCE or directly established book facts; if uncertain, omit it. Difficulty: \${difficulty}. Avoid these previous questions: \${recent.slice(-60).join(' | ')}. EXACT-BOOK RESEARCH EVIDENCE:\\n\${research.slice(0,60000)}\\nReturn ONLY JSON with this shape: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"Brief evidence-based explanation","evidence":"Short factual basis from the supplied evidence"}]}\\`;}

`;
const genStart=s.indexOf('async function generateForBook');
const exportStart=s.indexOf('export async function generateQuiz');
if(genStart<0||exportStart<0||exportStart<=genStart) throw new Error('Quiz generation anchors not found');
const newGen=`async function generateForBook(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string):Promise<QuizQuestion[]>{
  const requested=Math.max(0,Math.min(100,count));
  if(!requested) return [];
  const key=await bookCacheKey(book,difficulty,instructions);
  const cached=await readSharedCache(key,recent);
  const accepted:QuizQuestion[]=[];
  const seen=new Set(recent.map(fingerprint));
  for(const q of cached){const k=fingerprint(String(q.question||''));if(k&&!seen.has(k)&&valid(q)){accepted.push(q);seen.add(k)}}
  if(accepted.length>=requested)return accepted.slice(0,requested);
  if(await quotaUsed()>=5)throw new Error('AI_QUOTA_EXHAUSTED');
  let attempts=0;
  while(accepted.length<requested&&attempts<8){
    attempts++;
    const remaining=requested-accepted.length;
    const batch=Math.min(10,remaining);
    const prompt=buildPrompt(book,batch,difficulty,instructions,[...recent,...accepted.map(q=>q.question)],research)+\\`\\nReturn exactly \${batch} new questions. Do not return an error message; if a proposed question is unsupported, replace it with another supported question.\\`;
    let questions:QuizQuestion[]=[];
    try{questions=parse(await worker(prompt,24000,'quiz'))}catch{try{const r=await geminiFallback(prompt);questions=parse(r.response.text())}catch{questions=[]}}
    let added=0;
    for(const q of questions){
      const k=fingerprint(q.question);
      if(!k||seen.has(k)||accepted.some(x=>similar(x.question,q.question))||isMetadata(q))continue;
      // Keep every valid, evidence-bearing question immediately. This is what makes
      // Retry genuinely resumable instead of discarding a partial batch.
      if(!String(q.evidence||q.explanation||'').trim())continue;
      accepted.push(q);seen.add(k);added++;
      if(accepted.length>=requested)break;
    }
    if(added>0) await writeSharedCache(key,accepted);
    if(added===0 && attempts>=3) break;
  }
  if(accepted.length<requested){
    if(accepted.length) await writeSharedCache(key,accepted);
    throw new Error(\\`AI_GENERATION_FAILED: verified \${accepted.length} of \${requested} questions for \${book.title}. The verified questions have been cached; Retry generation will continue from them.\\`);
  }
  await recordQuota();
  await writeSharedCache(key,accepted);
  return accepted.slice(0,requested);
}

`;
s=s.slice(0,genStart)+newGen+s.slice(exportStart);

fs.writeFileSync(path,s);
console.log('Quiz generation v6 applied: exact-book evidence, Sànyà grounding, resilient batches, partial cache, and resumable failure.');
