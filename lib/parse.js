// Small, tolerant RSS 2.0 / RDF / Atom reader. Feed content is untrusted:
// everything returned is plain text, and links are limited to http(s).
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', eacute: 'é', egrave: 'è', agrave: 'à', uuml: 'ü',
  ouml: 'ö', auml: 'ä', ccedil: 'ç', ntilde: 'ñ', pound: '£', euro: '€', copy: '©', reg: '®', trade: '™',
};
const codePoint = (n) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (/^#x/i.test(e)) return codePoint(parseInt(e.slice(2), 16));
    if (e[0] === '#') return codePoint(parseInt(e.slice(1), 10));
    return NAMED[e.toLowerCase()] ?? m;
  });
}

function rawTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

// Twice-encoded titles (&amp;#8217;) are common, hence the double decode.
const text = (s) => decode(decode(s)).replace(/<\/?[a-z][^>]*>/gi, '').replace(/\s+/g, ' ').trim();

export function safeUrl(s) {
  try {
    const u = new URL(decode(s).trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

function linkOf(block) {
  const direct = safeUrl(rawTag(block, 'link'));
  if (direct) return direct;
  const tags = block.match(/<link\s[^>]*>/gi) ?? [];
  const alt = tags.find((t) => /rel=["']alternate["']/i.test(t)) ?? tags.find((t) => !/rel=/i.test(t));
  return safeUrl(alt?.match(/href=["']([^"']+)["']/i)?.[1] ?? '');
}

// Zone abbreviations Date.parse gets wrong or rejects.
const ZONES = { BST: '+0100', CET: '+0100', CEST: '+0200', KST: '+0900' };
function dateOf(block) {
  const raw = rawTag(block, 'pubDate') || rawTag(block, 'dc:date') || rawTag(block, 'published') || rawTag(block, 'updated');
  const t = Date.parse(raw.replace(/\b(BST|CES?T|KST)$/, (z) => ZONES[z]));
  return Number.isNaN(t) ? null : t;
}

export function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  return blocks
    .map((b) => ({ title: text(rawTag(b, 'title')), url: linkOf(b), published: dateOf(b) }))
    .filter((i) => i.title && i.url && i.published);
}
