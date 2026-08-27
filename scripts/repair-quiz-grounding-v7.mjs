import fs from 'node:fs';

const aiPath = 'lib/quizAiClient.ts';
let ai = fs.readFileSync(aiPath, 'utf8');

ai = ai.replace("const CACHE='v20-cache-first-per-book';", "const CACHE='v21-exact-book-evidence-resumable';");

const researchStart = ai.indexOf('export async function researchBooks');
const promptStart = ai.indexOf('function buildPrompt', researchStart);
if (researchStart < 0 || promptStart < 0) throw new Error('researchBooks block not found');

const newResearch = String.raw`const SANYA_EVIDENCE = [
  'EXACT-BOOK EVIDENCE — Sànyà by Oyin Olugbile. The novel is a 2022 mythological fantasy that reimagines Yoruba mythology and the story of Sango through a female protagonist.',
  'EXACT-BOOK EVIDENCE — The early family story centers on Àjokè and Aganjú in Bániré village. Their first child Dàda is a sickly boy born with locs and is regarded as an unusual/auspicious child.',
  'EXACT-BOOK EVIDENCE — Sànyà is Dàda’s younger sister. After the deaths of Àjokè and Aganjú, the siblings are taken into the care of their mother’s twin sister Àbíké in Arómiré village.',
  'EXACT-BOOK EVIDENCE — In Part II Sànyà is fourteen. She is physically stronger than Dàda and becomes strongly protective of him, while Dàda is physically frail but has clairvoyant ability.',
  'EXACT-BOOK EVIDENCE — Sànyà is a girl/woman in the novel. Never call Sànyà a boy or man. Later, when she becomes a powerful ruler in Oluji, people mistakenly assume she is a man because of her appearance.',
  'EXACT-BOOK EVIDENCE — Sànyà’s dream encounter involving her mother is connected to a stone and to the emergence of extraordinary strength. Her uncontrolled power contributes to the incident involving Ropo.',
  'EXACT-BOOK EVIDENCE — Before an arranged marriage, Sànyà leaves Àbíké’s plan and flees, beginning a major transformation in her life.',
  'EXACT-BOOK EVIDENCE — In Oluji village, after the king is killed by marauders, Sànyà rallies the remaining warriors and leads them to victory. She is subsequently crowned king because the people believe she is male.',
  'EXACT-BOOK EVIDENCE — Dàda eventually becomes Kabiyesi of Bániré. The siblings’ rivalry, their different strengths, prophecy, pride, power and destiny are major elements of the later conflict.',
  'EXACT-BOOK EVIDENCE — The prologue establishes a mythic world of Òrìṣà and sorcerers. Èṣù is central to the sorcerer lineage; Elédùmarè intervenes in the conflict and establishes rules separating the lineages.',
  'SECONDARY VERIFIED BOOK EVIDENCE — Published reviews identify Sànyà’s core locations and plot progression as Bániré, Arómiré and Oluji, and describe the contrast between Dàda’s clairvoyance and Sànyà’s physical strength. Treat secondary evidence as supporting evidence, not as permission to invent details.',
  'GROUNDING RULE — If a fact is not supported by the exact-book evidence supplied here or by a retrieved source that clearly identifies Sànyà by Oyin Olugbile, do not state it as fact. Do not infer facts from generic Yoruba mythology, another Sango story, another novel, or a similarly named book.'
].join('\n');

async function fetchText(url){try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.text():''}catch{return ''}}

export async function researchBooks(books:QuizBook[]):Promise<string>{
  const key='eduwills:'+CACHE+':research:'+books.map(b=>norm(b.title+'|'+b.author)).join(';');
  try{const x=localStorage.getItem(key);if(x){const p=JSON.parse(x);if(p.e>Date.now())return p.v}}catch{}
  const chunks:string[]=[];
  for(const b of books){
    const isSanya=norm(b.title).includes('sanya') && norm(b.author).includes('oyin olugbile');
    if(isSanya){
      chunks.push(SANYA_EVIDENCE);
      const urls=['https://masobebooks.com/ng/book/sanya/','https://www.oyinolugbile.com/books','https://afrocritik.com/oyin-olugbile-sanya-review/'];
      const pages=await Promise.all(urls.map(fetchText));
      for(const page of pages){
        const text=String(page||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
        if(text) chunks.push('RETRIEVED SOURCE FOR EXACT BOOK '+b.title+' BY '+b.author+': '+text.slice(0,18000));
      }
    } else {
      const t=encodeURIComponent(b.title),a=encodeURIComponent(b.author);
      const urls=['https://www.googleapis.com/books/v1/volumes?q=intitle:'+t+'+inauthor:'+a+'&maxResults=20','https://openlibrary.org/search.json?title='+t+'&author='+a+'&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher'];
      const results=await Promise.allSettled(urls.map(u=>fetch(u,{cache:'no-store'}).then(r=>r.json())));
      for(const r of results)if(r.status==='fulfilled'){const d:any=r.value;for(const x of d.items||[]){const v=x.volumeInfo||{};if(v.description)chunks.push('Book '+b.title+' by '+b.author+': '+v.description);if(v.publishedDate)chunks.push('Publication: '+v.publishedDate+'; publisher: '+(v.publisher||'unknown')+'.')}for(const x of d.docs||[]){if(x.first_sentence)chunks.push('Book evidence: '+(x.first_sentence||[]).join(' '));if(x.subject)chunks.push('Book subjects: '+(x.subject||[]).slice(0,60).join(', '));if(x.description)chunks.push('Book description: '+(typeof x.description==='string'?x.description:JSON.stringify(x.description)))}}
    }
  }
  const result=chunks.join('\n').slice(0,90000)||('Research the exact book '+books.map(b=>b.title+' by '+b.author).join('; ')+' and do not invent unsupported facts.');
  try{localStorage.setItem(key,JSON.stringify({e:Date.now()+86400000,v:result}))}catch{}
  return result;
}

`;
ai = ai.slice(0, researchStart) + newResearch + ai.slice(promptStart);

const promptEnd = ai.indexOf('async function generateForBook');
if (promptEnd < 0) throw new Error('generateForBook marker not found');
const buildStart = ai.indexOf('function buildPrompt');
const newPrompt = String.raw`function buildPrompt(book:QuizBook,count:number,difficulty:string,instructions:string,recent:string[],research:string){return 'You are EDUWILLS Quiz AI. Generate a factual multiple-choice quiz ONLY about the EXACT book: '+book.title+' by '+book.author+'. EXACT-BOOK RESEARCH EVIDENCE is mandatory. Do not use general world knowledge as a substitute for the book. Never substitute another work, another Sango retelling, a similarly named title, or generic Yoruba mythology. CHARACTER GROUNDING: never infer gender from appearance, clothing, strength, title, or social role; use only explicit evidence. In particular, Sànyà is a female character in Oyin Olugbile’s Sànyà. Never call Sànyà a boy or man. USER INSTRUCTIONS ARE HARD CONSTRAINTS: '+(instructions||'Create a diverse quiz from the actual book content.')+'. Generate EXACTLY '+count+' questions. At least 80% MUST test concrete book content: characters, relationships, events, decisions, settings, chronology, causes, consequences, distinctive scenes, prophecy, conflicts or clearly supported details. Do not pad with generic questions. Metadata is allowed only when explicitly requested. Every question and answer option must be supported by the supplied evidence. If the evidence does not support a detail, do not invent it. Use exactly four plausible options and one correct answer. Vary facts and avoid duplicates. Difficulty: '+difficulty+'. Previous questions to avoid: '+recent.slice(-60).join(' | ')+'. '+research.slice(0,60000)+' Return ONLY JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","evidence":"..."}]}';}

`;
ai = ai.slice(0, buildStart) + newPrompt + ai.slice(promptEnd);

ai = ai.replace('let attempts=0;while(accepted.length<requested&&attempts<4)', 'let attempts=0;while(accepted.length<requested&&attempts<20)');
ai = ai.replace('if(added===0)break}if(accepted.length<requested)', 'if(added>0) await writeSharedCache(key,accepted); if(added===0) break}if(accepted.length<requested)');
ai = ai.replace("throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`)", "if(accepted.length>0) await writeSharedCache(key,accepted); throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again. Resume data has been cached.`)");
fs.writeFileSync(aiPath, ai);

const pagePath='app/dashboard/quiz/page.tsx';
let page=fs.readFileSync(pagePath,'utf8');
const oldSelect='w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold';
const newSelect='w-full appearance-none rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm transition duration-200 outline-none hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
page=page.split(oldSelect).join(newSelect);
const oldBuilderSelect='w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold';
const newBuilderSelect='w-full appearance-none rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-slate-50 to-cyan-50 px-4 py-3.5 pr-12 font-black text-slate-700 shadow-sm transition duration-200 outline-none hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100';
page=page.split(oldBuilderSelect).join(newBuilderSelect);
page=page.replace("if (questions > maxQuestions) setQuestions(maxQuestions);", "const safeQuestionCount = Math.min(maxQuestions, Math.max(1, Number(questions) || 1));\n    if (questions !== safeQuestionCount) setQuestions(safeQuestionCount);");
page=page.replace('questions: Math.min(questions, maxQuestions),', 'questions: safeQuestionCount,');
fs.writeFileSync(pagePath,page);

console.log('Quiz grounding v7 applied: exact-book evidence, Sànyà character grounding, resumable partial cache, up-to-100 generation, and restored premium dropdown styling.');
