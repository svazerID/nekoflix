// Self-check for watch-history state transitions. Run: npx tsx scripts/history.check.ts
import { strict as assert } from 'node:assert';
import { mergeHistory, removeHistoryItem, HISTORY_LIMIT, DEMO_HISTORY_IDS } from '../src/services/history.js';
import type { WatchHistoryItem } from '../src/types/anime.js';

const base: WatchHistoryItem = {
  animeId: 'a', episodeId: 'e1', episodeNumber: 1, episodeTitle: 'Ep 1',
  progressSeconds: 100, durationSeconds: 1400, lastWatchedAt: Date.now(),
  animeTitle: 'Judul A', posterUrl: 'a.jpg',
};

const demo: WatchHistoryItem[] = [...DEMO_HISTORY_IDS].map((animeId) => ({
  ...base, animeId, episodeId: `${animeId}-e1`, animeTitle: 'Demo', posterUrl: '',
}));

// a real save scrubs the demo seed entries
let h = mergeHistory(demo, base);
assert.equal(h.length, 1, 'demo entries scrubbed on first save');
assert.equal(h[0].animeId, 'a');
assert.equal(h[0].animeTitle, 'Judul A', 'denormalized title kept');

// resaving the same episode updates in place (no duplicate)
h = mergeHistory(h, { ...base, progressSeconds: 500 });
assert.equal(h.length, 1, 'same episode does not duplicate');
assert.equal(h[0].progressSeconds, 500, 'progress updates');

// a save without a fresh duration keeps the previously known duration
h = mergeHistory(h, { ...base, progressSeconds: 600, durationSeconds: 0 });
assert.equal(h[0].durationSeconds, 1400, 'duration preserved when omitted');
assert.equal(h[0].animeTitle, 'Judul A', 'title preserved when omitted');

// newest first + capped at HISTORY_LIMIT
for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
  h = mergeHistory(h, { ...base, animeId: `x${i}`, episodeId: `xe${i}` });
}
assert.equal(h.length, HISTORY_LIMIT, 'capped at limit');
assert.equal(h[0].animeId, `x${HISTORY_LIMIT + 19}`, 'newest first');

// per-item removal
h = removeHistoryItem(h, h[0].animeId, h[0].episodeId);
assert.equal(h.length, HISTORY_LIMIT - 1);
assert.ok(!h.some((x) => x.animeId === `x${HISTORY_LIMIT + 19}`));

console.log('history.check OK');
