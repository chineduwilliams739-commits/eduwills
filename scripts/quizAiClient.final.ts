'use client';

import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app, { auth, db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

export type QuizBook = { title: string; author: string };
export type QuizQuestion = { question: string; options: string[]; answer: number; explanation?: string; evidence?: string };
export type BookSearchResult = { title: string; authors: string[]; source: string };

const BASE = '/eduwills';
const CACHE = 'v22-broad-book-knowledge-cache-first';
const SOFT_DAILY_AI_BATCHES = 8;

const norm = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const clean = (s: any) => String(s ?? '').replace(/```[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
const plain = (s: any) => clean(s).replace(/^\s*(assistant|ai|response|answer)\s*:\s*/i, '').trim();
const fingerprint = (s: string) => norm(s).replace(/\b(the|a|an|what|which|who|how|why|did|does|is|was|were|of|in|on|to|and|for|from|about|according)\b/g, '').replace(/\s+/g, ' ').trim();
const similar = (a: string, b: string) => { const x = new Set(fingerprint(a).split(' ').filter(Boolean)); const y = new Set(fingerprint(b).split(' ').filter(Boolean)); if (!x.size || !y.size) return false; const hit = [...x].filter(v => y.has(v)).length; return hit / Math.max(1, Math.min(x.size, y.size)) >= 0.82; };
const isMetadata = (q: QuizQuestion) => /\b(author|written by|writer|title|publisher|publication|isbn|edition|published)\b/i.test(q.question);
const valid = (q: any) => !!q && typeof q.question === 'string' && q.question.length > 18 && Array.isArray(q.options) && q.options.length === 4 && q.options.every((x: any) => typeof x === 'string' && x.trim()) && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4;

const KNOWN_BOOKS = [
  {
    title: 'Sànyà', aliases: ['sanya', 'sanya novel', 'sànyà novel'], authors: ['Oyin Olugbile', 'Óyìn Olúgbilé'],
    evidence: [
      'Sànyà is a 2022 debut novel by Oyin Olugbile, published by Masobe Books.',
      'The novel is a mythological fantasy/fiction work that reimagines Yoruba mythology and the story of Sango through a female protagonist.',
      'The story follows Sànyà, her brother Dada, Aunt Abike and a prophecy connected to Sànyà\'s powers; tragedy, dangerous love and a family-threatening war are central elements.',
      'The author\'s official book page identifies Sànyà as the winner of the 2025 Nigeria Prize for Literature.'
    ], sources: ['https://www.oyinolugbile.com/books', 'https://masobebooks.com/ng/book/sanya/', 'https://virtuall.nln.gov.ng/resource/NLN-XAHR2EOY1LSD4Y1N0']
  },
  {
    title: 'The Lekki Headmaster', aliases: ['lekki headmaster', 'the lekki headmaster', 'lekki head master'], authors: ['Kabir Alabi Garba', 'Kabir A. Garba'],
    evidence: [
      'The Lekki Headmaster is a novel by Nigerian writer, journalist and educator Kabir Alabi Garba.',
      'The novel centres on Mr. Bepo Adewale, a long-serving principal of Stardom Schools in Lekki, Lagos.',
      'A central conflict concerns Bepo\'s pressure to relocate to the United Kingdom while he remains deeply committed to his students and to education in Nigeria.',
      'Major characters reported by multiple study sources include Mrs. Ibidun Gloss, Mr. Fafore, Mr. Audu, Mrs. Grace Apeh, Seri, Mr. Egi Meko, Chief Didi Ogba, Banky, Tosh and Mrs. Ignatius.',
      'JAMB identified The Lekki Headmaster as its Use-of-English reading text for the UTME.'
    ], sources: ['https://www.jamb.gov.ng/Bulletin/2025/JAMBulletin_20-01-2025.pdf', 'https://lekkiheadmaster.com/the-lekki-headmaster/', 'https://www.literaturepadi.com.ng/2026/02/26/chapter-1-to-3-summary-and-analysis-of-the-lekki-headmaster/']
  }
] as const;

const findKnown = (book: QuizBook) => {
  const t = norm(book.title); const a = norm(book.author);
  return KNOWN_BOOKS.find(k => (norm(k.title) === t || k.aliases.some(x => norm(x) === t)) && k.authors.some(x => norm(x) === a)) || KNOWN_BOOKS.find(k => norm(k.title) === t || k.aliases.some(x => norm(x) === t));
};

const ai = getAI(app, { backend: new GoogleAIBackend() });
const gemini = getGenerativeModel(ai, { model: 'gemini-3.5-flash-lite', generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 5000 } });

async function workerUrl() { try { const r = await fetch(`${BASE}/ai-gateway.json?v=2`, { cache: 'no-store' }); if (!r.ok) throw Error(); const d = await r.json(); return String(d.url || '').replace(/\/$/, ''); } catch { return ''; } }
async function worker(prompt: string, timeout = 30000, mode: 'quiz' | 'chat' = 'quiz') {
  const url = await workerUrl(); const u = auth.currentUser; if (!url) throw Error('AI_GATEWAY_NOT_CONFIGURED'); if (!u) throw Error('AUTHENTICATION_REQUIRED');
  const token = await u.getIdToken(); const c = new AbortController(); const timer = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, prompt }), signal: c.signal }); const d = await r.json().catch(() => ({})); if (!r.ok) throw Error(d?.error || `AI_GATEWAY_${r.status}`); return String(d.text || ''); } finally { clearTimeout(timer); }
}
async function geminiFallback(prompt: string) { let timer: any; try { return await Promise.race([gemini.generateContent(prompt), new Promise((_, rej) => timer = setTimeout(() => rej(Error('GEMINI_TIMEOUT')), 30000))]) as any; } finally { clearTimeout(timer); } }
function parse(text: string): QuizQuestion[] {
  const raw = String(text || '').trim(); let data: any; try { data = JSON.parse(raw); } catch { const a = raw.indexOf('{'), b = raw.lastIndexOf('}'); if (a < 0 || b <= a) throw Error('AI returned unreadable JSON'); data = JSON.parse(raw.slice(a, b + 1)); }
  const list = Array.isArray(data) ? data : data?.questions; return (Array.isArray(list) ? list : []).map((q: any) => ({ question: clean(q.question), options: Array.isArray(q.options) ? q.options.slice(0, 4).map(clean) : [], answer: Number(q.answer), explanation: clean(q.explanation), evidence: clean(q.evidence) })).filter(valid);
}
async function hashKey(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function bookCacheKey(book: QuizBook, difficulty: string, instructions: string) { return `quiz:${CACHE}:book:${await hashKey(JSON.stringify({ book: { title: norm(book.title), author: norm(book.author) }, difficulty: norm(difficulty), instructions: fingerprint(instructions) }))}`; }

async function readSharedCache(key: string, recent: string[]) {
  try { const snap = await getDocs(query(collection(db, 'quizQuestionCache'), where('cacheKey', '==', key))); const now = Date.now(); const candidates = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(x => Number(x.expiresAtMs || 0) > now && Array.isArray(x.questions) && x.questions.length); if (!candidates.length) return []; const overlap = (x: any) => recent.filter(r => (x.questions || []).some((q: any) => similar(String(r), String(q.question || '')))).length; candidates.sort((a, b) => overlap(a) - overlap(b) || Number(a.lastUsedAtMs || 0) - Number(b.lastUsedAtMs || 0)); const best = candidates[0]; await updateDoc(doc(db, 'quizQuestionCache', best.id), { lastUsedAtMs: Date.now(), usageCount: Number(best.usageCount || 0) + 1 }).catch(() => undefined); return best.questions as QuizQuestion[]; } catch { return []; }
}
async function writeSharedCache(key: string, questions: QuizQuestion[]) { if (!questions.length) return; try { const id = `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; await setDoc(doc(db, 'quizQuestionCache', id), { cacheKey: key, questions: questions.slice(0, 100), createdAt: serverTimestamp(), lastUsedAtMs: Date.now(), usageCount: 0, expiresAtMs: Date.now() + 14 * 86400000 }); } catch {} }
async function quotaUsed() { const u = auth.currentUser; if (!u) return 0; const day = new Date().toISOString().slice(0, 10); try { const s = await getDoc(doc(db, 'quizAiQuota', `${u.uid}_${day}`)); return s.exists() ? Number(s.data().generated || 0) : 0; } catch { return 0; } }
async function recordQuota() { const u = auth.currentUser; if (!u) return; const day = new Date().toISOString().slice(0, 10); const ref = doc(db, 'quizAiQuota', `${u.uid}_${day}`); try { const s = await getDoc(ref); if (!s.exists()) await setDoc(ref, { uid: u.uid, day, generated: 1 }); else await updateDoc(ref, { generated: Number(s.data().generated || 0) + 1 }); } catch {} }

function knownSearch(value: string): BookSearchResult[] { const n = norm(value); const out: BookSearchResult[] = []; for (const k of KNOWN_BOOKS) if (norm(k.title).includes(n) || n.includes(norm(k.title)) || k.aliases.some(a => norm(a).includes(n) || n.includes(norm(a)))) out.push({ title: k.title, authors: [...k.authors], source: 'EDUWILLS curated book index' }); return out; }

export async function searchBookAuthors(kind: 'title' | 'author', value: string): Promise<BookSearchResult[]> {
  const q = value.trim(); if (!q) return []; const e = encodeURIComponent(q); const urls = kind === 'title' ? [`https://openlibrary.org/search.json?title=${e}&limit=50&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=intitle:${e}&maxResults=40`, `https://www.loc.gov/books/?q=${e}&fo=json&c=40`] : [`https://openlibrary.org/search.json?author=${e}&limit=50&fields=title,author_name`, `https://www.googleapis.com/books/v1/volumes?q=inauthor:${e}&maxResults=40`, `https://www.loc.gov/books/?q=${e}&fo=json&c=40`];
  const out: BookSearchResult[] = [...knownSearch(q)]; const seen = new Set(out.map(x => `${norm(x.title)}|${x.authors.map(norm).join('|')}`));
  await Promise.allSettled(urls.map(async u => { try { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) return; const d: any = await r.json(); for (const x of [...(d.docs || []), ...(d.items || []).map((i: any) => ({ title: i.volumeInfo?.title, author_name: i.volumeInfo?.authors }))]) { const title = clean(x.title), authors = (x.author_name || []).map(String); if (!title || !authors.length) continue; const k = `${norm(title)}|${authors.map(norm).join('|')}`; if (!seen.has(k)) { seen.add(k); out.push({ title, authors, source: u.includes('openlibrary') ? 'Open Library' : u.includes('loc.gov') ? 'Library of Congress' : 'Google Books' }); } } } catch {} }));
  return out.slice(0, 160);
}

export async function researchBooks(books: QuizBook[]): Promise<string> {
  const key = `eduwills:${CACHE}:research:${books.map(b => norm(`${b.title}|${b.author}`)).join(';')}`;
  try { const x = localStorage.getItem(key); if (x) { const p = JSON.parse(x); if (p.e > Date.now()) return p.v; } } catch {}
  const chunks: string[] = [];
  for (const b of books) {
    const known = findKnown(b); if (known) chunks.push(`CURATED EVIDENCE FOR EXACT BOOK: ${known.title} by ${known.authors[0]}.\n${known.evidence.join('\n')}\nReference sources: ${known.sources.join(', ')}`);
    const t = encodeURIComponent(b.title), a = encodeURIComponent(b.author); const urls = [`https://www.googleapis.com/books/v1/volumes?q=intitle:${t}+inauthor:${a}&maxResults=20`, `https://openlibrary.org/search.json?title=${t}&author=${a}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`];
    const results = await Promise.allSettled(urls.map(u => fetch(u, { cache: 'no-store' }).then(r => r.json())));
    for (const r of results) if (r.status === 'fulfilled') { const d: any = r.value; for (const x of d.items || []) { const v = x.volumeInfo || {}; if (v.description) chunks.push(`Book ${b.title} by ${b.author}: ${v.description}`); if (v.publishedDate) chunks.push(`Publication: ${v.publishedDate}; publisher: ${v.publisher || 'unknown'}.`); if (Array.isArray(v.categories)) chunks.push(`Categories: ${v.categories.join(', ')}`); } for (const x of d.docs || []) { if (x.first_sentence) chunks.push(`Book evidence: ${(x.first_sentence || []).join(' ')}`); if (x.subject) chunks.push(`Book subjects: ${(x.subject || []).slice(0, 60).join(', ')}`); if (x.description) chunks.push(`Book description: ${typeof x.description === 'string' ? x.description : JSON.stringify(x.description)}`); } }
  }
  const result = chunks.join('\n').slice(0, 90000) || `Research the exact book ${books.map(b => `${b.title} by ${b.author}`).join('; ')}. Do not invent unsupported facts.`;
  try { localStorage.setItem(key, JSON.stringify({ e: Date.now() + 7 * 86400000, v: result })); } catch {} return result;
}

function buildPrompt(book: QuizBook, count: number, difficulty: string, instructions: string, recent: string[], research: string) { return `You are EDUWILLS Quiz AI. STRICT BOOK SCOPE: generate questions ONLY about the exact book "${book.title}" by "${book.author}". Never substitute another book, even if its title is similar. USER INSTRUCTIONS ARE HARD CONSTRAINTS: ${instructions || 'Create a diverse quiz from the actual book content.'}. Generate EXACTLY ${count} questions. At least 80% must test concrete content: characters, events, relationships, actions, decisions, settings, chronology, causes, consequences, chapter details, themes tied to specific events, or distinctive facts. Do not pad with generic questions. Metadata is allowed only when relevant. Never invent quotations or unsupported facts. Use exactly four plausible options and one correct answer. Difficulty: ${difficulty}. Avoid these previous questions: ${recent.slice(-60).join(' | ')}. EVIDENCE PACK FOR THIS BOOK ONLY:\n${research.slice(0, 45000)}\nIf evidence is incomplete, use only facts you can confidently support from the evidence pack and your knowledge of this exact title; do not silently switch books. Return ONLY JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]}`; }

async function generateForBook(book: QuizBook, count: number, difficulty: string, instructions: string, recent: string[], research: string): Promise<QuizQuestion[]> {
  const requested = Math.max(0, Math.min(100, count)); if (!requested) return []; const key = await bookCacheKey(book, difficulty, instructions);
  const cached = await readSharedCache(key, recent); const accepted: QuizQuestion[] = []; const seen = new Set(recent.map(fingerprint));
  for (const q of cached) { const k = fingerprint(String(q.question || '')); if (k && !seen.has(k) && valid(q)) { accepted.push(q); seen.add(k); } }
  if (accepted.length >= requested) return accepted.slice(0, requested);
  const used = await quotaUsed(); if (used >= SOFT_DAILY_AI_BATCHES) throw new Error('AI_QUOTA_EXHAUSTED');
  let attempts = 0;
  while (accepted.length < requested && attempts < 5) {
    attempts++; const remaining = requested - accepted.length; const batch = remaining <= 5 ? remaining : Math.min(10, remaining); const prompt = buildPrompt(book, batch, difficulty, instructions, [...recent, ...accepted.map(q => q.question)], research) + `\nReturn exactly ${batch} new questions.`; let questions: QuizQuestion[] = [];
    try { questions = parse(await worker(prompt, Math.min(45000, 16000 + batch * 1800), 'quiz')); } catch { try { const r = await geminiFallback(prompt); questions = parse(r.response.text()); } catch {} }
    let added = 0; for (const q of questions) { const k = fingerprint(q.question); if (!k || seen.has(k) || accepted.some(x => similar(x.question, q.question)) || isMetadata(q)) continue; accepted.push(q); seen.add(k); added++; if (accepted.length >= requested) break; } if (!added) break;
  }
  if (accepted.length < requested) throw new Error(`AI generated ${accepted.length} of ${requested} verified questions for ${book.title}. Please try again.`); await recordQuota(); await writeSharedCache(key, accepted); return accepted.slice(0, requested);
}

export async function generateQuiz(books: QuizBook[], count: number, difficulty: string, instructions: string, recent: string[] = [], research = ''): Promise<QuizQuestion[]> {
  const requested = Math.min(100, Math.max(1, Number(count) || 10)); const selected = books.length ? books : [{ title: 'Selected book', author: 'Unknown' }]; const allocations = selected.map((book, i) => ({ book, count: Math.floor(requested / selected.length) + (i < requested % selected.length ? 1 : 0) })).filter(x => x.count > 0); const researchParts = research ? research.split(/\n(?=CURATED EVIDENCE|Book |Publication:|Book evidence:|Book subjects:)/) : [];
  const results = await Promise.all(allocations.map(async ({ book, count: bookCount }) => { const scoped = researchParts.filter(x => norm(x).includes(norm(book.title)) || norm(x).includes(norm(book.author))).join('\n') || research; return generateForBook(book, bookCount, difficulty, instructions, recent, scoped); }));
  const merged = results.flat(); const final: QuizQuestion[] = []; for (const q of merged) { if (final.some(x => similar(x.question, q.question))) continue; final.push(q); if (final.length >= requested) break; } if (final.length < requested) throw new Error(`Only ${final.length} verified questions were available. Please try again.`); return final.slice(0, requested);
}

export async function askEduwills(prompt: string, history: string[] = []) {
  const conversation = [...history.slice(-8), `Learner: ${prompt}`].join('\n'); const instruction = `You are EDUWILLS AI, a study assistant for learners. Answer directly and accurately. When the learner asks about a specific book, identify the exact title and author and do not substitute another book. Use the curated/research evidence when available and clearly say when evidence is insufficient. Keep answers concise but useful. Plain readable text only. Conversation:\n${conversation}`;
  try { return plain(await worker(instruction, 20000, 'chat')); } catch { try { const r = await geminiFallback(instruction); return plain(r.response.text()); } catch { return 'EDUWILLS AI is temporarily busy. Please try again in a moment.'; } }
}
export async function explainFailure(book: string, question: string, chosen: string, correct: string) { try { return plain(await worker(`Briefly explain why "${correct}" is correct for this question from ${book}: ${question}. The learner chose: ${chosen}. Plain text only.`, 12000, 'chat')); } catch { return `The correct answer is ${correct}. Review the relevant evidence in ${book}.`; } }
export async function generateRemarks(books: QuizBook[], score: number, total: number, percentage: number, difficulty: string, elapsed: number) { try { return plain(await worker(`Give one short encouraging performance remark for a learner who scored ${score}/${total} (${percentage}%) on a ${difficulty} quiz about ${books.map(b => `${b.title} by ${b.author}`).join('; ')}. Mention one strength and one next step. Plain text only.`, 12000, 'chat')); } catch { return percentage >= 80 ? 'Excellent work. Keep challenging yourself with harder questions.' : percentage >= 60 ? 'Good progress. Review the questions you missed and practise again.' : 'Keep going. Review the book carefully and try another quiz.'; } }
