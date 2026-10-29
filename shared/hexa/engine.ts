// Hexa Stack: drop stacks of hex tiles onto a hex board. Neighbouring stacks whose top colors
// match pour together; ten or more of one color on top of a stack clears for points.
// Pure and deterministic so the server can replay a game from its seed + action log.
import { rngFrom } from '../rng.ts';

export const RADIUS = 3;
export const CLEAR_AT = 10;
export const TRAY_SIZE = 3;
export const MAX_HAMMERS = 3;
export const MAX_SHUFFLES = 3;
export const MAX_COLORS = 8;
/** Every this many placements a stone lands on a random empty cell; only a hammer removes it. */
export const STONE_EVERY = 20;
export const STONE = -1;

/** Axial coordinates for every cell, in a fixed order (the cell index is the board address). */
export const CELLS: [q: number, r: number][] = [];
for (let r = -RADIUS; r <= RADIUS; r++) {
  for (let q = -RADIUS; q <= RADIUS; q++) {
    if (Math.abs(q + r) <= RADIUS) CELLS.push([q, r]);
  }
}
const indexOf = new Map(CELLS.map(([q, r], i) => [`${q},${r}`, i]));
const DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
export const NEIGHBORS: number[][] = CELLS.map(([q, r]) =>
  DIRS.map(([dq, dr]) => indexOf.get(`${q + dq},${r + dr}`)).filter((i): i is number => i !== undefined),
);

export type Stack = number[]; // bottom -> top

export type HexAction = ['p', slot: number, cell: number] | ['h', cell: number] | ['s'];

export type Step =
  | { kind: 'move'; from: number; to: number; count: number; color: number }
  | { kind: 'clear'; cell: number; count: number; color: number; points: number; chain: number }
  | { kind: 'stone'; cell: number };

export interface HexState {
  cells: Stack[];
  tray: (Stack | null)[];
  score: number;
  cleared: number;
  placed: number;
  drawn: number;
  hammers: number;
  shuffles: number;
  bestChain: number;
}

const top = (s: Stack) => s[s.length - 1];
export function topRun(s: Stack): number {
  let n = 0;
  for (let i = s.length - 1; i >= 0 && s[i] === s[s.length - 1]; i--) n++;
  return n;
}

/** Colors in play grow as the game goes on. */
export const colorsAt = (drawn: number) => Math.min(MAX_COLORS, 3 + Math.floor(drawn / 15));

/** The i-th piece of a game; independent of play so every replay sees the same sequence. */
export function pieceAt(seed: string, i: number): Stack {
  const rng = rngFrom(`${seed}:piece:${i}`);
  const colors = colorsAt(i);
  // Pieces get taller and more mixed as the game goes on.
  const size = 2 + Math.floor(rng() * (i < 12 ? 3 : i < 60 ? 4 : 5));
  const single = Math.max(0.2, 0.55 - i / 300);
  const roll = rng();
  const segments = Math.min(size, roll < single ? 1 : roll < single + 0.35 ? 2 : i > 100 && roll > 0.9 ? 4 : 3);
  const stack: Stack = [];
  let prev = -1;
  for (let s = 0; s < segments; s++) {
    let c = Math.floor(rng() * colors);
    if (c === prev) c = (c + 1) % colors;
    prev = c;
    const left = size - stack.length;
    const len = s === segments - 1 ? left : 1 + Math.floor(rng() * (left - (segments - s - 1)));
    for (let k = 0; k < len; k++) stack.push(c);
  }
  return stack;
}

export function newGame(seed: string): HexState {
  const s: HexState = {
    cells: CELLS.map(() => []),
    tray: [],
    score: 0,
    cleared: 0,
    placed: 0,
    drawn: 0,
    hammers: 0,
    shuffles: 0,
    bestChain: 0,
  };
  refill(s, seed);
  return s;
}

function refill(s: HexState, seed: string) {
  s.tray = Array.from({ length: TRAY_SIZE }, () => pieceAt(seed, s.drawn++));
}

export const isFull = (s: HexState) => s.cells.every((c) => c.length > 0);

/**
 * Settles the board after a placement: same-colored tops pour into the stack being resolved,
 * runs of CLEAR_AT+ vanish, and anything whose top changed is re-checked. Chains multiply points.
 */
function resolve(s: HexState, start: number): Step[] {
  const steps: Step[] = [];
  const queue = [start];
  let chain = 0;
  for (let guard = 0; queue.length && guard < 500; guard++) {
    const i = queue.shift()!;
    const stack = s.cells[i];
    if (!stack.length) continue;
    const c = top(stack);
    for (const n of NEIGHBORS[i]) {
      const other = s.cells[n];
      if (!other.length || top(other) !== c) continue;
      const count = topRun(other);
      stack.push(...other.splice(other.length - count, count));
      steps.push({ kind: 'move', from: n, to: i, count, color: c });
      if (other.length) queue.push(n);
    }
    const run = topRun(stack);
    if (run >= CLEAR_AT) {
      stack.splice(stack.length - run, run);
      chain++;
      const points = run * 10 * chain;
      s.score += points;
      s.cleared += run;
      s.bestChain = Math.max(s.bestChain, chain);
      steps.push({ kind: 'clear', cell: i, count: run, color: c, points, chain });
      if (stack.length) queue.push(i);
    }
  }
  return steps;
}

/** Applies one action in place. Returns the animation steps, or null if the action is illegal. */
export function apply(s: HexState, seed: string, a: HexAction): Step[] | null {
  if (a[0] === 'p') {
    const [, slot, cell] = a;
    const piece = s.tray[slot];
    if (!piece || !Number.isInteger(cell) || !s.cells[cell] || s.cells[cell].length) return null;
    s.cells[cell] = piece.slice();
    s.tray[slot] = null;
    s.placed++;
    const steps = resolve(s, cell);
    if (s.placed % STONE_EVERY === 0) {
      const empty = s.cells.map((c, i) => (c.length ? -1 : i)).filter((i) => i >= 0);
      if (empty.length) {
        const at = empty[Math.floor(rngFrom(`${seed}:stone:${s.placed}`)() * empty.length)];
        s.cells[at] = [STONE];
        steps.push({ kind: 'stone', cell: at });
      }
    }
    if (s.tray.every((p) => !p)) refill(s, seed);
    return steps;
  }
  if (a[0] === 'h') {
    const cell = a[1];
    if (s.hammers >= MAX_HAMMERS || !Number.isInteger(cell) || !s.cells[cell]?.length) return null;
    s.cells[cell] = [];
    s.hammers++;
    return [];
  }
  if (a[0] === 's') {
    if (s.shuffles >= MAX_SHUFFLES) return null;
    s.tray = s.tray.map((p) => (p ? pieceAt(seed, s.drawn++) : null));
    s.shuffles++;
    return [];
  }
  return null;
}

const MAX_LOG = 6000;

/** Replays an untrusted log from a seed; null if any action is malformed or illegal. */
export function replayHex(seed: string, actions: unknown): HexState | null {
  if (!Array.isArray(actions) || actions.length > MAX_LOG) return null;
  const s = newGame(seed);
  for (const a of actions) {
    if (!Array.isArray(a) || !['p', 'h', 's'].includes(a[0])) return null;
    if (!apply(s, seed, a as HexAction)) return null;
  }
  return s;
}

export const MIN_MS_PER_ACTION = 150;

export type HexVerdict = { ok: true; score: number; detail: Record<string, number> } | { ok: false; error: string };

export function verifyHex(seed: string, actions: unknown, timeMs: unknown): HexVerdict {
  if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs <= 0) return { ok: false, error: 'bad time' };
  const s = replayHex(seed, actions);
  if (!s) return { ok: false, error: 'illegal move log' };
  if (timeMs < (actions as unknown[]).length * MIN_MS_PER_ACTION) return { ok: false, error: 'implausible time' };
  return { ok: true, score: s.score, detail: { cleared: s.cleared, placed: s.placed, chain: s.bestChain } };
}

export const hexDailySeed = (date: string) => `hexa:daily:${date}`;
export const hexRunSeed = (run: string) => `hexa:run:${run}`;
