import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dayDiff, localDay } from '../../shared/dates.ts';
import { SORT_GAME_IDS, type SortGameId } from '../../shared/sort/levels.ts';
import { randomName, streakCoins } from './progression';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  colorblind: boolean;
  reducedMotion: boolean;
}

export interface Stats {
  solved: number;
  perfect: number;
  tubes: number;
  maxCombo: number;
  dailies: number;
  blitzRuns: number;
  blitzBestSolved: number;
  mysterySolved: number;
  flawlessBig: number;
  fastBig: number;
  zenSolved: number;
  hexaGames: number;
  hexaCleared: number;
  hexaBestChain: number;
  /** Plays per game id, for "try everything" achievements. */
  played: Record<string, number>;
}

export interface SortProgress {
  /** Next campaign level to play. */
  level: number;
  stars: Record<number, number>;
  daily: Record<string, { score: number; stars: number; timeMs: number }>;
  blitzBest: number;
}

export interface ArcadeState {
  playerId: string;
  name: string;
  xp: number;
  coins: number;
  streak: { count: number; best: number; lastDay: string | null };
  stats: Stats;
  achievements: Record<string, number>;
  palettes: string[];
  palette: string;
  settings: Settings;
  sort: Record<SortGameId, SortProgress>;
  hexa: HexaProgress;
}

export interface HexaProgress {
  best: number;
  daily: Record<string, { score: number }>;
}

interface Actions {
  addRewards(r: { xp?: number; coins?: number }): void;
  spend(coins: number): boolean;
  /** Call once per solved puzzle. Returns streak bonus info the first time each day. */
  touchStreak(): { count: number; coins: number } | null;
  setName(name: string): void;
  setSettings(p: Partial<Settings>): void;
  buyPalette(id: string, price: number): boolean;
  equipPalette(id: string): void;
  reset(): void;
}

// randomUUID only exists in secure contexts; phones on the LAN dev server aren't one.
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('-');

const initial = (): ArcadeState => ({
  playerId: newId(),
  name: randomName(),
  xp: 0,
  coins: 150,
  streak: { count: 0, best: 0, lastDay: null },
  stats: {
    solved: 0,
    perfect: 0,
    tubes: 0,
    maxCombo: 0,
    dailies: 0,
    blitzRuns: 0,
    blitzBestSolved: 0,
    mysterySolved: 0,
    flawlessBig: 0,
    fastBig: 0,
    zenSolved: 0,
    hexaGames: 0,
    hexaCleared: 0,
    hexaBestChain: 0,
    played: {},
  },
  achievements: {},
  palettes: ['classic'],
  palette: 'classic',
  settings: { sound: true, haptics: true, colorblind: false, reducedMotion: false },
  sort: Object.fromEntries(SORT_GAME_IDS.map((g) => [g, freshSort()])) as Record<SortGameId, SortProgress>,
  hexa: { best: 0, daily: {} },
});

const freshSort = (): SortProgress => ({ level: 1, stars: {}, daily: {}, blitzBest: 0 });

const RENAMED_GAMES: Record<string, string> = {
  'water-sort': 'shipshape',
  'ball-sort': 'buoy-oh-buoy',
  'nut-sort': 'knots-and-bolts',
  'hexa-stack': 'hex-marks-the-spot',
};

export const useArcade = create<ArcadeState & Actions>()(
  persist(
    (set, get) => ({
      ...initial(),
      addRewards: ({ xp = 0, coins = 0 }) => set((s) => ({ xp: s.xp + xp, coins: s.coins + coins })),
      spend(coins) {
        if (get().coins < coins) return false;
        set((s) => ({ coins: s.coins - coins }));
        return true;
      },
      touchStreak() {
        const today = localDay();
        const { streak } = get();
        if (streak.lastDay === today) return null;
        const count = streak.lastDay && dayDiff(streak.lastDay, today) === 1 ? streak.count + 1 : 1;
        const coins = streakCoins(count);
        set((s) => ({
          streak: { count, best: Math.max(s.streak.best, count), lastDay: today },
          coins: s.coins + coins,
        }));
        return { count, coins };
      },
      setName: (name) => set({ name }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      buyPalette(id, price) {
        const s = get();
        if (s.palettes.includes(id) || s.coins < price) return false;
        set({ coins: s.coins - price, palettes: [...s.palettes, id], palette: id });
        return true;
      },
      equipPalette: (id) => set({ palette: id }),
      reset: () => set({ ...initial(), playerId: get().playerId, name: get().name }),
    }),
    {
      name: 'pour-arcade',
      version: 3,
      migrate: (persisted, version) => {
        // v1 only had Water Sort, stored under `waterSort`.
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2 && p.waterSort) {
          p.sort = { 'water-sort': p.waterSort };
          delete p.waterSort;
        }
        // v3 renamed the game ids to match the app names.
        if (version < 3) {
          const renameKeys = (o: unknown) =>
            o && typeof o === 'object'
              ? Object.fromEntries(Object.entries(o).map(([k, v]) => [RENAMED_GAMES[k] ?? k, v]))
              : o;
          p.sort = renameKeys(p.sort);
          if (p.stats && typeof p.stats === 'object') {
            const stats = p.stats as Record<string, unknown>;
            stats.played = renameKeys(stats.played);
          }
        }
        return p as unknown as ArcadeState;
      },
      merge: (persisted, current) => {
        // Deep-merge nested objects so new fields get defaults after updates.
        const p = (persisted ?? {}) as Partial<ArcadeState>;
        const c = current as ArcadeState & Actions;
        return {
          ...c,
          ...p,
          stats: { ...c.stats, ...p.stats },
          settings: { ...c.settings, ...p.settings },
          sort: Object.fromEntries(SORT_GAME_IDS.map((g) => [g, { ...c.sort[g], ...p.sort?.[g] }])) as ArcadeState['sort'],
          hexa: { ...c.hexa, ...p.hexa },
          streak: { ...c.streak, ...p.streak },
        };
      },
    },
  ),
);

/** Immutable update helper for one sort game's progress. */
export function updateSort(game: SortGameId, fn: (p: SortProgress) => SortProgress) {
  useArcade.setState((s) => ({ sort: { ...s.sort, [game]: fn(s.sort[game]) } }));
}

/** Streak counts as broken (visually) if the last solve was before yesterday. */
export function liveStreak(s: ArcadeState['streak']): number {
  if (!s.lastDay) return 0;
  return dayDiff(s.lastDay, localDay()) <= 1 ? s.count : 0;
}
