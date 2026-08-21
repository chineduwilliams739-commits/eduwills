import fs from 'node:fs';

const feeds = [
  ['Education Nigeria', 'https://news.google.com/rss/search?q=education+Nigeria+when%3A7d&hl=en-NG&gl=NG&ceid=NG%3Aen'],
  ['Education', 'https://news.google.com/rss/search?q=education+schools+universities+when%3A7d&hl=en&gl=US&ceid=US%3Aen'],
  ['JAMB & admissions', 'https://news.google.com/rss/search?q=JAMB+admissions+WAEC+NECO+when%3A14d&hl=en-NG&gl=NG&ceid=NG%3Aen'],
  ['Global education', 'https://news.google.com/rss/search?q=UNESCO+education+students+teachers+when%3A14d&hl=en&gl=US&ceid=US%3Aen']
];

function unescapeXml(s = '') { return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function stripHtml(s = '') { return unescapeXml(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function tag(block, name) { const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? stripHtml(m[1]) : ''; }
function items(xml, fallbackSource) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]).map(block => ({
    title: tag(block, 'title'),
    link: unescapeXml((block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim()),
    source: tag(block, 'source') || fallbackSource,
    publishedAt: tag(block, 'pubDate'),
    description: stripHtml(tag(block, 'description')).slice(0, 260)
  })).filter(x => x.title && x.link);
}

const all = [];
for (const [source, url] of feeds) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'EDUWILLS-Education-News/1.0' } });
    if (!r.ok) continue;
    all.push(...items(await r.text(), source));
  } catch {}
}

const seen = new Set();
const cleaned = all.filter(x => {
  const key = x.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!key || seen.has(key)) return false;
  seen.add(key); return true;
}).slice(0, 24);

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/education-news.json', JSON.stringify({ generatedAt: new Date().toISOString(), items: cleaned }, null, 2));
console.log(`Published ${cleaned.length} education news items.`);
