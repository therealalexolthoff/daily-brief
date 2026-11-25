// Works out when editions are due. All maths is done in one time zone and is DST-safe.
export const EDITION_HOUR = 17; // 5 PM
export const TZ = process.env.NEWS_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;

function parts(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
  return Object.fromEntries(f.formatToParts(ms).map((p) => [p.type, Number(p.value)]));
}

// The instant at which a wall clock in `tz` shows the given date at `hour`:00.
function wallToUtc(y, m, d, hour, tz) {
  const target = Date.UTC(y, m - 1, d, hour);
  let ms = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(ms, tz);
    ms += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return ms;
}

// The most recent 5 PM at or before `now`, and the next one after it.
export function slots(now = Date.now(), tz = TZ) {
  const p = parts(now, tz);
  const today = wallToUtc(p.year, p.month, p.day, EDITION_HOUR, tz);
  const shift = (n) => {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
    return wallToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), EDITION_HOUR, tz);
  };
  return now >= today ? { current: today, next: shift(1) } : { current: shift(-1), next: today };
}

export function dateKey(ms, tz = TZ) {
  const p = parts(ms, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
