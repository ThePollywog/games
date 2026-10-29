import { rngFrom, shuffle, type Rng } from '../rng.ts';
import { emptyTube, isComplete, type Board, type Move, type Tube } from './engine.ts';
import { solve } from './solver.ts';

export const MAX_COLORS = 12;

export type SortGameId = 'shipshape' | 'buoy-oh-buoy' | 'knots-and-bolts';
export const SORT_GAME_IDS: SortGameId[] = ['shipshape', 'buoy-oh-buoy', 'knots-and-bolts'];
export const isSortGame = (id: string): id is SortGameId => (SORT_GAME_IDS as string[]).includes(id);

export interface LevelConfig {
  colors: number;
  empty: number;
  /** Units per color (and default tube height). */
  capacity: number;
  /** Fraction of filled tubes whose lower layers start hidden. */
  mystery: number;
  /** Ball Sort: one unit per move. */
  single?: boolean;
  /** Nuts & Bolts: filled bolts that are one nut taller (the spare room is spread unevenly). */
  tall?: number;
}

export interface Level {
  seed: string;
  config: LevelConfig;
  board: Board;
  par: number;
  solution: Move[];
}

export const isBossLevel = (n: number) => n % 10 === 0;

interface GameDef {
  /** Seed namespace; Water Sort keeps the original unprefixed seeds. */
  prefix: string;
  campaign(n: number): LevelConfig;
  daily(dow: number): LevelConfig;
  blitz(i: number): LevelConfig;
  zen(colors: number): LevelConfig;
}

const base = { empty: 2, capacity: 4, mystery: 0 };

const GAMES: Record<SortGameId, GameDef> = {
  'shipshape': {
    prefix: '',
    campaign(n) {
      const boss = isBossLevel(n);
      const colors = Math.min(MAX_COLORS, 3 + Math.floor((n - 1) / 6) + (boss ? 1 : 0));
      let mystery = 0;
      if (n >= 24 && n % 4 === 0) mystery = 0.35;
      if (n >= 60 && n % 2 === 0) mystery = 0.5;
      if (boss && n >= 20) mystery = Math.min(1, 0.4 + n / 250);
      return { ...base, colors, mystery };
    },
    daily(dow) {
      // Difficulty climbs through the week; weekends get mystery layers. 0 = Sunday.
      const table: [number, number][] = [[12, 0.5], [7, 0], [8, 0], [9, 0], [9, 0.35], [10, 0], [11, 0.35]];
      const [colors, mystery] = table[dow];
      return { ...base, colors, mystery };
    },
    blitz: (i) => ({ ...base, colors: Math.min(10, 3 + Math.floor(i / 2)), mystery: i >= 8 && i % 3 === 2 ? 0.35 : 0 }),
    zen: (colors) => ({ ...base, colors }),
  },

  'buoy-oh-buoy': {
    prefix: 'ball:',
    campaign(n) {
      const boss = isBossLevel(n);
      const colors = Math.min(10, 3 + Math.floor((n - 1) / 7) + (boss ? 1 : 0));
      const mystery = n >= 30 && (n % 5 === 0 || boss) ? 0.4 : 0;
      return { ...base, colors, mystery, single: true };
    },
    daily(dow) {
      const table: [number, number][] = [[10, 0.4], [6, 0], [7, 0], [8, 0], [8, 0.3], [9, 0], [9, 0.3]];
      const [colors, mystery] = table[dow];
      return { ...base, colors, mystery, single: true };
    },
    blitz: (i) => ({ ...base, colors: Math.min(8, 3 + Math.floor(i / 2)), single: true }),
    zen: (colors) => ({ ...base, colors: Math.min(10, colors), single: true }),
  },

  'knots-and-bolts': {
    // Fewer empty bolts, but some bolts are taller and start part-filled.
    prefix: 'nut:',
    campaign(n) {
      const boss = isBossLevel(n);
      const colors = Math.min(11, 3 + Math.floor((n - 1) / 6) + (boss ? 1 : 0));
      const empty = n < 12 ? 2 : 1;
      return {
        ...base,
        colors,
        empty,
        tall: n < 4 ? 0 : empty === 2 ? 1 : 2 + Math.floor(colors / 4),
        mystery: n >= 30 && (n % 5 === 0 || boss) ? 0.35 : 0,
      };
    },
    daily(dow) {
      const table: [number, number][] = [[11, 0.3], [7, 0], [8, 0], [9, 0], [9, 0.3], [10, 0], [11, 0]];
      const [colors, mystery] = table[dow];
      return { ...base, colors, empty: 1, tall: 2 + Math.floor(colors / 4), mystery };
    },
    blitz: (i) => {
      const colors = Math.min(9, 3 + Math.floor(i / 2));
      return i < 3 ? { ...base, colors, tall: 1 } : { ...base, colors, empty: 1, tall: 2 + Math.floor(colors / 4) };
    },
    zen: (colors) => ({ ...base, colors: Math.min(11, colors), empty: 1, tall: 2 + Math.floor(colors / 4) }),
  },
};

const dowOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

export const campaignConfig = (game: SortGameId, n: number) => GAMES[game].campaign(n);
export const dailyConfig = (game: SortGameId, date: string) => GAMES[game].daily(dowOf(date));
export const blitzConfig = (game: SortGameId, i: number) => GAMES[game].blitz(i);
export const zenConfig = (game: SortGameId, colors: number) => GAMES[game].zen(colors);

export const campaignSeed = (game: SortGameId, n: number) => `${GAMES[game].prefix}campaign:${n}`;
export const dailySeed = (game: SortGameId, date: string) => `${GAMES[game].prefix}daily:${date}`;
export const blitzSeed = (game: SortGameId, run: string, i: number) => `${GAMES[game].prefix}blitz:${run}:${i}`;

export const campaignLevel = (game: SortGameId, n: number) => generateLevel(campaignSeed(game, n), campaignConfig(game, n));
export const dailyLevel = (game: SortGameId, date: string) => generateLevel(dailySeed(game, date), dailyConfig(game, date));
export const blitzLevel = (game: SortGameId, run: string, i: number) => generateLevel(blitzSeed(game, run, i), blitzConfig(game, i));

/** Bolt heights and how many nuts each starts with; the extra room from tall bolts is spread at random. */
function boltLayout(config: LevelConfig, rng: Rng): { caps: number[]; fills: number[] } {
  const caps = Array<number>(config.colors).fill(config.capacity);
  for (const i of shuffle([...caps.keys()], rng).slice(0, config.tall ?? 0)) caps[i]++;
  const fills = caps.slice();
  for (let k = 0; k < (config.tall ?? 0); k++) {
    const options = fills.map((f, i) => (f > 2 ? i : -1)).filter((i) => i >= 0);
    fills[options[Math.floor(rng() * options.length)]]--;
  }
  return { caps, fills };
}

export function generateLevel(seed: string, config: LevelConfig): Level {
  const { colors, capacity, empty, mystery } = config;
  const mixedHeights = !!config.tall;
  for (let attempt = 0; attempt < 300; attempt++) {
    const rng = rngFrom(`${seed}#${attempt}`);
    const palette = shuffle([...Array(MAX_COLORS).keys()], rng).slice(0, colors);
    const pool: number[] = [];
    for (let c = 0; c < colors; c++) for (let k = 0; k < capacity; k++) pool.push(palette[c]);
    shuffle(pool, rng);

    const { caps: filledCaps, fills } = mixedHeights
      ? boltLayout(config, rng)
      : { caps: Array<number>(colors).fill(capacity), fills: Array<number>(colors).fill(capacity) };
    const tubes: Tube[] = [];
    let at = 0;
    for (const fill of fills) {
      const units = pool.slice(at, at + fill);
      at += fill;
      tubes.push({ units, hidden: units.map(() => false) });
    }
    if (tubes.some((t) => isComplete(t, capacity))) continue;

    const mysteryCount = Math.round(colors * mystery);
    for (const t of shuffle(tubes.slice(), rng).slice(0, mysteryCount)) {
      t.hidden = t.units.map((_, i) => i < t.units.length - 1);
    }
    const emptyCaps = Array<number>(empty).fill(capacity);
    for (let e = 0; e < empty; e++) tubes.push(emptyTube());

    const board: Board = { tubes, capacity };
    if (mixedHeights) board.caps = [...filledCaps, ...emptyCaps];
    if (config.single) board.single = true;
    const solution = solve(board, { maxNodes: 20000 + colors * (config.single ? 9000 : 4000) });
    if (solution && solution.length >= colors) {
      return { seed, config, board, par: solution.length, solution };
    }
  }
  throw new Error(`Could not generate level for seed ${seed}`);
}
