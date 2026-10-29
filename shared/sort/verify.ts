// Server-side verification of leaderboard submissions. Levels are regenerated from seeds
// and the submitted action logs are replayed, so scores can't simply be POSTed.
import { blitzLevel, dailyLevel, type Level, type SortGameId } from './levels.ts';
import { BLITZ_BONUS_MS, BLITZ_MS, MIN_MS_PER_MOVE, scoreLevel } from './scoring.ts';
import { replay } from './session.ts';

export type Verdict = { ok: true; score: number; detail: Record<string, number> } | { ok: false; error: string };

const dailyCache = new Map<string, Level>();
function cachedDaily(game: SortGameId, date: string): Level {
  const key = `${game}:${date}`;
  let lvl = dailyCache.get(key);
  if (!lvl) {
    lvl = dailyLevel(game, date);
    if (dailyCache.size > 24) dailyCache.clear();
    dailyCache.set(key, lvl);
  }
  return lvl;
}

export function verifyDaily(game: SortGameId, date: string, actions: unknown, timeMs: unknown): Verdict {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'bad date' };
  if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs <= 0)
    return { ok: false, error: 'bad time' };
  const level = cachedDaily(game, date);
  const stats = replay(level, actions);
  if (!stats) return { ok: false, error: 'illegal move log' };
  if (!stats.solved) return { ok: false, error: 'puzzle not solved' };
  if (timeMs < stats.moves * MIN_MS_PER_MOVE) return { ok: false, error: 'implausible time' };
  const score = scoreLevel(level, stats, timeMs);
  return {
    ok: true,
    score: score.total,
    detail: { moves: stats.moves, stars: score.stars, timeMs: Math.round(timeMs) },
  };
}

export interface BlitzLevelLog {
  actions: unknown;
  timeMs: number;
}

export function verifyBlitz(game: SortGameId, runSeed: string, levels: unknown): Verdict {
  if (!/^[a-z0-9]{4,16}$/.test(runSeed)) return { ok: false, error: 'bad seed' };
  if (!Array.isArray(levels) || levels.length === 0 || levels.length > 60)
    return { ok: false, error: 'bad levels' };
  let total = 0;
  let elapsed = 0;
  let solved = 0;
  for (let i = 0; i < levels.length; i++) {
    const entry = levels[i] as BlitzLevelLog;
    if (typeof entry?.timeMs !== 'number' || entry.timeMs <= 0) return { ok: false, error: 'bad time' };
    elapsed += entry.timeMs;
    const level = blitzLevel(game, runSeed, i);
    const stats = replay(level, entry.actions);
    if (!stats) return { ok: false, error: `illegal log at level ${i + 1}` };
    if (!stats.solved) return { ok: false, error: `level ${i + 1} not solved` };
    if (entry.timeMs < stats.moves * MIN_MS_PER_MOVE) return { ok: false, error: 'implausible time' };
    total += scoreLevel(level, stats, entry.timeMs, { timeBonus: false }).total;
    solved++;
  }
  if (elapsed > BLITZ_MS + solved * BLITZ_BONUS_MS + 3000) return { ok: false, error: 'run too long' };
  return { ok: true, score: total, detail: { solved } };
}
