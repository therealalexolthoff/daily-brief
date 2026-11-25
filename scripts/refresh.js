// Rebuild the current edition by hand: npm run refresh
import { buildEdition } from '../lib/edition.js';
import { slots } from '../lib/schedule.js';
import { save } from '../lib/store.js';

const e = await buildEdition({ slot: slots().current, scheduled: false });
console.log(`Saved ${await save(e)}: ${e.headlineCount} headlines, ${e.sources.filter((s) => s.ok).length}/${e.sources.length} feeds`);
