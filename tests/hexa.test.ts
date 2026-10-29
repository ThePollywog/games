import { describe, expect, it } from 'vitest';
import {
  apply,
  CELLS,
  CLEAR_AT,
  hexRunSeed,
  isFull,
  NEIGHBORS,
  newGame,
  pieceAt,
  replayHex,
  verifyHex,
  type HexAction,
  type HexState,
} from '../shared/hexa/engine.ts';

/** Greedy bot: place each piece where it touches the most matching neighbours. */
function botGame(seed: string, maxActions = 400) {
  const s = newGame(seed);
  const log: HexAction[] = [];
  while (log.length < maxActions && !isFull(s)) {
    const slot = s.tray.findIndex(Boolean);
    const piece = s.tray[slot]!;
    let bestCell = -1;
    let bestScore = -1;
    s.cells.forEach((c, i) => {
      if (c.length) return;
      const score = NEIGHBORS[i].filter((n) => s.cells[n].at(-1) === piece.at(-1)).length;
      if (score > bestScore) [bestScore, bestCell] = [score, i];
    });
    const a: HexAction = ['p', slot, bestCell];
    expect(apply(s, seed, a)).not.toBeNull();
    log.push(a);
  }
  return { s, log };
}

describe('hexa stack', () => {
  it('builds a radius-3 hex board with symmetric adjacency', () => {
    expect(CELLS.length).toBe(37);
    NEIGHBORS.forEach((ns, i) => ns.forEach((n) => expect(NEIGHBORS[n]).toContain(i)));
    expect(Math.max(...NEIGHBORS.map((n) => n.length))).toBe(6);
  });

  it('deals the same pieces for the same seed', () => {
    expect(pieceAt('x', 5)).toEqual(pieceAt('x', 5));
    expect(newGame('x').tray).toEqual(newGame('x').tray);
  });

  it('merges matching neighbours and clears a run of ten', () => {
    const s: HexState = newGame('t');
    const [a, b] = [0, NEIGHBORS[0][0]];
    s.cells[b] = Array(6).fill(2);
    s.tray[0] = [1, 2, 2, 2, 2];
    const steps = apply(s, 't', ['p', 0, a])!;
    expect(steps.some((st) => st.kind === 'move')).toBe(true);
    const clear = steps.find((st) => st.kind === 'clear');
    expect(clear?.kind === 'clear' && clear.count).toBe(CLEAR_AT);
    expect(s.cells[a]).toEqual([1]);
    expect(s.cells[b]).toEqual([]);
    expect(s.score).toBe(CLEAR_AT * 10);
  });

  it('rejects illegal actions', () => {
    const s = newGame('t');
    expect(apply(s, 't', ['p', 0, 999])).toBeNull();
    apply(s, 't', ['p', 0, 0]);
    expect(apply(s, 't', ['p', 1, 0])).toBeNull(); // occupied
    expect(apply(s, 't', ['p', 0, 1])).toBeNull(); // slot already used
  });

  it('plays full games deterministically and verifies them', () => {
    const seed = hexRunSeed('abc123');
    const { s, log } = botGame(seed);
    expect(s.placed).toBeGreaterThan(15);
    const re = replayHex(seed, log)!;
    expect(re.score).toBe(s.score);
    const v = verifyHex(seed, log, log.length * 1000);
    expect(v.ok && v.score).toBe(s.score);
    expect(verifyHex(seed, log, 10).ok).toBe(false);
    expect(verifyHex(hexRunSeed('other1'), log, log.length * 1000).ok).toBe(false);
  });
});
