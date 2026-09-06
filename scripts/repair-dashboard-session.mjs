import fs from 'node:fs';

const dashboard='app/dashboard/page.tsx';
const activation='app/dashboard/activation/page.tsx';
const quizPage='app/dashboard/quiz/page.tsx';
const stable='lib/quizAiClientStable.ts';

let d=fs.readFileSync(dashboard,'utf8');
d=d.replace("if(!s.exists()){await signOut(auth);window.location.replace(`${BASE}/login/`);return;}const d=s.data();", "if(!s.exists()){setName(u.displayName||'Learner');setActivated(false);setExpiry('');setLoading(false);return;}const d=s.data();");
d=d.replace("if(!identity){await signOut(auth);window.location.replace(`${BASE}/login/`);return;}", "if(!identity){setName(u.displayName||'Learner');} else {setName(identity);}");
d=d.replace("setName(identity);setCategory(activeCategory);", "setCategory(activeCategory);");
d=d.replace("}catch(e){console.error(e);await signOut(auth).catch(()=>undefined);window.location.replace(`${BASE}/login`);}finally{setLoading(false)}}),[]);", "}catch(e){console.error(e);setName(auth.currentUser?.displayName||'Learner');setActivated(false);setExpiry('');}finally{setLoading(false)}}),[]);");
fs.writeFileSync(dashboard,d,'utf8');

let a=fs.readFileSync(activation,'utf8');
a=a.replace(/<ContactSupport\s+box\s*\/>/g, '');
fs.writeFileSync(activation,a,'utf8');

// Patch quiz setup without replacing the whole page.
let p=fs.readFileSync(quizPage,'utf8');
if (!p.includes('  searchBookAuthors,\n')) {
  p=p.replace('  researchBooks,\n','  researchBooks,\n  searchBookAuthors,\n');
}
if (!p.includes("title: 'The Lekki Headmaster'")) {
  p=p.replace("const CURATED_BOOKS: CuratedBook[] = [\n", "const CURATED_BOOKS: CuratedBook[] = [\n  { title: 'The Lekki Headmaster', aliases: ['lekki headmaster', 'the lekki headmaster', 'lekki headmaster kabir alabi garba'], authors: ['Kabir Alabi Garba'] },\n");
}
const findStart=p.indexOf('  async function findBook() {');
const saveStart=p.indexOf('  async function saveBook() {',findStart);
if(findStart<0 || saveStart<0) throw new Error('Quiz search function boundaries not found');
p=p.slice(0,findStart)+`  async function findBook() {
    const raw=title.trim();
    if(!raw)return;
    setSearching(true);setMessage('');setAuthors([]);setAuthor('');setAuthorQuery('');
    try{
      const results=await searchBookAuthors('title',raw);
      const n=normalize(raw);
      const curated=CURATED_BOOKS.filter(b=>[b.title,...b.aliases].some(a=>{const x=normalize(a);return x.includes(n)||n.includes(x);})).flatMap(b=>b.authors);
      const names=Array.from(new Set([...curated,...results.flatMap(r=>r.authors)].filter(Boolean))).slice(0,80);
      setAuthors(names);
      setMessage(names.length?'Select a verified author from the search results. Authors cannot be entered manually.':'No verified author was found. Try the full title or search for the author by name.');
    }catch(error){console.error('Book search failed',error);setMessage('Book search is temporarily unavailable. Please try again.');}
    finally{setSearching(false);}
  }

  async function searchAuthor() {
    const q=authorQuery.trim();
    if(!q)return;
    setSearching(true);setMessage('');
    try{
      const results=await searchBookAuthors('author',q);
      const names=Array.from(new Set(results.flatMap(r=>r.authors).filter(Boolean))).slice(0,80);
      setAuthors(names);
      setMessage(names.length?'Select a verified author from the search results.':'No verified author match was found. Try another spelling.');
    }catch(error){console.error('Author search failed',error);setMessage('Author search is temporarily unavailable. Please try again.');}
    finally{setSearching(false);}
  }

`+p.slice(saveStart);
fs.writeFileSync(quizPage,p,'utf8');

let s=fs.readFileSync(stable,'utf8');
const searchStart=s.indexOf("export async function searchBookAuthors(kind: 'title' | 'author', value: string): Promise<BookSearchResult[]> {");
const researchStart=s.indexOf('\n\nexport async function researchBooks',searchStart);
if(searchStart<0||researchStart<0)throw new Error('Stable search helper boundaries not found');
s=s.slice(0,searchStart)+`export async function searchBookAuthors(kind: 'title' | 'author', value: string): Promise<BookSearchResult[]> {
  const query=value.trim();if(!query)return[];
  const encoded=encodeURIComponent(query);
  const urls=kind==='title'
    ? [
        \`https://openlibrary.org/search.json?title=\${encoded}&limit=50&fields=title,author_name,key\`,
        \`https://www.googleapis.com/books/v1/volumes?q=intitle:\${encoded}&maxResults=40\`,
        \`https://archive.org/advancedsearch.php?q=title:(\${encoded})&fl[]=title&fl[]=creator&rows=40&page=1&output=json\`,
      ]
    : [
        \`https://openlibrary.org/search.json?author=\${encoded}&limit=50&fields=title,author_name,key\`,
        \`https://www.googleapis.com/books/v1/volumes?q=inauthor:\${encoded}&maxResults=40\`,
        \`https://archive.org/advancedsearch.php?q=creator:(\${encoded})&fl[]=title&fl[]=creator&rows=40&page=1&output=json\`,
      ];
  const output:BookSearchResult[]=[];const seen=new Set<string>();
  await Promise.allSettled(urls.map(async url=>{
    try{
      const response=await fetch(url,{cache:'no-store'});if(!response.ok)return;
      const data:any=await response.json();
      const rows=[...(data.docs||[]),...(data.items||[]).map((item:any)=>({title:item.volumeInfo?.title,author_name:item.volumeInfo?.authors})),...(data.response?.docs||[])];
      for(const row of rows){
        const title=clean(row?.title);
        const rawAuthors=row?.author_name??row?.authors??row?.creator??row?.author;
        const authors=Array.isArray(rawAuthors)?rawAuthors.map((x:unknown)=>clean(x)).filter(Boolean):typeof rawAuthors==='string'?rawAuthors.split(/;|,|\|/).map(clean).filter(Boolean):[];
        if(!title||!authors.length)continue;
        const key=\`\${norm(title)}|\${authors.map(norm).join('|')}\`;if(seen.has(key))continue;seen.add(key);
        output.push({title,authors,source:url.includes('openlibrary')?'Open Library':url.includes('googleapis')?'Google Books':'Internet Archive'});
      }
    }catch{}
  }));
  return output.slice(0,160);
}
`+s.slice(researchStart);
const needle='      `https://openlibrary.org/search.json?title=\${title}&author=\${author}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`,\n    ];';
const replacement='      `https://openlibrary.org/search.json?title=\${title}&author=\${author}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`,\n      `https://archive.org/advancedsearch.php?q=title:(\${title})%20AND%20creator:(\${author})&fl[]=title&fl[]=creator&fl[]=description&fl[]=subject&rows=20&page=1&output=json`,\n    ];';
if(s.includes(needle)&&!s.includes('archive.org/advancedsearch.php?q=title:(\${title})%20AND%20creator:(\${author})'))s=s.replace(needle,replacement,1);
s=s.replace("USER INSTRUCTIONS: \${instructions || 'Create a diverse quiz from the actual book content.'}","USER INSTRUCTIONS: \${instructions ? `MANDATORY — follow these instructions in every question after factual accuracy and safety: \${instructions}. Each question must visibly reflect the requested focus; do not replace it with a generic question.` : 'No special instructions were provided. Deliberately vary questions across characters, relationships, events, chronology, settings, causes/consequences, themes, conflicts, language/style, symbols, decisions, chapters, and distinctive book-specific details.'}");

// Persist the live Gemini/Google Search bridge in the same repair workflow that already
// runs on every push. This avoids relying on a separate workflow dispatch.
s=s.replace("const CACHE_VERSION = 'v30-explanation-timer-gateway-first';", "const CACHE_VERSION = 'v36-gemini-google-search-live';");
if (!s.includes('async function gatewayResearch(')) {
  const marker='async function geminiText(prompt: string, timeout = 60000) {';
  if(!s.includes(marker)) throw new Error('Gemini gateway insertion marker not found');
  const bridge=`async function gatewayResearch(prompt: string, timeout = 60000) {
  const url = await gatewayUrl();
  const user = auth.currentUser;
  if (!url || !user) throw new Error('AI_RESEARCH_GATEWAY_UNAVAILABLE');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'research', prompt }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(\`AI_RESEARCH_GATEWAY_\${response.status}\`);
    const sources = Array.isArray(data?.sources) ? data.sources : [];
    const sourceText = sources.map((source:any) => \`${source?.title || 'Source'} | ${source?.url || ''}\`).filter(Boolean).join('\\n');
    return [String(data?.text || '').trim(), sourceText ? \`SOURCES:\\n\${sourceText}\` : ''].filter(Boolean).join('\\n\\n');
  } finally { window.clearTimeout(timer); }
}

`;
  s=s.replace(marker,bridge+marker);
}
if(s.includes('export async function researchBooks(books: QuizBook[]): Promise<string> {')){
  s=s.replace('export async function researchBooks(books: QuizBook[]): Promise<string> {','export async function researchBooks(books: QuizBook[], focus = \'\'): Promise<string> {');
}
if(!s.includes('GEMINI GOOGLE SEARCH RESEARCH for')){
  const anchor='    const author = encodeURIComponent(book.author);\n    const urls = [';
  if(!s.includes(anchor)) throw new Error('Gemini book research anchor not found');
  const insert=`    const author = encodeURIComponent(book.author);
    let geminiBookResearch = '';
    try {
      geminiBookResearch = await gatewayResearch(\`Research the exact book "\${book.title}" by \${book.author}.\${focus.trim() ? \` Focus on: \${focus.trim()}\` : ''} Find reliable public facts about characters, relationships, events, chronology, setting, themes, conflicts, decisions, chapters, and distinctive details. Prefer authoritative, educational, publisher, library, government, or reputable sources. Do not invent facts or reproduce long copyrighted passages.\`, 60000);
    } catch {}
    if (geminiBookResearch) chunks.push(\`GEMINI GOOGLE SEARCH RESEARCH for \${book.title} by \${book.author}:\\n\${geminiBookResearch}\`);
    const urls = [`;
  s=s.replace(anchor,insert);
}
s=s.replace(/const evidenceByBook = await Promise\.all\(books\.map\(async \(book\) => researchBooks\(\[book\](?:, instructions)?\)\)\);/,'const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book], instructions)));');

const askPattern=/export async function askEduwills\(prompt: string, history: string\[\] = \[\]\) \{[\s\S]*?\n\}\n\nfunction readableExplanation/;
if(askPattern.test(s)){
  s=s.replace(askPattern,`export async function askEduwills(prompt: string, history: string[] = []) {
  const conversation = [...history.slice(-8), \`Learner: \${prompt}\`].join('\\n');
  const liveWebResearch = await gatewayResearch(prompt, 60000).catch(() => '');
  const instruction = \`You are EDUWILLS AI, a general educational and knowledge assistant. Answer the learner's actual question directly. Use the live Google Search research below whenever relevant. Treat it as evidence, cross-check conflicts, never invent facts or sources, and clearly state when reliable evidence is incomplete. Plain readable text only.

LIVE GOOGLE SEARCH RESEARCH:
\${liveWebResearch || 'No live web research was available.'}

Conversation:
\${conversation}\`;
  try { return clean(await gateway(instruction, 60000)); }
  catch {
    try { return clean(await geminiText(instruction, 60000)); }
    catch { return 'EDUWILLS AI is temporarily busy. Please try again in a moment.'; }
  }
}

function readableExplanation`);
} else throw new Error('askEduwills implementation not found');

fs.writeFileSync(stable,s,'utf8');

// Safe trigger marker: this file is intentionally kept non-workflow so the repair runner can execute on push.
console.log('Repaired dashboard session, activation support, quiz search, Lekki Headmaster author data, broader book lookup, instruction grounding, and live Gemini Google Search research.');
