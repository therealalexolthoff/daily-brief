// Feed text is untrusted: everything is inserted as text nodes, never as HTML.
const $ = (id) => document.getElementById(id);
const POLL_MS = 30e3;
let tz;
let nextAt = null;
let skew = 0; // server clock minus this browser's clock
let shown = null; // { key, compiledAt } on screen
let pinned = null; // archive key being read, or null for the latest
let polling = false;

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids.filter((k) => k != null));
  return n;
}
const link = (s) => el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title);
const fmt = (ms, o) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(ms);
const clock = (ms) => fmt(ms, { hour: 'numeric', minute: '2-digit' });
const day = (ms) => fmt(ms, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

function meta(s) {
  return el('p', { class: 'meta' },
    el('b', { class: s.type === 'wire' ? 'wire-tag' : null }, s.outlet), ` · ${clock(s.latest)}`);
}

function also(s) {
  if (!s.coverage.length) return null;
  const n = s.coverage.length;
  return el('details', { class: 'also' },
    el('summary', {}, `${n} more ${n === 1 ? 'outlet' : 'outlets'}`),
    el('ul', {}, ...s.coverage.map((c) => el('li', {}, el('span', {}, `${c.outlet}: `), link(c)))));
}

const story = (s, level) => el('article', {}, el(level, { class: 'hed' }, link(s)), meta(s), also(s));

function wireColumn(wire) {
  const FIRST = 12;
  const li = wire.map((w) => el('li', {},
    el('time', { datetime: new Date(w.published).toISOString() }, clock(w.published)),
    el('div', {}, el('span', { class: 'agency' }, w.outlet), link(w))));
  const ol = el('ol', {}, ...li.slice(0, FIRST));
  const box = el('aside', { class: 'wire', id: 'wire', 'aria-labelledby': 'wire-h' }, el('h2', { class: 'label', id: 'wire-h' }, 'The wires'), ol);
  if (li.length > FIRST) {
    const b = el('button', { class: 'more', type: 'button' }, `Show ${li.length - FIRST} more`);
    b.onclick = () => { ol.append(...li.slice(FIRST)); b.remove(); };
    box.append(b);
  }
  return box;
}

function footer(e) {
  const ok = e.sources.filter((s) => s.ok).length;
  const rows = e.sources.map((s) => el('tr', {},
    el('td', {}, s.via ? `${s.outlet} (via ${s.via})` : s.outlet),
    el('td', {}, s.type === 'wire' ? 'News wire' : 'RSS'),
    el('td', {}, s.section ?? 'General'),
    el('td', { class: 'n' }, s.ok ? `${s.count} headlines` : `Unavailable (${s.error})`)));
  return el('details', {},
    el('summary', {}, `${e.headlineCount} headlines from the past 24 hours, ${ok} of ${e.sources.length} feeds answered`),
    el('table', {}, el('thead', {}, el('tr', {}, ...['Source', 'Type', 'Section', 'This edition'].map((h) => el('th', { scope: 'col' }, h)))), el('tbody', {}, ...rows)));
}

function render(e) {
  shown = { key: e.key, compiledAt: e.compiledAt };
  const name = e.scheduled ? '5 PM edition' : 'Off-schedule edition';
  $('dateline').replaceChildren(el('strong', {}, day(e.compiledAt)), ` · ${name}, compiled ${clock(e.compiledAt)}`);

  const main = $('main');
  const [lead, ...others] = e.top;
  const front = el('section', { 'aria-labelledby': 'top-h' }, el('h2', { class: 'label', id: 'top-h' }, 'Top stories'));
  if (lead) {
    const a = story(lead, 'h3');
    a.className = 'lead';
    front.append(a, el('div', { class: 'top-list' }, ...others.map((s) => story(s, 'h3'))));
  } else front.append(el('p', { class: 'empty' }, 'No story was carried by three or more outlets in this edition.'));

  main.replaceChildren(
    el('div', { class: 'front' }, front, wireColumn(e.wire)),
    ...e.sections.map((s) => el('section', { class: 'section', id: slug(s.name), 'aria-labelledby': `${slug(s.name)}-h` },
      el('h2', { class: 'label', id: `${slug(s.name)}-h` }, s.name),
      el('div', { class: 'section-list' }, ...s.stories.map((x) => story(x, 'h3'))))));
  $('nav').replaceChildren(el('a', { href: '#main' }, 'Top stories'), el('a', { href: '#wire' }, 'The wires'),
    ...e.sections.map((s) => el('a', { href: `#${slug(s.name)}` }, s.name)));
  $('footer').replaceChildren(footer(e));
}

function notice(msg) {
  $('notice').hidden = !msg;
  $('notice').textContent = msg ?? '';
}

function fillArchive(keys) {
  const label = (k) => fmt(Date.parse(`${k}T12:00:00Z`), { weekday: 'short', month: 'short', day: 'numeric' });
  const sel = $('archive');
  sel.replaceChildren(...keys.map((k, i) => el('option', { value: i ? k : '' }, i ? label(k) : 'Latest')));
  sel.value = pinned ?? '';
}

async function get(path) {
  // Static hosts may cache for minutes; a changing query string gets the current file.
  const r = await fetch(`${path}?t=${Math.floor(Date.now() / 10e3)}`, { cache: 'no-store' });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const s = await get('api/status.json');
    tz = s.timeZone;
    nextAt = s.next;
    skew = s.now ? s.now - Date.now() : 0; // a static host has no live clock
    if (!s.key) {
      $('main').replaceChildren(el('p', { class: 'empty' }, s.lastError ? `The first edition could not be compiled: ${s.lastError}. Retrying shortly.` : 'Compiling the first edition…'));
      setTimeout(poll, 2000);
      return;
    }
    const stale = !shown || shown.key !== s.key || shown.compiledAt !== s.compiledAt;
    if (pinned === null && stale) {
      render(await get(`api/editions/${s.key}.json`));
      fillArchive(s.archive);
    } else if (!$('archive').options.length || pinned !== null) fillArchive(s.archive);
    if (pinned === null) notice(s.lastError ? `The latest update failed (${s.lastError}). Showing the previous edition while it retries.` : null);
  } catch {
    notice('Can’t reach the site. Showing the last edition loaded.');
  } finally {
    polling = false;
  }
}

$('archive').onchange = async (ev) => {
  pinned = ev.target.value || null;
  if (pinned === null) { shown = null; notice(null); return poll(); }
  try {
    render(await get(`api/editions/${pinned}.json`));
    notice('You’re reading a past edition. Choose “Latest” to return.');
  } catch {
    notice('That edition is no longer available.');
  }
};

function tickClock() {
  if (!nextAt) return;
  const left = nextAt - (Date.now() + skew);
  const t = clock(nextAt);
  if (left <= 0) {
    $('next-label').textContent = `${t} edition`;
    $('countdown').textContent = 'Compiling…';
    if (left < -10 * 60e3) $('countdown').textContent = 'Running late';
    if (Math.floor(left / 1000) % 10 === 0) poll();
    return;
  }
  const s = Math.ceil(left / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  $('next-label').textContent = `Next edition at ${t} in`;
  $('countdown').textContent = `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

poll();
setInterval(poll, POLL_MS);
setInterval(tickClock, 1000);
