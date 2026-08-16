import {NextRequest,NextResponse} from 'next/server';

type Hit={title:string;authors:string[];description?:string};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const cleanName=(s:string)=>String(s||'').replace(/\s+/g,' ').trim();

async function json(url:string){const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(String(r.status));return r.json()}

export async function POST(req:NextRequest){
  try{
    const b=await req.json();
    const title=cleanName(b.title);
    const author=cleanName(b.author);
    if(!title&&!author)return NextResponse.json({authors:[],books:[]});
    const names=new Set<string>();
    const books:Hit[]=[];
    const add=(t:string,a:string[],d?:string)=>{
      const aa=a.map(cleanName).filter(Boolean);
      aa.forEach(x=>names.add(x));
      if(t)books.push({title:t,authors:aa,description:d});
    };
    if(title){
      try{const q=encodeURIComponent(title);const d=await json(`https://openlibrary.org/search.json?title=${q}&limit=50`);for(const x of d.docs||[])add(x.title||title,x.author_name||[],(x.first_sentence||[]).join(' '));}catch{}
      try{const q=encodeURIComponent(title);const d=await json(`https://www.googleapis.com/books/v1/volumes?q=intitle:${q}&maxResults=40`);for(const x of d.items||[]){const v=x.volumeInfo||{};add(v.title||title,v.authors||[],v.description);} }catch{}
      try{const d=await json(`https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=50`);for(const x of d.docs||[])add(x.title||title,x.author_name||[],(x.first_sentence||[]).join(' '));}catch{}
    }
    if(author){
      try{const d=await json(`https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&limit=50`);for(const x of d.docs||[])add(x.title||'',x.author_name||[]);}catch{}
      try{const d=await json(`https://www.googleapis.com/books/v1/volumes?q=inauthor:${encodeURIComponent(author)}&maxResults=40`);for(const x of d.items||[]){const v=x.volumeInfo||{};add(v.title||'',v.authors||[],v.description);} }catch{}
    }
    const requested=norm(author);
    const filtered=[...names].filter(n=>!requested||norm(n).includes(requested)||requested.includes(norm(n))).slice(0,60);
    return NextResponse.json({authors:filtered,books:books.slice(0,80)});
  }catch(e:any){return NextResponse.json({error:e?.message||'Book search unavailable.',authors:[],books:[]},{status:200})}
}
