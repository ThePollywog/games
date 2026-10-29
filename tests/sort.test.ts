import { describe, expect, it } from 'vitest';
import { canPour, isComplete, isSolved, isStuck, pour, type Board } from '../shared/sort/engine.ts';
import {
  blitzLevel,
  campaignLevel,
  dailyLevel,
  SORT_GAME_IDS,
} from '../shared/sort/levels.ts';
import { createSession, replay, type Action } from '../shared/sort/session.ts';
import { solve } from '../shared/sort/solver.ts';
import { verifyBlitz, verifyDaily } from '../shared/sort/verify.ts';

const tube = (units: number[], hidden?: boolean[]) => ({ units, hidden: hidden ?? units.map(() => false) });

describe('engine', () => {
  it('pours the whole matching top run that fits', () => {
    const b: Board = { capacity: 4, tubes: [tube([1, 0, 0]), tube([2, 0])] };
    expect(canPour(b, 0, 1)).toBe(true);
    const { board, amount } = pour(b, 0, 1);
    expect(amount).toBe(2);
    expect(board.tubes[0].units).toEqual([1]);
    expect(board.tubes[1].units).toEqual([2, 0, 0, 0]);
  });

  it('moves a single unit in Ball Sort mode', () => {
    const b: Board = { capacity: 4, single: true, tubes: [tube([1, 0, 0]), tube([])] };
    const { board, amount } = pour(b, 0, 1);
    expect(amount).toBe(1);
    expect(board.tubes[0].units).toEqual([1, 0]);
  });

  it('respects per-bolt heights in Nuts & Bolts', () => {
    const b: Board = { capacity: 4, caps: [5, 3], tubes: [tube([1, 0, 0, 0]), tube([2, 0])] };
    expect(pour(b, 0, 1).amount).toBe(1); // short bolt only has room for one
    const tall: Board = { capacity: 4, caps: [3, 5], tubes: [tube([0, 0]), tube([0, 0, 0])] };
    const r = pour(tall, 0, 1);
    expect(isComplete(r.board.tubes[1], 4)).toBe(false); // 5 units isn't a valid group
  });

  it('rejects mismatched colors, full targets and completed sources', () => {
    const b: Board = { capacity: 4, tubes: [tube([1]), tube([2]), tube([3, 3, 3, 3]), tube([1, 1, 1, 2])] };
    expect(canPour(b, 0, 1)).toBe(false);
    expect(canPour(b, 2, 0)).toBe(false);
    expect(canPour(b, 1, 3)).toBe(false);
  });

  it('reveals mystery layers as they surface and only pours revealed units', () => {
    const b: Board = { capacity: 4, tubes: [tube([0, 1, 1], [true, true, false]), tube([])] };
    const r = pour(b, 0, 1);
    expect(r.amount).toBe(1);
    expect(r.board.tubes[0].hidden).toEqual([true, false]);
  });

  it('does not cork a tube while a mystery layer is still hidden', () => {
    const b: Board = { capacity: 4, tubes: [tube([0, 0], [true, false]), tube([0, 0])] };
    const r = pour(b, 1, 0);
    expect(isComplete(r.board.tubes[0], 4)).toBe(false);
    expect(isSolved(r.board)).toBe(false);
    expect(canPour(r.board, 0, 1)).toBe(true);
  });

  it('detects dead ends', () => {
    const b: Board = { capacity: 2, tubes: [tube([0, 1]), tube([1, 0])] };
    expect(isStuck(b)).toBe(true);
  });
});

describe.each(SORT_GAME_IDS)('%s levels', (game) => {
  it('generates deterministic, solvable campaign levels across the difficulty curve', () => {
    for (const n of [1, 5, 10, 24, 37, 50, 60, 80, 100]) {
      const a = campaignLevel(game, n);
      expect(campaignLevel(game, n).board).toEqual(a.board);
      let board = a.board;
      for (const [f, t] of a.solution) board = pour(board, f, t).board;
      expect(isSolved(board)).toBe(true);
    }
  });

  it('generates every daily quickly', () => {
    for (let d = 1; d <= 7; d++) {
      const t0 = performance.now();
      expect(dailyLevel(game, `2026-10-0${d}`).par).toBeGreaterThan(0);
      expect(performance.now() - t0).toBeLessThan(3000);
    }
  });

  it('solver finds hints from mid-game positions', () => {
    const lvl = campaignLevel(game, 40);
    let b = lvl.board;
    for (const [f, t] of lvl.solution.slice(0, 5)) b = pour(b, f, t).board;
    expect(solve(b)).not.toBeNull();
  });

  it('verifies daily logs and rejects forged ones', () => {
    const date = '2026-10-05';
    const level = dailyLevel(game, date);
    const actions: Action[] = level.solution.map((m) => [m[0], m[1]]);
    expect(verifyDaily(game, date, actions, 60_000).ok).toBe(true);
    expect(verifyDaily(game, date, actions.slice(0, -1), 60_000).ok).toBe(false);
    expect(verifyDaily(game, date, actions, 100).ok).toBe(false);
  });

  it('verifies blitz runs', () => {
    const run = 'abc123';
    const levels = [0, 1, 2].map((i) => ({ actions: blitzLevel(game, run, i).solution, timeMs: 10_000 }));
    expect(verifyBlitz(game, run, levels).ok).toBe(true);
    expect(verifyBlitz(game, run, [...levels, { actions: [], timeMs: 1000 }]).ok).toBe(false);
  });
});

describe('session', () => {
  const level = dailyLevel('shipshape', '2026-10-03');

  it('penalizes undo, hints and extra tubes', () => {
    const clean = verifyDaily('shipshape', '2026-10-03', level.solution, 60_000);
    const s = createSession(level);
    s.addTube();
    s.useHint();
    s.pour(...level.solution[0]);
    s.undo();
    for (const [f, t] of level.solution) s.pour(f, t);
    const messy = verifyDaily('shipshape', '2026-10-03', s.log, 60_000);
    expect(clean.ok && messy.ok).toBe(true);
    if (clean.ok && messy.ok) expect(messy.score).toBeLessThan(clean.score);
  });

  it('adds an extra bolt at default height in Nuts & Bolts', () => {
    const nut = campaignLevel('knots-and-bolts', 20);
    const s = createSession(nut);
    s.addTube();
    expect(s.board.caps?.length).toBe(s.board.tubes.length);
    expect(s.board.caps?.at(-1)).toBe(4);
  });

  it('tracks combos', () => {
    expect(replay(level, level.solution)!.maxCombo).toBeGreaterThanOrEqual(1);
  });
});
