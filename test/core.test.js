import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, safeUrl } from '../lib/parse.js';
import { slots, dateKey } from '../lib/schedule.js';
import { cluster } from '../lib/edition.js';

const NY = 'America/New_York';
const iso = (ms) => new Date(ms).toISOString();

test('5 PM slots: before and after the hour', () => {
  let s = slots(Date.parse('2026-11-24T21:59:59Z'), NY);
  assert.equal(iso(s.current), '2026-11-23T22:00:00.000Z');
  assert.equal(iso(s.next), '2026-11-24T22:00:00.000Z');
  s = slots(Date.parse('2026-11-24T22:00:00Z'), NY);
  assert.equal(iso(s.current), '2026-11-24T22:00:00.000Z');
  assert.equal(dateKey(s.current, NY), '2026-11-24');
});

test('5 PM slots stay at 5 PM local across DST changes', () => {
  // Clocks go forward on 2027-03-14 and back on 2026-11-01 in New York.
  let s = slots(Date.parse('2027-03-13T23:00:00Z'), NY);
  assert.equal(iso(s.current), '2027-03-13T22:00:00.000Z');
  assert.equal(iso(s.next), '2027-03-14T21:00:00.000Z');
  s = slots(Date.parse('2026-10-31T22:00:00Z'), NY);
  assert.equal(iso(s.next), '2026-11-01T22:00:00.000Z');
});

test('parses RSS, CDATA, double-encoded entities and Atom links', () => {
  const rss = `<rss><item><title><![CDATA[Bank&#8217;s &amp;amp; <b>rates</b>]]></title><link>https://a.test/1</link><pubDate>Tue, 24 Nov 2026 16:00:00 -0500</pubDate></item></rss>`;
  assert.deepEqual(parseFeed(rss)[0], { title: 'Bank’s & rates', url: 'https://a.test/1', published: Date.parse('2026-11-24T21:00:00Z') });
  const atom = `<feed><entry><title>Hi there</title><link rel="alternate" href="https://b.test/2"/><published>2026-11-24T16:00:00-05:00</published></entry></feed>`;
  assert.equal(parseFeed(atom)[0].url, 'https://b.test/2');
});

test('rejects non-http links', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,x'), null);
});

test('clusters the same story and keeps different ones apart', () => {
  const g = cluster([
    'Pope Francis diary reveals spiritual crisis', 'Pope Francis described spiritual crisis in private diary',
    'Huawei found guilty of stealing trade secrets', 'Jury finds Huawei guilty of trade secrets theft',
    'Gold falls ahead of inflation data',
  ].map((title) => ({ title })));
  assert.deepEqual(g.map((x) => x.length).sort(), [1, 2, 2]);
});
