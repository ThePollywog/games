import type { Level, SortGameId } from '../../../shared/sort/levels.ts';
import type { ScoreBreakdown } from '../../../shared/sort/scoring.ts';
import type { SessionStats } from '../../../shared/sort/session.ts';
import { syncStats } from '../../platform/api';
import { updateSort, useArcade } from '../../platform/store';

export type Mode = 'campaign' | 'daily' | 'zen' | 'blitz';

export interface Rewards {
  xp: number;
  coins: number;
  streak: { count: number; coins: number } | null;
  firstClear: boolean;
}

export interface Outcome {
  game: SortGameId;
  mode: Mode;
  level: Level;
  stats: SessionStats;
  score: ScoreBreakdown;
  timeMs: number;
  campaignLevel?: number;
  date?: string;
}

/** Counts a play of any arcade game (drives the "try everything" achievement). */
export function countPlay(game: string) {
  const s = useArcade.getState();
  useArcade.setState({ stats: { ...s.stats, played: { ...s.stats.played, [game]: (s.stats.played[game] ?? 0) + 1 } } });
}

/** Applies a solved puzzle to the player's profile and returns what they earned. */
export function awardSolve(o: Outcome): Rewards {
  const store = useArcade.getState();
  const { colors, mystery } = o.level.config;
  const { stars } = o.score;
  let xp = 10 + colors * 3 + stars * 6 + o.stats.maxCombo * 4;
  let coins = stars * 4 + Math.max(0, o.stats.maxCombo - 1) * 3;
  let firstClear = false;
  let perfect = stars === 3;

  const prog = store.sort[o.game];
  const next = { ...prog, stars: { ...prog.stars }, daily: { ...prog.daily } };

  if (o.mode === 'campaign' && o.campaignLevel) {
    const n = o.campaignLevel;
    const prev = next.stars[n] ?? 0;
    firstClear = prev === 0;
    perfect = stars === 3 && prev < 3; // replays can't farm the perfect counter
    if (!firstClear) {
      // Replays pay out only for improving stars.
      xp = Math.round(xp * 0.25);
      coins = Math.max(0, stars - prev) * 5;
    }
    if (n % 10 === 0 && firstClear) coins += 40;
    next.stars[n] = Math.max(prev, stars);
    if (n >= next.level) next.level = n + 1;
  } else if (o.mode === 'daily' && o.date) {
    // Mirrors the server: only the first solve of the day is ranked and rewarded.
    firstClear = !next.daily[o.date];
    if (firstClear) {
      xp += 100;
      coins += 75;
      next.daily[o.date] = { score: o.score.total, stars, timeMs: Math.round(o.timeMs) };
    } else {
      xp = 0;
      coins = 0;
    }
  } else if (o.mode === 'zen') {
    xp = Math.round(xp * 0.5);
    coins = Math.ceil(coins / 2);
  } else if (o.mode === 'blitz') {
    xp = 8 + colors * 2;
    coins = 3;
  }

  const st = { ...store.stats, played: { ...store.stats.played, [o.game]: (store.stats.played[o.game] ?? 0) + 1 } };
  st.solved++;
  st.tubes += colors;
  st.maxCombo = Math.max(st.maxCombo, o.stats.maxCombo);
  if (perfect) st.perfect++;
  if (mystery > 0) st.mysterySolved++;
  if (colors >= 10 && o.stats.undos === 0 && o.stats.hints === 0 && o.stats.extras === 0) st.flawlessBig++;
  if (colors >= 8 && o.timeMs < 60_000 && o.mode !== 'blitz') st.fastBig++;
  if (o.mode === 'daily' && firstClear) st.dailies++;
  if (o.mode === 'zen') st.zenSolved++;

  updateSort(o.game, () => next);
  useArcade.setState({ stats: st });
  store.addRewards({ xp, coins });
  const streak = store.touchStreak();
  syncStats();
  return { xp, coins, streak, firstClear };
}

export function awardBlitzRun(game: SortGameId, solved: number, score: number) {
  const s = useArcade.getState();
  const newBest = score > s.sort[game].blitzBest;
  useArcade.setState({
    stats: { ...s.stats, blitzRuns: s.stats.blitzRuns + 1, blitzBestSolved: Math.max(s.stats.blitzBestSolved, solved) },
  });
  updateSort(game, (p) => ({ ...p, blitzBest: Math.max(p.blitzBest, score) }));
  const coins = solved * 6;
  s.addRewards({ coins, xp: solved * 5 });
  return { coins, newBest };
}

export const HINT_COST = 25;
export const TUBE_COST = 60;
