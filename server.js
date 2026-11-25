import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildEdition } from './lib/edition.js';
import { EDITION_HOUR, TZ, slots } from './lib/schedule.js';
import { latest, listKeys, load, save, KEY_RE } from './lib/store.js';

const PORT = Number(process.env.PORT) || 5170;
const HOST = process.env.HOST || '127.0.0.1';
const CHECK_MS = 5e3;
const RETRY_MIN_MS = 10e3;
const RETRY_MAX_MS = 2 * 60e3;

// --- The daily 5 PM job ---------------------------------------------------
// Rather than one long timer (which a sleeping laptop would miss), check every few
// seconds whether the most recent 5 PM has an edition yet, and build it if not.
let building = false;
let retryAt = 0;
let failures = 0;
let lastTick = Date.now();
let lastError = null;

async function tick() {
  // A long gap between checks means the computer was asleep: forget the back-off and try now.
  if (Date.now() - lastTick > CHECK_MS * 6) { retryAt = 0; failures = 0; }
  lastTick = Date.now();
  if (building || Date.now() < retryAt) return;
  building = true;
  try {
    const { current } = slots();
    const have = await latest();
    if (have && have.slot >= current) return;
    const edition = await buildEdition({ slot: current, scheduled: Date.now() - current < 5 * 60e3 });
    const key = await save(edition);
    lastError = null;
    failures = 0;
    console.log(`${new Date().toISOString()} published ${key}: ${edition.headlineCount} headlines, scheduled=${edition.scheduled}`);
  } catch (err) {
    lastError = err.message;
    const wait = Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** failures++);
    retryAt = Date.now() + wait; // the previous edition stays up meanwhile
    console.error(`${new Date().toISOString()} edition failed: ${err.message}; retrying in ${wait / 1000}s`);
  } finally {
    building = false;
  }
}

// --- HTTP -----------------------------------------------------------------
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};
const HEADERS = {
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-cache',
};

function json(res, status, body) {
  res.writeHead(status, { ...HEADERS, 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });

    if (pathname === '/api/status.json') {
      const e = await latest();
      return json(res, 200, {
        key: e?.key ?? null, compiledAt: e?.compiledAt ?? null, next: slots().next, now: Date.now(),
        timeZone: TZ, editionHour: EDITION_HOUR, building, lastError, archive: await listKeys(),
      });
    }
    const m = pathname.match(/^\/api\/editions\/([^/]+)\.json$/);
    if (m) {
      const e = KEY_RE.test(m[1]) ? await load(m[1]) : null;
      return e ? json(res, 200, { key: m[1], ...e }) : json(res, 404, { error: 'no such edition' });
    }
    const file = STATIC[pathname];
    if (!file) return json(res, 404, { error: 'not found' });
    const body = await readFile(join(import.meta.dirname, 'public', file[0]));
    res.writeHead(200, { ...HEADERS, 'content-type': file[1] });
    res.end(body);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`The Daily Brief: http://localhost:${PORT} (new edition daily at ${EDITION_HOUR}:00 ${TZ})`);
  tick();
  setInterval(tick, CHECK_MS);
});
