// Write the whole site as static files into site/, for any static host.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EDITION_HOUR, TZ, slots } from '../lib/schedule.js';
import { latest, listKeys, load } from '../lib/store.js';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'site');
const newest = await latest();
if (!newest) throw new Error('no saved editions: run npm run refresh first');

rmSync(OUT, { recursive: true, force: true });
cpSync(join(ROOT, 'public'), OUT, { recursive: true });
mkdirSync(join(OUT, 'api', 'editions'), { recursive: true });
const archive = [];
for (const key of await listKeys()) {
  const e = await load(key);
  if (!e) continue;
  archive.push(key);
  writeFileSync(join(OUT, 'api', 'editions', `${key}.json`), JSON.stringify({ key, ...e }));
}
writeFileSync(join(OUT, 'api', 'status.json'), JSON.stringify({
  key: newest.key, compiledAt: newest.compiledAt, next: slots().next, timeZone: TZ, editionHour: EDITION_HOUR, lastError: null, archive,
}));
console.log(`site/ written: ${archive.length} edition(s), latest ${newest.key}`);
