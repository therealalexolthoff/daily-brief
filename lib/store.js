import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dateKey } from './schedule.js';

const DIR = process.env.NEWS_DATA || join(import.meta.dirname, '..', 'data');
const KEEP = 60;
export const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function listKeys() {
  const names = await readdir(DIR).catch(() => []);
  return names.filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5)).filter((k) => KEY_RE.test(k)).sort().reverse();
}

export async function load(key) {
  if (!KEY_RE.test(key)) return null;
  try {
    return JSON.parse(await readFile(join(DIR, `${key}.json`), 'utf8'));
  } catch {
    return null;
  }
}

export async function latest() {
  for (const k of await listKeys()) {
    const e = await load(k);
    if (e) return { key: k, ...e };
  }
  return null;
}

export async function save(edition) {
  await mkdir(DIR, { recursive: true });
  // One edition per calendar day: the 5 PM build replaces any off-schedule one from earlier that day.
  const key = dateKey(edition.compiledAt);
  const tmp = join(DIR, `.${key}.tmp`);
  await writeFile(tmp, JSON.stringify(edition));
  await rename(tmp, join(DIR, `${key}.json`)); // atomic: readers never see half an edition
  for (const old of (await listKeys()).slice(KEEP)) await unlink(join(DIR, `${old}.json`)).catch(() => {});
  return key;
}
