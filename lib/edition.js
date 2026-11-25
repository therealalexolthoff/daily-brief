import { SOURCES, SECTIONS } from './sources.js';
import { parseFeed } from './parse.js';

const UA = 'DailyBriefReader/1.0 (personal RSS reader)';
const WINDOW_MS = 24 * 3600e3;
const TIMEOUT_MS = 15e3;
const MAX_BYTES = 5e6;
const SIMILAR = 0.34;

async function fetchFeed(src) {
  const res = await fetch(src.url, {
    headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let size = 0;
  const chunks = [];
  for await (const c of res.body) {
    size += c.length;
    if (size > MAX_BYTES) throw new Error('feed too large');
    chunks.push(c);
  }
  const items = parseFeed(Buffer.concat(chunks).toString('utf8'));
  if (!items.length) throw new Error('no readable items');
  return items;
}

// --- Cleaning -------------------------------------------------------------
const SKIP_TITLE = /^(watch|live|video|listen|photos?|pictures?)\s*:|gift guide|newsletter|podcast|crossword|wordle|horoscope|best deals|black friday|cyber monday|\bquiz\b|week in pictures|how to watch|\d+% off|\$\d+ off|today in history|^morning bid\b|^look:|[–-] (live|as it happened)$|fantasy football/i;
const SKIP_URL = /\/(videos?|newsfeed|live-updates|av|gallery|audio|tv-shows|programme|sounds|wirecutter|opinion)\/|up-first-newsletter/i;

function cleanTitle(title, outlet) {
  let t = title.replace(/^\((?:\d\w\w )?(?:LEAD|LD|URGENT|News Focus|Yonhap Interview|EDITORIAL)[^)]*\)\s*/i, '');
  if (outlet === 'AP') t = t.replace(/\s+[-–|]\s+AP News$/i, '');
  if (outlet === 'Reuters') t = t.replace(/\s+[-–|]\s+Reuters(\.com)?$/i, '');
  return t.trim();
}

// --- Sections -------------------------------------------------------------
const URL_SECTION = [
  [/\/sports?\//i, 'Sports'], [/\/politics\//i, 'Politics'],
  [/\/(business|economy|markets|money)\//i, 'Business'], [/\/(technology|tech|ai|gadgets)\//i, 'Technology'],
  [/\/(science|health|space|environment)\//i, 'Science & Health'],
  [/\/(us|us-news|nation|national)\//i, 'U.S.'], [/\/(world|world-news|international|africa|asia|europe|middle-east)\//i, 'World'],
];
// Only used when neither the feed nor the URL names a section (AP and Reuters, mainly).
const WORD_SECTION = [
  [/\b(nfl|nba|mlb|nhl|fifa|afcon|premier league|champions league|quarterback|playoffs?|touchdown|grand slam|bowl game|olympics?|basketball|football|soccer|tennis)\b/i, 'Sports'],
  [/\b(senat\w+|house (gop|republicans|democrats|committee)|congress\w*|democrats?|republicans?|gop|midterms?|white house|supreme court|governor|ballot|lawmakers?|attorney general)\b/i, 'Politics'],
  [/\b(nasdaq|s&p 500|dow|stocks?|shares|wall street|fed|inflation|earnings|ipo|profit|revenue|merger|acquisition|bonds?|tariffs?|bank|investors?|ceo|oil prices?|economy)\b/i, 'Business'],
  [/\b(ai|openai|google|apple|microsoft|meta|chips?|software|cyber\w*|hack\w*|startup|robot\w*)\b/i, 'Technology'],
  [/\b(nasa|vaccin\w+|measles|study|scientists?|virus|cancer|climate|species|fda|hiv|outbreak|telescope)\b/i, 'Science & Health'],
  [/\b(russia\w*|ukrain\w*|china|chinese|iran\w*|israel\w*|gaza|putin|zelenskiy|zelenskyy|european?|eu|nato|india\w*|japan\w*|korea\w*|africa\w*|brazil|mexico|colombia|syria|lebanon|sudan|venezuela|vietnam\w*|hanoi|taiwan\w*|pakistan\w*|bangladesh\w*|turkish|turkey|houthis?|saudi|yemen|colombian?|canad\w+|australia\w*|uk|britain|france|french|germany|un)\b/i, 'World'],
];

function sectionHint(item, src) {
  const path = new URL(item.url).pathname;
  for (const [re, s] of URL_SECTION) if (re.test(path)) return { section: s, strength: 2 };
  if (WORD_SECTION[0][0].test(item.title)) return { section: 'Sports', strength: 2 };
  if (src.section) return { section: src.section, strength: 1.5 };
  for (const [re, s] of WORD_SECTION) if (re.test(item.title)) return { section: s, strength: 0.75 };
  return { section: 'U.S.', strength: 0.25 };
}

// --- Clustering: group the same story across outlets ----------------------
const STOP = new Set(('a an the and or but of to in on at by for from with as is are was were be been it its this that these those ' +
  'he she they his her their you your we our i after before over under into out up down off about amid than then not no new say says said ' +
  'will would could can may might has have had do does did how why what when where who which more most first last two one just now us u.s report reports here')
  .split(' '));

export function tokens(title) {
  const words = title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']s\b/g, '').replace(/[’']/g, '')
    .match(/[a-z0-9]+/g) ?? [];
  const out = words.filter((w) => w.length > 1 && !STOP.has(w)).map((w) => (w.length > 4 ? w.replace(/(ies|es|s|ed|ing)$/, '') : w));
  return [...new Set(out)];
}

function vectorise(items) {
  const df = new Map();
  for (const it of items) for (const t of (it.tok = tokens(it.title))) df.set(t, (df.get(t) ?? 0) + 1);
  for (const it of items) {
    it.vec = new Map(it.tok.map((t) => [t, Math.log(1 + items.length / df.get(t))]));
    it.norm = Math.hypot(...it.vec.values()) || 1;
  }
}

function cosine(a, b) {
  let dot = 0;
  let shared = 0;
  for (const [t, w] of a.vec) if (b.vec.has(t)) { dot += w * b.vec.get(t); shared++; }
  return shared < 2 ? 0 : dot / (a.norm * b.norm);
}

export function cluster(items) {
  vectorise(items);
  const groups = [];
  for (const it of items) {
    let best = null;
    let bestSim = SIMILAR;
    for (const g of groups) {
      const sims = g.map((m) => cosine(it, m));
      // Close to one member AND reasonably close to the whole group, so chains can't merge unrelated stories.
      const mean = sims.reduce((x, y) => x + y, 0) / sims.length;
      const max = Math.max(...sims);
      if (max >= bestSim && mean >= SIMILAR * 0.6) { best = g; bestSim = max; }
    }
    if (best) best.push(it); else groups.push([it]);
  }
  return groups;
}

// --- Ranking --------------------------------------------------------------
// How many headlines today mention the same two words ("huang" + "nvidia"): a measure
// of how big a running story is, even when its angles form separate clusters.
function pairCounts(items) {
  const counts = new Map();
  for (const it of items) {
    const t = [...it.tok].sort();
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
      const k = `${t[i]} ${t[j]}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return counts;
}

function hottestPair(group, pairs) {
  let best = ['', 1];
  // A pair only counts if at least half the group's headlines share it.
  for (const it of group) {
    const t = [...it.tok].sort();
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
      const k = `${t[i]} ${t[j]}`;
      const n = pairs.get(k);
      if (n <= best[1]) continue;
      const sharing = group.filter((g) => g.tok.includes(t[i]) && g.tok.includes(t[j])).length;
      if (sharing * 2 >= group.length) best = [k, n];
    }
  }
  return best;
}

function toStory(group, now, pairs) {
  const perOutlet = new Map();
  for (const it of [...group].sort((a, b) => b.published - a.published)) {
    if (!perOutlet.has(it.outlet)) perOutlet.set(it.outlet, it);
  }
  const members = [...perOutlet.values()];
  // Headline = the outlet wording closest to everyone else's; wires win near-ties.
  const lead = members
    .map((m) => ({ m, s: members.reduce((sum, o) => sum + (o === m ? 0 : cosine(m, o)), 0) * (m.type === 'wire' ? 1.15 : 1) * 0.5 ** ((now - m.published) / 3600e3 / 18) }))
    .sort((a, b) => b.s - a.s)[0].m;
  const votes = new Map();
  for (const it of group) votes.set(it.hint.section, (votes.get(it.hint.section) ?? 0) + it.hint.strength);
  const section = [...votes].sort((a, b) => b[1] - a[1])[0][0];
  const latest = Math.max(...members.map((m) => m.published));
  const ageH = Math.max(0, now - latest) / 3600e3;
  const coverage = members.reduce((s, m) => s + m.weight, 0);
  const [topic, heat] = hottestPair(group, pairs);
  const score = (coverage + (members.length >= 3 ? Math.log2(heat) : 0)) * 0.5 ** (ageH / 14) + Math.max(...group.map((m) => m.lead)) * 0.3;
  const pub = (m) => ({ outlet: m.outlet, type: m.type, title: m.title, url: m.url, published: m.published });
  return {
    ...pub(lead), latest, section, topic, score: Number(score.toFixed(3)),
    coverage: members.filter((m) => m !== lead).sort((a, b) => b.weight - a.weight).map(pub),
  };
}

const outletCount = (s) => s.coverage.length + 1;

function pick(stories, limit, perOutlet) {
  const used = new Map();
  const topics = new Map();
  const out = [];
  for (const s of stories) {
    if (out.length >= limit) break;
    const n = used.get(s.outlet) ?? 0;
    if (outletCount(s) === 1 && n >= perOutlet) continue;
    const t = topics.get(s.topic) ?? 0;
    if (s.topic && t >= 2) continue; // keep one running story from filling a section
    topics.set(s.topic, t + 1);
    used.set(s.outlet, n + 1);
    out.push(s);
  }
  return out;
}

export async function buildEdition({ slot, scheduled, now = Date.now() }) {
  const results = await Promise.allSettled(SOURCES.map(fetchFeed));
  const seen = new Set();
  const items = [];
  const sources = SOURCES.map((src, i) => {
    const r = results[i];
    const base = { outlet: src.outlet, type: src.type, section: src.section, via: src.via ?? null };
    if (r.status === 'rejected') return { ...base, ok: false, count: 0, error: r.reason?.cause?.code ?? r.reason?.message ?? 'failed' };
    let count = 0;
    r.value.forEach((raw, pos) => {
      const title = cleanTitle(raw.title, src.outlet);
      const age = now - raw.published;
      if (age > WINDOW_MS || age < -3600e3) return;
      if (title.split(' ').length < 4 || SKIP_TITLE.test(title) || SKIP_URL.test(raw.url)) return;
      const key = `${src.outlet}|${title.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      count++;
      const item = { ...raw, title, outlet: src.outlet, type: src.type, weight: src.weight, lead: 1 - Math.min(pos, 20) / 20 };
      item.hint = sectionHint(item, src);
      items.push(item);
    });
    return { ...base, ok: true, count, error: null };
  });

  const okFeeds = sources.filter((s) => s.ok).length;
  if (okFeeds < SOURCES.length / 3 || items.length < 40) {
    throw new Error(`only ${okFeeds}/${SOURCES.length} feeds answered (${items.length} headlines)`);
  }

  items.sort((a, b) => b.published - a.published);
  const groups = cluster(items);
  const pairs = pairCounts(items);
  const stories = groups.map((g) => toStory(g, now, pairs)).sort((a, b) => b.score - a.score);
  // Top stories need three or more outlets; a running story gets at most two slots.
  const perTopic = new Map();
  const top = stories.filter((s) => {
    if (s.section === 'Sports' || outletCount(s) < 3) return false;
    const n = perTopic.get(s.topic) ?? 0;
    if (s.topic) perTopic.set(s.topic, n + 1);
    return n < 2;
  }).slice(0, 9);
  const inTop = new Set(top);
  const rest = stories.filter((s) => !inTop.has(s));
  const sections = SECTIONS
    .map((name) => ({ name, stories: pick(rest.filter((s) => s.section === name), 9, 3) }))
    .filter((s) => s.stories.length);
  // The wire column: newest agency headlines, at most six per agency so no one floods it.
  const perAgency = new Map();
  const wire = items.filter((i) => {
    const n = perAgency.get(i.outlet) ?? 0;
    if (i.type !== 'wire' || n >= 6) return false;
    perAgency.set(i.outlet, n + 1);
    return true;
  }).map(({ outlet, title, url, published }) => ({ outlet, title, url, published }));

  return { slot, scheduled, compiledAt: now, headlineCount: items.length, top, wire, sections, sources };
}
