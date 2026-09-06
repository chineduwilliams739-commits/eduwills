from pathlib import Path
import re

path = Path('app/dashboard/quiz/page.tsx')
p = path.read_text()

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
        [b.title, ...b.aliases].some((a) =>
          normalize(a).includes(normalize(raw)) || normalize(raw).includes(normalize(a))
        )
      );
      const names = Array.from(new Set([
        ...curated.flatMap((b) => b.authors),
        ...results.flatMap((r) => r.authors),
      ]));
      setAuthors(names.slice(0, 80));
      setMessage(names.length
        ? 'Select the verified author that matches your book.'
        : 'No author was found. Try the full title or search by author name.');
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
      setMessage(names.length
        ? 'Select a verified author from the results.'
        : 'No verified author match was found. Try another spelling.');
    } finally {
      setSearching(false);
    }
  }

  async function saveBook'''
p, n = author_re.subn(author_new, p, count=1)
if n != 1:
    raise SystemExit('searchAuthor replacement failed')

path.write_text(p)
print('Book quiz page repaired.')
