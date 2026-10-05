// Pure watch-history state transitions (no localStorage, no assets) so they can
// be unit-checked under Node. storageService owns the persistence side.
import { WatchHistoryItem } from '../types/anime';

// Seed entries returned by getWatchHistory() for a fresh profile — dropped as soon
// as the user actually watches something, so the demo list never sticks around.
export const DEMO_HISTORY_IDS = new Set(['solo-leveling-shadow-arise', 'frieren-beyond-journeys-end']);

// ponytail: newest 100 episodes; per-anime pruning if the list ever feels long
export const HISTORY_LIMIT = 100;

export function mergeHistory(current: WatchHistoryItem[], item: WatchHistoryItem): WatchHistoryItem[] {
  // Don't let the pre-seeded demo entries linger once real viewing starts.
  const scrubbed = current.filter((h) => !DEMO_HISTORY_IDS.has(h.animeId));
  const prev = scrubbed.find((h) => h.animeId === item.animeId && h.episodeId === item.episodeId);
  // Merge so an item without a fresh duration (e.g. metadata never loaded) keeps its old one.
  const merged: WatchHistoryItem = {
    ...prev,
    ...item,
    durationSeconds: item.durationSeconds || prev?.durationSeconds || 0,
    animeTitle: item.animeTitle || prev?.animeTitle,
    posterUrl: item.posterUrl || prev?.posterUrl,
  };
  const rest = scrubbed.filter((h) => !(h.animeId === item.animeId && h.episodeId === item.episodeId));
  return [merged, ...rest].slice(0, HISTORY_LIMIT);
}

export function removeHistoryItem(current: WatchHistoryItem[], animeId: string, episodeId: string): WatchHistoryItem[] {
  return current.filter((h) => !(h.animeId === animeId && h.episodeId === episodeId));
}
