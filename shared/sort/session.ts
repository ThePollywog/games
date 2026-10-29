import { canPour, isComplete, isSolved, pour, withTube, type Board } from './engine.ts';
import type { Level } from './levels.ts';

/**
 * A play-through recorded as an action log. The client drives a session live; the
 * server replays the same log through the same code to verify leaderboard scores.
 *   [from, to] pour · 'u' undo · 'h' hint used · 'x' extra tube · 'r' restart
 */
export type Action = [number, number] | 'u' | 'h' | 'x' | 'r';

export const COMBO_WINDOW = 3;
export const COMBO_POINTS = 50;
export const MAX_EXTRA_TUBES = 1;

export interface SessionStats {
  moves: number;
  undos: number;
  hints: number;
  extras: number;
  restarts: number;
  maxCombo: number;
  comboBonus: number;
  solved: boolean;
}

export interface PourResult {
  amount: number;
  color: number;
  completed: boolean;
  combo: number;
  solved: boolean;
}

export type Session = ReturnType<typeof createSession>;

export function createSession(level: Level) {
  let board: Board = level.board;
  let history: Board[] = [];
  const log: Action[] = [];
  const s: SessionStats = {
    moves: 0,
    undos: 0,
    hints: 0,
    extras: 0,
    restarts: 0,
    maxCombo: 0,
    comboBonus: 0,
    solved: false,
  };
  let combo = 0;
  let lastCompleteAt = -Infinity;


  return {
    get board() {
      return board;
    },
    get log() {
      return log;
    },
    get canUndo() {
      return history.length > 0 && !s.solved;
    },
    stats: (): SessionStats => ({ ...s }),

    canPour: (from: number, to: number) => !s.solved && canPour(board, from, to),

    pour(from: number, to: number): PourResult | null {
      if (s.solved || !canPour(board, from, to)) return null;
      const color = board.tubes[from].units.at(-1)!;
      const wasComplete = isComplete(board.tubes[to], board.capacity);
      const res = pour(board, from, to);
      history.push(board);
      board = res.board;
      log.push([from, to]);
      s.moves++;
      const completed = !wasComplete && isComplete(board.tubes[to], board.capacity);
      if (completed) {
        combo = s.moves - lastCompleteAt <= COMBO_WINDOW ? combo + 1 : 1;
        lastCompleteAt = s.moves;
        s.maxCombo = Math.max(s.maxCombo, combo);
        if (combo > 1) s.comboBonus += COMBO_POINTS * (combo - 1);
      }
      s.solved = isSolved(board);
      return { amount: res.amount, color, completed, combo: completed ? combo : 0, solved: s.solved };
    },

    undo(): boolean {
      if (!history.length || s.solved) return false;
      board = history.pop()!;
      log.push('u');
      s.undos++;
      combo = 0;
      lastCompleteAt = -Infinity;
      return true;
    },

    useHint() {
      log.push('h');
      s.hints++;
    },

    addTube(): boolean {
      if (s.extras >= MAX_EXTRA_TUBES || s.solved) return false;
      board = withTube(board);
      history = history.map(withTube);
      log.push('x');
      s.extras++;
      return true;
    },

    /** Restart in place (counts against you on ranked boards — moves keep accumulating). */
    restart() {
      if (s.solved) return;
      board = s.extras ? withTube(level.board) : level.board;
      history = [];
      log.push('r');
      s.restarts++;
      combo = 0;
      lastCompleteAt = -Infinity;
    },
  };
}

const MAX_LOG = 3000;

/** Replays an untrusted log. Returns null if any action is malformed or illegal. */
export function replay(level: Level, actions: unknown): SessionStats | null {
  if (!Array.isArray(actions) || actions.length > MAX_LOG) return null;
  const session = createSession(level);
  for (const a of actions) {
    if (a === 'u') {
      if (!session.undo()) return null;
    } else if (a === 'h') session.useHint();
    else if (a === 'x') {
      if (!session.addTube()) return null;
    } else if (a === 'r') session.restart();
    else if (
      Array.isArray(a) &&
      a.length === 2 &&
      Number.isInteger(a[0]) &&
      Number.isInteger(a[1])
    ) {
      if (!session.pour(a[0], a[1])) return null;
    } else return null;
  }
  return session.stats();
}
