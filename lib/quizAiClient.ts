import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from '@/lib/firebase';

export type QuizBook = { title: string; author: string };
export type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string };
export type BookSearchResult = { title: string; authors: string[]; source: string };

const ai = getAI(app, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite', generationConfig: { responseMimeType: 'application/json' } });
const fastModel = getGenerativeModel(ai, { model: 'gemini-3.1-flash-lite', generationConfig: { responseMimeType: 'application/json' } });

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const fingerprint = (s: string) => normalize(s).replace(/\b(the|a|an|what|which|who|how|why|did|does|is|was|were|of|in|on|to|and|for|from|about|according)\b/g, '').replace(/\s+/g, ' ').trim();
const similar = (a: string, b: string) => { const x=new Set(fingerprint(a).split(' ').filter(Boolean)), y=new Set(fingerprint(b).split(' ').filter(Boolean)); if(!x.size||!y.size)return false; const hit=[...x].filter(v=>y.has(v)).length; return hit/Math.max(1,Math.min(x.size,y.size))>=0.84; };

const curated: Record<string,string[]> = {
  'the lekki headmaster': [
    'The Lekki Headmaster was written by Kabir Alabi Garba.',
    'The story follows Bepo Adewale, a dedicated headmaster at Stardom Schools in Lekki, Lagos.',
    'The novel explores education, integrity, service, migration pressure and the japa phenomenon.',
    'Bepo faces pressure to relocate to the United Kingdom but remains committed to his students and school.',
    'The novel was published by Winepress Publishing in 2023.',
    'JAMB selected The Lekki Headmaster as the general reading text for the 2025 and 2026 UTME Use of English.'
  ],
  'sanya': ['Sànyà is a Nigerian literary work by Oyin Olugbile.'],
  'scars': ['SCARS: Nigeria’s Journey and the Boko Haram Conundrum examines Nigeria’s journey and the Boko Haram conundrum.', 'SCARS is associated with Gen. Lucky Irabor.']
};

async function withTimeout<T>(promise: Promise<T>, ms=18000): Promise<T> { return await Promise.race([promise, new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('AI request timed out')),ms))]); }
async function json(url:string,ms=4500):Promise<any>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'},signal:c.signal});if(!r.ok)throw new Error(String(r.status));return await r.json();}finally{clearTimeout(t)}}

export async function searchBookAuthors(kind:'title'|'author',value:string):Promise<BookSearchResult[]> {
  const query=value.trim(); if(!query)return []; const key=normalize(query), results:BookSearchResult[]=[], seen=new Set<string>();
  const add=(title:string,authors:string[],source:string)=>{const t=String(title||'').trim(),a=[...new Set((authors||[]).map(String).map(x=>x.trim()).filter(Boolean))];if(!t||!a.length)return;if(kind==='author'&&!a.some(x=>normalize(x).includes(key)||key.includes(normalize(x))))return;const id=normalize(t)+'|'+a.map(normalize).sort().join(',');if(seen.has(id))return;seen.add(id);results.push({title:t,authors:a,source});};
  for(const [title,facts] of Object.entries(curated)){if(title.includes(key)||key.includes(title)){const a=facts.flatMap(x=>{const m=x.match(/(?:written by|by)\s+(.+?)\.?$/i);return m?[m[1].trim()]:[]});if(a.length)add(title,a,'EDUWILLS catalogue')}}
  const t=encodeURIComponent(query), endpoints=kind==='title'?[['Open Library',`https://openlibrary.org/search.json?title=${t}&limit=50`],['Google Books',`https://www.googleapis.com/books/v1/volumes?q=intitle:${t}&maxResults=40`],['Internet Archive',`https://archive.org/advancedsearch.php?q=title:%28${t}%29&fl[]=title&fl[]=creator&rows=40&page=1&output=json`]]:[['Open Library',`https://openlibrary.org/search.json?author=${t}&limit=50`],['Google Books',`https://www.googleapis.com/books/v1/volumes?q=inauthor:${t}&maxResults=40`]];
  const responses=await Promise.allSettled(endpoints.map(([source,url])=>json(url).then(data=>({source,data}))));
  for(const r of responses){if(r.status!=='fulfilled')continue;const {source,data}=r.value;for(const x of data.docs||[])add(x.title,x.author_name||[],source);for(const x of data.items||[])add(x.volumeInfo?.title,x.volumeInfo?.authors||[],source);for(const x of data.response?.docs||[])add(x.title,Array.isArray(x.creator)?x.creator:x.creator?[x.creator]:[],source)}
  const evidence=results.slice(0,60).map(r=>`${r.title} — ${r.authors.join(', ')} (${r.source})`).join('\n');
  try{const r=await withTimeout(model.generateContent(`You are EDUWILLS Book Search. Using only this public catalogue evidence, merge reliable matches for the ${kind} "${query}". Never invent an author. Return JSON: {"results":[{"title":"...","authors":["..."],"source":"..."}]}. Evidence:\n${evidence||'none'}`),12000);const p=JSON.parse(r.response.text());for(const x of p.results||[])add(x.title,x.authors||[],x.source||'EDUWILLS AI')}catch{}
  return results.slice(0,80);
}

export async function researchBooks(books:QuizBook[]):Promise<string>{
  const chunks:string[]=[];for(const b of books)chunks.push(...(curated[normalize(b.title)]||[]));
  const reqs=books.flatMap(b=>{const t=encodeURIComponent(b.title),a=encodeURIComponent(b.author);return [json(`https://www.googleapis.com/books/v1/volumes?q=intitle:${t}+inauthor:${a}&maxResults=20`),json(`https://openlibrary.org/search.json?title=${t}&author=${a}&limit=30`),json(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(b.title.replace(/ /g,'_'))}`),json(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(b.title+' '+b.author)}&language=en&format=json&limit=5&origin=*`)]});
  const rs=await Promise.allSettled(reqs);for(const r of rs){if(r.status!=='fulfilled')continue;const d=r.value;for(const x of d.items||[]){const v=x.volumeInfo||{};if(v.description)chunks.push(`Google Books: ${v.description}`);if(v.categories)chunks.push(`Categories: ${v.categories.join(', ')}`);if(v.publishedDate)chunks.push(`Publication: ${v.publishedDate}; publisher: ${v.publisher||'unknown'}.`)}for(const x of d.docs||[]){if(x.first_sentence)chunks.push(`Open Library: ${(x.first_sentence||[]).join(' ')}`);if(x.subject)chunks.push(`Subjects: ${(x.subject||[]).slice(0,50).join(', ')}`)}if(d.extract)chunks.push(`Wikipedia: ${d.extract}`);for(const x of Object.values(d.query?.pages||{}) as any[])if(x.extract)chunks.push(`Wikipedia: ${x.extract}`);for(const x of d.search||[])if(x.description||x.aliases)chunks.push(`Wikidata: ${x.description||''} ${(x.aliases||[]).join(', ')}`)}
  return [...new Set(chunks.map(x=>String(x).trim()).filter(Boolean))].join('\n').slice(0,50000);
}

function validate(raw:any,previous:string[],target:number):QuizQuestion[]{const list=Array.isArray(raw?.questions)?raw.questions:[], recent=new Set(previous.map(fingerprint).filter(Boolean)),out:QuizQuestion[]=[];for(const item of list){const q=String(item?.question||'').trim(),o=Array.isArray(item?.options)?item.options.map((x:any)=>String(x).trim()).filter(Boolean).slice(0,4):[],a=Number(item?.answer);if(!q||o.length!==4||!Number.isInteger(a)||a<0||a>3)continue;if(recent.has(fingerprint(q))||out.some(x=>similar(x.question,q)))continue;out.push({question:q,options:o,answer:a,explanation:String(item?.explanation||'').trim()});if(out.length>=target)break}return out}

function researchFallback(books:QuizBook[],research:string,count:number,previous:string[]):QuizQuestion[]{const facts=[...books.flatMap(b=>curated[normalize(b.title)]||[]),...research.split(/\n+/).filter(x=>x.length>35)].map(x=>x.replace(/^(Google Books|Open Library|Wikipedia|Wikidata|Categories|Subjects|Publication):\s*/,'').trim()).filter(Boolean);const out:QuizQuestion[]=[];const recent=new Set(previous.map(fingerprint));for(let i=0;i<facts.length&&out.length<count;i++){const fact=facts[i];const m=fact.match(/^(.+?)\s+(?:was|is|were|are|examines|explores|follows|features)\s+(.+)$/i);const stem=m?`Which statement is supported by the available information about ${books[i%books.length].title}?`:`Which statement is supported by the research about ${books[i%books.length].title}?`;const correct=fact;const options=[correct,...facts.filter(x=>x!==fact).slice(0,3)];while(options.length<4)options.push('This information is not supported by the available research.');const q={question:stem,options:options.slice(0,4),answer:0,explanation:'Generated from verified research because the AI service did not return a complete batch.'};if(!recent.has(fingerprint(q.question))&&!out.some(x=>similar(x.question,q.question)))out.push(q)}return out}

export async function generateQuiz(books:QuizBook[],count:number,difficulty:string,instructions:string,previous:string[],research:string):Promise<QuizQuestion[]>{
  const target=Math.min(100,Math.max(1,count)), batchCount=target<=12?1:target<=30?2:target<=60?3:5, perBatch=Math.min(18,Math.ceil(target/batchCount)+3), recent=previous.slice(-60).join(' | '), prompts=Array.from({length:batchCount},(_,i)=>`You are EDUWILLS Book Intelligence AI. Generate ${perBatch} DIFFERENT multiple-choice questions for ${books.map(b=>`${b.title} by ${b.author}`).join('; ')}. Batch ${i+1}/${batchCount}. Difficulty: ${difficulty}. ${instructions?`Student instruction: ${instructions}.`:''} Use only supported facts in the research. Vary characters, events, chronology, themes, setting, cause/effect, vocabulary, literary devices, inference and factual details. Never invent quotations, chapters or scenes. Exactly four options and exactly one correct answer. Return ONLY JSON in this shape: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}. Recent questions to avoid repeating frequently: ${recent}\nResearch:\n${research}`);
  const calls=prompts.map(p=>withTimeout(model.generateContent(p),18000).catch(()=>fastModel.generateContent(p)));const rs=await Promise.allSettled(calls);let out:QuizQuestion[]=[];for(const r of rs){if(r.status!=='fulfilled')continue;try{const p=JSON.parse(r.value.response.text());out=out.concat(validate(p,previous.concat(out.map(q=>q.question)),target-out.length));}catch{}if(out.length>=target)break}
  if(out.length<target){const extra=researchFallback(books,research,target-out.length,previous.concat(out.map(q=>q.question)));out=out.concat(extra)}
  if(out.length<target)throw new Error(`EDUWILLS could only prepare ${out.length} of ${target} questions. Please try again.`);return out.slice(0,target);
}

export async function explainFailure(book:string,question:string,learnerAnswer:string,correctAnswer:string):Promise<string>{const r=await withTimeout(model.generateContent(`Give a short study explanation for this wrong answer. Do not chat. Book: ${book}. Question: ${question}. Learner answer: ${learnerAnswer}. Correct answer: ${correctAnswer}. Include the key reasoning and one memory tip.`),12000);return r.response.text().trim()}
