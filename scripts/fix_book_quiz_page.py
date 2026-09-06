from pathlib import Path
import re

# Quiz setup page: use the robust multi-source author search instead of duplicating
# two fragile API calls in the UI.
page = Path('app/dashboard/quiz/page.tsx')
p = page.read_text()
if '  searchBookAuthors,\n' not in p:
    p = p.replace('  researchBooks,\n', '  researchBooks,\n  searchBookAuthors,\n', 1)
find_re = re.compile(r'  async function findBook\(\) \{[\s\S]*?\n  \}\n\n  async function searchAuthor', re.M)
find_new = '''  async function findBook() {
    const raw = title.trim();
    if (!raw) return;
    setSearching(true);
    setMessage('');
    setAuthors([]);
    setAuthor('');
    setAuthorQuery('');
    try {
      const results = await searchBookAuthors('title', raw);
      const curated = CURATED_BOOKS.filter((b) =>
        [b.title, ...b.aliases].some((a) => normalize(a).includes(normalize(raw)) || normalize(raw).includes(normalize(a)))
      );
      const names = Array.from(new Set([...curated.flatMap((b) => b.authors), ...results.flatMap((r) => r.authors)]));
      setAuthors(names.slice(0, 80));
      setMessage(names.length ? 'Select the verified author that matches your book.' : 'No author was found. Try the full title or search by author name.');
    } catch {
      setMessage('Book search is temporarily unavailable.');
    } finally {
      setSearching(false);
    }
  }

  async function searchAuthor'''
p, n = find_re.subn(find_new, p, count=1)
if n != 1:
    raise SystemExit('findBook replacement failed')
author_re = re.compile(r'  async function searchAuthor\(\) \{[\s\S]*?\n  \}\n\n  async function saveBook', re.M)
author_new = '''  async function searchAuthor() {
    const q = authorQuery.trim();
    if (!q) return;
    setSearching(true);
    setMessage('');
    try {
      const results = await searchBookAuthors('author', q);
      const names = Array.from(new Set(results.flatMap((r) => r.authors)));
      setAuthors(names.slice(0, 80));
      setMessage(names.length ? 'Select a verified author from the results.' : 'No verified author match was found. Try another spelling.');
    } finally {
      setSearching(false);
    }
  }

  async function saveBook'''
p, n = author_re.subn(author_new, p, count=1)
if n != 1:
    raise SystemExit('searchAuthor replacement failed')
page.write_text(p)

# Stable generator: widen research sources and make the already-researched payload
# reusable instead of forcing another research round.
stable = Path('lib/quizAiClientStable.ts')
s = stable.read_text()
s = s.replace("const CACHE_VERSION = 'v30-explanation-timer-gateway-first';", "const CACHE_VERSION = 'v31-book-intelligence-instructions-cache-first';")
s = s.replace('ai-gateway.json?v=30', 'ai-gateway.json?v=31')
s = s.replace("  const evidenceByBook = await Promise.all(books.map(async (book) => researchBooks([book])));", "  const evidenceByBook = _research.trim() ? books.map(() => _research) : await Promise.all(books.map(async (book) => researchBooks([book])));")
old = "      `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}+inauthor:${author}&maxResults=20`,\n      `https://openlibrary.org/search.json?title=${title}&author=${author}&limit=30&fields=title,author_name,first_sentence,subject,description,first_publish_year,publisher`,"
new = old + ",\n      `https://archive.org/advancedsearch.php?q=title:(${title})%20AND%20creator:(${author})&fl[]=title&fl[]=creator&fl[]=description&fl[]=subject&fl[]=date&rows=20&page=1&output=json`"
s = s.replace(old, new)
# Make user instructions explicit enough that the model cannot silently substitute its own topic.
s = s.replace("  return `You are EDUWILLS Book Intelligence AI.\\n\\nGenerate EXACTLY ${count} factual multiple-choice questions about ONLY this exact book: ${book.title} by ${book.author}.", "  const userMode = instructions.trim()\n    ? `MANDATORY USER INSTRUCTIONS (HIGHEST PRIORITY AFTER SAFETY AND FACTUALITY): ${instructions.trim()}\\nEvery generated question MUST visibly follow these instructions. Do not replace, dilute, ignore, or reinterpret them.`\n    : `NO USER INSTRUCTIONS WERE PROVIDED. Create a balanced, varied quiz across characters, relationships, events, chronology, settings, causes and consequences, themes, conflicts, language/style, symbols, decisions, and distinctive book-specific details.`;\n  return `You are EDUWILLS Book Intelligence AI.\\n\\nGenerate EXACTLY ${count} factual multiple-choice questions about ONLY this exact book: ${book.title} by ${book.author}.\\n\\n${userMode}")
stable.write_text(s)

# Add a verified grounding profile for the 2026 JAMB text.
grounding = Path('lib/verifiedBookGrounding.ts')
g = grounding.read_text()
if "'lekki headmaster|kabir alabi garba'" not in g:
    marker = "  'scars|irabor': ["
    insert = """  'lekki headmaster|kabir alabi garba': [
    'VERIFIED BOOK: The Lekki Headmaster, by Kabir Alabi Garba; first published in Nigeria by Winepress Publishing in 2023.',
    'BOOK FACT: The novel is the JAMB general text for the 2026 UTME.',
    'BOOK FACT: The story centres on Mr. Adebepo Adewale, commonly called Bepo, the principal/headmaster of Stardom Schools in Lekki, Lagos.',
    'BOOK FACT: The narrative examines education, migration/japa pressure, patriotism, professional commitment, leadership, integrity, and challenges within Nigerian schooling and society.',
    'BOOK FACT: Major settings include Stardom Schools in Lekki, Lagos, and Badagry, with the story also involving travel and migration decisions.',
    'GROUNDING RULE: Do not import characters, events, or plot details from unrelated books. Prefer verified book-specific evidence over generic summaries.',
    'GROUNDING RULE: If secondary sources disagree on a minor detail, do not invent it; use only evidence supported by the available sources.'
  ].join('\\n'),
"""
    g = g.replace(marker, insert + marker, 1)
    anchor = "  'scars|irabor': ["
    anchors = "  'lekki headmaster|kabir alabi garba': ['lekki headmaster', 'kabir alabi garba', 'bepo', 'adewale', 'stardom schools', 'headmaster', 'principal', 'lekki', 'lagos', 'badagry', 'japa', 'migration', 'education', 'teacher', 'school', 'patriotism', 'leadership', 'integrity', 'teachers'],\n"
    g = g.replace(anchor, anchors + anchor, 1)
    grounding.write_text(g)

print('EduWills book intelligence production patch applied.')
