import {NextRequest, NextResponse} from 'next/server';

type Source={title:string;text:string};
type Book={title:string;author:string};
type Question={question:string;options:string[];answer:number;explanation?:string};

const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const fingerprint=(s:string)=>normalize(s).replace(/\b(the|a|an|what|which|who|how|why|did|does|is|was|were|of|in|on|to|and|for|from)\b/g,'').replace(/\s+/g,' ').trim();
const similar=(a:string,b:string)=>{const x=new Set(fingerprint(a).split(' ').filter(Boolean));const y=new Set(fingerprint(b).split(' ').filter(Boolean));if(!x.size||!y.size)return false;const overlap=[...x].filter(v=>y.has(v)).length;return overlap/Math.max(1,Math.min(x.size,y.size))>=0.82};

function parseQuestions(text:string):Question[]{
  const clean=text.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const start=clean.indexOf('['),end=clean.lastIndexOf(']');
  if(start<0||end<=start)throw new Error('AI did not return a JSON array');
  const parsed=JSON.parse(clean.slice(start,end+1));
  if(!Array.isArray(parsed))throw new Error('Invalid question list');
  return parsed.map((q:any)=>({question:String(q.question||'').trim(),options:Array.isArray(q.options)?q.options.slice(0,4).map(String):[],answer:Number(q.answer),explanation:q.explanation?String(q.explanation):''})).filter((q:Question)=>q.question&&q.options.length===4&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);
}

async function fetchJson(url:string){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`Source ${r.status}`);return r.json()}

async function researchBook(book:Book):Promise<Source[]>{
  const out:Source[]=[];
  const add=(title:string,text:any)=>{if(text)out.push({title,text:String(text).slice(0,7000)})};
  try{const d=await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(book.title)}+inauthor:${encodeURIComponent(book.author)}&maxResults=20`);for(const x of d.items||[]){const v=x.volumeInfo||{};add(v.title||book.title,v.description)}}catch{}
  try{const d=await fetchJson(`https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&limit=30`);for(const x of d.docs||[]){add(x.title||book.title,(x.first_sentence||[]).join(' '));if(x.subject)add(`${x.title||book.title} subjects`,(x.subject||[]).slice(0,100).join(', '))}}catch{}
  try{const d=await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(book.title.replace(/ /g,'_'))}`);add(d.title||book.title,d.extract)}catch{}
  return out;
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const books:Array<Book>=Array.isArray(body.books)?body.books:[];
    const requested=Math.min(100,Math.max(1,Number(body.questions)||10));
    const difficulty=String(body.difficulty||'Mixed');
    const instructions=String(body.instructions||'').slice(0,100);
    const previous:Array<string>=Array.isArray(body.previousQuestions)?body.previousQuestions.map(String).slice(-300):[];
    if(!books.length)return NextResponse.json({error:'At least one book is required.'},{status:400});

    const sources=(await Promise.all(books.map(researchBook))).flat();
    const context=sources.map(s=>`SOURCE: ${s.title}\n${s.text}`).join('\n\n').slice(0,50000);
    const accepted:Question[]=[];
    const seen=new Set(previous.map(fingerprint).filter(Boolean));

    for(let round=0;round<8&&accepted.length<requested;round++){
      const need=requested-accepted.length;
      const prompt=`You are EDUWILLS Book Intelligence Quiz AI. Create up to ${Math.min(need+15,40)} NEW multiple-choice questions about ${books.map(b=>`${b.title} by ${b.author}`).join('; ')}. Use only facts supported by the research below. Difficulty: ${difficulty}. User instruction: ${instructions||'None'}. Deliberately vary learning targets across plot/events, characters, relationships, themes, setting, chronology, cause/effect, inference, vocabulary/literary devices, and chapter-specific details when supported. Do not repeat or paraphrase any prior question. Do not invent facts or quotations. Every question must have exactly four options and one correct answer. Return ONLY JSON: [{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]. PRIOR QUESTION FINGERPRINTS: ${[...seen].slice(-300).join(' | ')}\nRESEARCH:\n${context}`;
      try{
        const r=await fetch('https://text.pollinations.ai/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],model:'openai'})});
        if(!r.ok)continue;
        for(const q of parseQuestions(await r.text())){
          const fp=fingerprint(q.question);
          if(!fp||seen.has(fp)||accepted.some(x=>similar(x.question,q.question)))continue;
          seen.add(fp);accepted.push(q);if(accepted.length>=requested)break;
        }
      }catch{}
    }

    return NextResponse.json({questions:accepted,sourcesUsed:sources.length,complete:accepted.length>=requested,notice:accepted.length<requested?'EDUWILLS could not find enough reliable, non-repeating material to reach the requested number without inventing facts.':''});
  }catch(e:any){return NextResponse.json({error:e?.message||'Quiz AI unavailable.'},{status:500})}
}
