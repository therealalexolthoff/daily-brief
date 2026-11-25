// Used by the hosted schedule. GitHub starts scheduled jobs late and only understands UTC, so
// jobs start early and this waits until exactly 5 PM in NEWS_TZ. Later runs are backups that
// only act if the 5 PM edition is missing. FORCE=1 builds right away.
import { appendFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { buildEdition } from '../lib/edition.js';
import { TZ, slots } from '../lib/schedule.js';
import { latest, save } from '../lib/store.js';

const MAX_WAIT = 65 * 60e3;
const output = (v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `published=${v}\n`);
// True if the live site is showing something other than the newest saved edition
// (an earlier run saved it but its deploy failed).
async function liveIsStale(saved) {
  if (!process.env.SITE_URL || !saved) return false;
  try {
    const r = await fetch(`${process.env.SITE_URL}/api/status.json?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15e3) });
    return !r.ok || (await r.json()).compiledAt !== saved.compiledAt;
  } catch {
    return true;
  }
}

const force = process.env.FORCE === '1';
const have = await latest();
let { current, next } = slots();

if (!force) {
  const missing = !have || have.slot < current;
  const wait = next - Date.now();
  if (!missing && wait > MAX_WAIT) {
    if (await liveIsStale(have)) {
      console.log(`Edition ${have.key} is saved but not live; deploying it again.`);
      output('true');
      process.exit();
    }
    console.log(`Nothing to do: latest 5 PM edition is in, next is ${Math.round(wait / 60e3)} min away (${TZ}).`);
    output('false');
    process.exit();
  }
  // Missed yesterday but today's is close? Wait and publish the fresh one.
  if (wait <= MAX_WAIT) {
    console.log(`Waiting ${Math.round(wait / 1000)}s for 5 PM ${TZ}`);
    while (Date.now() < next) await sleep(Math.min(next - Date.now(), 30e3));
    current = next;
  }
}

for (let attempt = 1; ; attempt++) {
  try {
    const now = Date.now();
    const e = await buildEdition({ slot: current, scheduled: now - current < 5 * 60e3 });
    const key = await save(e);
    const down = e.sources.filter((s) => !s.ok);
    console.log(`Published ${key}: ${e.headlineCount} headlines, scheduled=${e.scheduled}, ${e.sources.length - down.length}/${e.sources.length} feeds`);
    for (const s of down) console.log(`  unavailable: ${s.outlet} (${s.section ?? 'General'}): ${s.error}`);
    output('true');
    break;
  } catch (err) {
    console.error(`Attempt ${attempt} failed: ${err.message}`);
    if (attempt === 6) throw err;
    await sleep(30e3);
  }
}
