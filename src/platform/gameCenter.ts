// Game Center leaderboards for the iOS app. Same surface as the HTTP API, so screens don't care
// which one they talk to. Scores are computed on device with the same replay code the server
// uses, then submitted to Apple; there is no server-side verification here.
import { registerPlugin } from '@capacitor/core';
import { isoWeek, utcDay } from '../../shared/dates.ts';
import { hexDailySeed, hexRunSeed, verifyHex, type HexAction } from '../../shared/hexa/engine.ts';
import { SORT_GAME_IDS, type SortGameId } from '../../shared/sort/levels.ts';
import type { Action } from '../../shared/sort/session.ts';
import { verifyBlitz, verifyDaily, type Verdict } from '../../shared/sort/verify.ts';
import type { BoardEntry, BoardResponse, SubmitResponse } from './api';
import { EDITION, inApp } from '../games/edition';
import { useArcade } from './store';

interface GCEntry {
  rank: number;
  score: number;
  context: number;
  playerId: string;
  name: string;
}

interface GameCenterPlugin {
  signIn(): Promise<{ authenticated: boolean; player?: { playerId: string; name: string }; error?: string }>;
  submitScore(o: { leaderboardIds: string[]; score: number; context?: number }): Promise<void>;
  loadEntries(o: { leaderboardId: string; limit?: number }): Promise<{ total: number; entries: GCEntry[]; me?: GCEntry }>;
  showLeaderboard(o?: { leaderboardId?: string }): Promise<void>;
}

const GameCenter = registerPlugin<GameCenterPlugin>('GameCenter');

export const GC_UNAVAILABLE = 'Game Center is unavailable. Sign in under Settings › Game Center to see leaderboards.';

/**
 * App board names → Game Center leaderboard ids (create these in App Store Connect).
 * Daily boards are recurring leaderboards (1 day, starting 00:00 UTC); blitz and hexa weekly are
 * recurring weekly (starting Monday 00:00 UTC); campaign and XP are classic, best score.
 * The current occurrence is always "today" / "this week", so boards for other periods can't be shown.
 */
function leaderboardFor(board: string): { id: string; current: boolean; context?: string } {
  // Each single-game app has its own Game Center leaderboards, XP included.
  if (board === 'arcade:xp') return { id: EDITION ? `pollywog.${EDITION.replace(/-/g, '_')}.xp` : 'pollywog.arcade.xp', current: true };
  const [game, kind, period] = board.split(':');
  const id = `pollywog.${game.replace(/-/g, '_')}.${kind}`;
  switch (kind) {
    case 'daily':
      return { id, current: period === utcDay(), context: game === 'hex-marks-the-spot' ? 'cleared' : 'stars' };
    case 'blitz':
      return { id, current: period === isoWeek(), context: 'solved' };
    case 'weekly':
      return { id, current: period === isoWeek(), context: 'cleared' };
    default:
      return { id, current: true };
  }
}

let session: Promise<boolean> | null = null;

/** Signs in once per launch (GameKit shows its own sheet if needed). Retries after a failure. */
export function signIn(): Promise<boolean> {
  session ??= GameCenter.signIn().then(
    (r) => {
      if (r.authenticated && r.player) useArcade.getState().setName(r.player.name);
      else session = null;
      return r.authenticated;
    },
    () => ((session = null), false),
  );
  return session;
}

async function ready() {
  if (!(await signIn())) throw new Error(GC_UNAVAILABLE);
}

const toEntry = (e: GCEntry, context?: string): BoardEntry => ({
  rank: e.rank,
  playerId: e.playerId,
  name: e.name,
  score: e.score,
  detail: context && e.context ? { [context]: e.context } : {},
});

async function board(name: string, limit = 50): Promise<BoardResponse> {
  await ready();
  const lb = leaderboardFor(name);
  if (!lb.current) return { board: name, total: 0, entries: [], me: null };
  const r = await GameCenter.loadEntries({ leaderboardId: lb.id, limit });
  return {
    board: name,
    total: r.total,
    entries: r.entries.map((e) => toEntry(e, lb.context)),
    me: r.me ? toEntry(r.me, lb.context) : null,
  };
}

async function submit(name: string, v: Verdict): Promise<SubmitResponse> {
  if (!v.ok) throw new Error(v.error);
  await ready();
  const lb = leaderboardFor(name);
  if (!lb.current) throw new Error('that leaderboard has closed');
  await GameCenter.submitScore({ leaderboardIds: [lb.id], score: v.score, context: lb.context ? v.detail[lb.context] : 0 });
  const { me } = await board(name, 1);
  return { board: name, score: v.score, best: me };
}

export const gameCenterApi = {
  board,
  /** Game Center names are the player's GC alias; there's nothing to rename. */
  rename: async (name: string) => ({ name }),
  submitDaily: (game: SortGameId, date: string, actions: Action[], timeMs: number) =>
    submit(`${game}:daily:${date}`, verifyDaily(game, date, actions, timeMs)),
  submitBlitz: (game: SortGameId, runSeed: string, levels: { actions: Action[]; timeMs: number }[]) =>
    submit(`${game}:blitz:${isoWeek()}`, verifyBlitz(game, runSeed, levels)),
  submitHexDaily: (date: string, actions: HexAction[], timeMs: number) =>
    submit(`hex-marks-the-spot:daily:${date}`, verifyHex(hexDailySeed(date), actions, timeMs)),
  submitHexRun: (runSeed: string, actions: HexAction[], timeMs: number) =>
    submit(`hex-marks-the-spot:weekly:${isoWeek()}`, verifyHex(hexRunSeed(runSeed), actions, timeMs)),
  /** Opens Apple's own leaderboard UI (friends, filters) for the given board. */
  showNative: (name: string) => void GameCenter.showLeaderboard({ leaderboardId: leaderboardFor(name).id }).catch(() => {}),
};

const sent = new Map<string, number>();
/** XP and campaign levels are only-ever-increasing, so just push values that went up. */
export async function syncGameCenterStats() {
  if (!(await signIn())) return;
  const s = useArcade.getState();
  const scores: [string, number][] = [['arcade:xp', s.xp], ...SORT_GAME_IDS.filter(inApp).map((g): [string, number] => [`${g}:campaign`, s.sort[g].level - 1])];
  for (const [name, score] of scores) {
    if (score <= 0 || score <= (sent.get(name) ?? 0)) continue;
    sent.set(name, score);
    GameCenter.submitScore({ leaderboardIds: [leaderboardFor(name).id], score }).catch(() => sent.delete(name));
  }
}
