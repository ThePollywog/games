import type { Level } from './levels.ts';
import type { SessionStats } from './session.ts';

export const PENALTY = { undo: 20, hint: 150, extra: 300, restart: 100 };

export interface ScoreBreakdown {
  base: number;
  efficiency: number;
  time: number;
  combo: number;
  penalties: number;
  total: number;
  stars: 1 | 2 | 3;
}

export function starsFor(par: number, s: SessionStats): 1 | 2 | 3 {
  if (s.hints === 0 && s.extras === 0 && s.moves <= par) return 3;
  if (s.moves <= Math.ceil(par * 1.3)) return 2;
  return 1;
}

export function scoreLevel(
  level: Level,
  s: SessionStats,
  timeMs: number,
  opts: { timeBonus?: boolean } = {},
): ScoreBreakdown {
  const { colors, mystery } = level.config;
  const base = colors * 100 + Math.round(mystery * colors * 60);
  const ratio = Math.min(1, level.par / Math.max(1, s.moves));
  const efficiency = Math.round(ratio * ratio * colors * 120);
  // Time budget scales with the puzzle: ~12s per color, or more for move-heavy games (Ball Sort).
  const budget = Math.max(colors * 12, level.par * 1.8);
  const time = opts.timeBonus === false ? 0 : Math.max(0, Math.round((budget - timeMs / 1000) * 8));
  const penalties =
    s.undos * PENALTY.undo +
    s.hints * PENALTY.hint +
    s.extras * PENALTY.extra +
    s.restarts * PENALTY.restart;
  const total = Math.max(0, base + efficiency + time + s.comboBonus - penalties);
  return { base, efficiency, time, combo: s.comboBonus, penalties, total, stars: starsFor(level.par, s) };
}

/** Humans can't pour faster than this; anything quicker is a bot or a forged log. */
export const MIN_MS_PER_MOVE = 120;
export const BLITZ_MS = 120_000;
/** Each Blitz solve adds this much time back to the clock. */
export const BLITZ_BONUS_MS = 5_000;
