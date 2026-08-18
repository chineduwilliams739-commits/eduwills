import {NextRequest,NextResponse} from 'next/server';

type Hit={title:string;authors:string[];description?:string};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const clean=(s:any)=>String(s||'').replace(/\s+/g,' ').trim();
const aliases:Record<string,{title:string;authors:string[]}>= {
  scars:{title:'SCARS: Nigeria’s Journey and the Boko Haram Conundrum',authors:['Gen. Lucky Irabor','General Lucky Irabor','Lucky Irabor']},
  'scars nigeria':{title:'SCARS: Nigeria’s Journey and the Boko Haram Conundrum',authors:['Gen. Lucky Irabor','General Lucky Irabor','Lucky Irabor']},
  irabor:{title:'SCARS: Nigeria’s Journey and the Boko Haram Conundrum',authors:['Gen. Lucky Irabor','General Lucky Irabor','Lucky Irabor']},
  'lucky irabor':{title:'SCARS: Nigeria’s Journey and the Boko Haram Conundrum',authors:['Gen. Lucky Irabor','General Lucky Irabor','Lucky Irabor']},
  'gen lucky irabor':{title:'SCARS: Nigeria’s Journey and the Boko Haram Conundrum',authors:['Gen. Lucky Irabor','General Lucky Irabor','Lucky Irabor']},
  'general lucky irabor':{title:'SCARS: Nigeria’s Journey and the Boko Haram Conundrum',authors:['Gen. Lucky Irabor','General Lucky Irabor','Lucky Irabor']},
  sanya:{title:'Sànyà',authors:['Oyin Olugbile']},
  'oyin olugbile':{title:'Sànyà',authors:['Oyin Olugbile']}
};
async function json(url:string,ms=5000){const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),ms);try{const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'},signal:ctl.signal});if(!r.ok)throw new Error(String(r.status));return r.json()}finally{clearTimeout(t)}}
function mergeAuthors(names:Set<string>, values:any[]){for(const v of values||[]){const n=clean(v);if(n)names.add(n)}}
function addUnique(books:Hit[],t:any,a:any[],d?:any){const title=clean(t),aa=(a||[]).map(clean).filter(Boolean);if(!title)return;const key=norm(title)+'|'+aa.map(norm).join('|');if(books.some(x=>norm(x.title)+'|'+x.authors.map(norm).join('|')===key))return;books.push({title,authors:aa,description:clean(d)})}
export async function POST(req:NextRequest){try{const b=await req.json(),title=clean(b.title),author=clean(b.author);if(!title&&!author)return NextResponse.json({authors:[],books:[],found:false});const names=new Set<string>(),books:Hit[]=[],raw=norm([title,author].filter(Boolean).join(' '));
const forced=aliases[raw]||aliases[norm(title)]||aliases[norm(author)];
if(forced){mergeAuthors(names,forced.authors);addUnique(books,forced.title,forced.authors,'Verified EDUWILLS catalogue match.');}
const titleQ=encodeURIComponent(title||forced?.title||''),authorQ=encodeURIComponent(author||forced?.authors[0]||''),jobs:Promise<any>[]=[];
if(titleQ)jobs.push(json(`https://openlibrary.org/search.json?title=${titleQ}&limit=100`),json(`https://openlibrary.org/search.json?q=${titleQ}&limit=100`),json(`https://www.googleapis.com/books/v1/volumes?q=intitle:${titleQ}&maxResults=40`),json(`https://archive.org/advancedsearch.php?q=title%3A%22${titleQ}%22&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=description&fl%5B%5D=identifier&rows=40&output=json`));
if(authorQ)jobs.push(json(`https://openlibrary.org/search.json?author=${authorQ}&limit=100`),json(`https://www.googleapis.com/books/v1/volumes?q=inauthor:${authorQ}&maxResults=40`));
for(const r of await Promise.allSettled(jobs)){if(r.status!=='fulfilled')continue;const d:any=r.value;if(Array.isArray(d.items))for(const x of d.items){const v=x.volumeInfo||{};addUnique(books,v.title,v.authors,v.description);mergeAuthors(names,v.authors||[])}for(const x of d.docs||[]){addUnique(books,x.title,x.author_name,x.first_sentence?.join?.(' '));mergeAuthors(names,x.author_name||[])}for(const x of d.response?.docs||[]){addUnique(books,x.title,Array.isArray(x.creator)?x.creator:[x.creator],x.description);mergeAuthors(names,Array.isArray(x.creator)?x.creator:[x.creator])}}
if(forced){const wanted=norm(forced.title);if(!books.some(x=>norm(x.title).includes(wanted)||wanted.includes(norm(x.title))))addUnique(books,forced.title,forced.authors,'Verified EDUWILLS catalogue match.')}
const requested=norm(author);let filtered=[...names];if(requested)filtered=filtered.filter(n=>norm(n).includes(requested)||requested.includes(norm(n)));if(forced)filtered=[...new Set([...forced.authors,...filtered])];
return NextResponse.json({authors:filtered.slice(0,80),books:books.slice(0,120),found:books.length>0||filtered.length>0});}catch(e:any){return NextResponse.json({error:e?.message||'Book search unavailable.',authors:[],books:[],found:false},{status:200})}}
