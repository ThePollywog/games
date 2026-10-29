import { SORT_GAME_IDS } from '../../shared/sort/levels.ts';
import { EDITION } from '../games/edition';
import { levelFromXp } from './progression';
import type { ArcadeState } from './store';

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
  coins: number;
  /** Games that can earn it; omitted means any game. */
  games?: readonly string[];
  progress: (s: ArcadeState) => [current: number, goal: number];
}

const stat = (key: Exclude<keyof ArcadeState['stats'], 'played'>, goal: number) => (s: ArcadeState) =>
  [Math.min(s.stats[key], goal), goal] as [number, number];

/** "Reach level n": a single-game app doesn't need to say which game. */
const reach = (game: string, level: number) => (EDITION ? `Reach level ${level}` : `Reach ${game} level ${level}`);

/** Only the full arcade, never a single-game app. */
const ARCADE_ONLY: readonly string[] = [];

const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first', games: SORT_GAME_IDS, icon: '⛵', name: 'Maiden Voyage', desc: 'Solve your first puzzle', coins: 25, progress: stat('solved', 1) },
  { id: 'ten', games: SORT_GAME_IDS, icon: '⚓', name: 'Deckhand', desc: 'Solve 10 puzzles', coins: 50, progress: stat('solved', 10) },
  { id: 'fifty', games: SORT_GAME_IDS, icon: '🧂', name: 'Old Salt', desc: 'Solve 50 puzzles', coins: 150, progress: stat('solved', 50) },
  { id: 'hundred', games: SORT_GAME_IDS, icon: '🚢', name: 'Hundred Leagues', desc: 'Solve 100 puzzles', coins: 300, progress: stat('solved', 100) },
  { id: 'perfect1', games: SORT_GAME_IDS, icon: '⭐', name: 'Spick and Span', desc: 'Earn 3 stars on a level', coins: 25, progress: stat('perfect', 1) },
  { id: 'perfect25', games: SORT_GAME_IDS, icon: '🌟', name: 'Ship in a Bottle', desc: 'Earn 3 stars on 25 levels', coins: 200, progress: stat('perfect', 25) },
  { id: 'combo3', games: SORT_GAME_IDS, icon: '🌊', name: 'Riding the Wave', desc: 'Hit a x3 combo', coins: 50, progress: (s) => [Math.min(s.stats.maxCombo, 3), 3] },
  { id: 'combo5', games: SORT_GAME_IDS, icon: '🌀', name: 'Tidal Wave', desc: 'Hit a x5 combo', coins: 150, progress: (s) => [Math.min(s.stats.maxCombo, 5), 5] },
  { id: 'tubes500', games: SORT_GAME_IDS, icon: '🍾', name: 'Bottled Up', desc: 'Fill 500 bottles, channels or bollards', coins: 150, progress: stat('tubes', 500) },
  { id: 'daily1', games: SORT_GAME_IDS, icon: '🌅', name: 'Morning Watch', desc: 'Finish a Daily Challenge', coins: 50, progress: stat('dailies', 1) },
  { id: 'daily10', games: SORT_GAME_IDS, icon: '📓', name: "Ship's Log", desc: 'Finish 10 Daily Challenges', coins: 200, progress: stat('dailies', 10) },
  { id: 'streak3', icon: '🌬️', name: 'Fair Winds', desc: 'Play 3 days in a row', coins: 50, progress: (s) => [Math.min(s.streak.best, 3), 3] },
  { id: 'streak7', icon: '🗺️', name: 'Seven Seas', desc: 'Play 7 days in a row', coins: 150, progress: (s) => [Math.min(s.streak.best, 7), 7] },
  { id: 'streak30', icon: '🧭', name: 'Circumnavigator', desc: 'Play 30 days in a row', coins: 750, progress: (s) => [Math.min(s.streak.best, 30), 30] },
  { id: 'blitz5', games: SORT_GAME_IDS, icon: '⛵', name: 'Full Sail', desc: 'Solve 5 puzzles in one Blitz', coins: 75, progress: stat('blitzBestSolved', 5) },
  { id: 'blitz10', games: SORT_GAME_IDS, icon: '⛈️', name: 'Squall', desc: 'Solve 10 puzzles in one Blitz', coins: 250, progress: stat('blitzBestSolved', 10) },
  { id: 'mystery', games: SORT_GAME_IDS, icon: '🐉', name: 'Here Be Dragons', desc: 'Solve a puzzle with hidden colors', coins: 50, progress: stat('mysterySolved', 1) },
  { id: 'flawless', games: SORT_GAME_IDS, icon: '🔭', name: 'Dead Reckoning', desc: 'Solve a 10+ color puzzle with no undo or hints', coins: 150, progress: stat('flawlessBig', 1) },
  { id: 'speed', games: SORT_GAME_IDS, icon: '⏱️', name: 'Flank Speed', desc: 'Solve an 8+ color puzzle in under 60s', coins: 100, progress: stat('fastBig', 1) },
  { id: 'zen', games: SORT_GAME_IDS, icon: '🏝️', name: 'Calm Seas', desc: 'Solve 10 Zen puzzles', coins: 50, progress: stat('zenSolved', 10) },
  { id: 'collector', icon: '🎨', name: 'Flying Colors', desc: 'Own 3 color palettes', coins: 100, progress: (s) => [Math.min(s.palettes.length, 3), 3] },
  { id: 'lvl10', icon: '🎖️', name: 'Rising Tide', desc: 'Reach player level 10', coins: 150, progress: (s) => [Math.min(levelFromXp(s.xp).level, 10), 10] },
  { id: 'lvl25', icon: '👑', name: 'Admiralty', desc: 'Reach player level 25', coins: 500, progress: (s) => [Math.min(levelFromXp(s.xp).level, 25), 25] },
  { id: 'chapter2', games: ['shipshape'], icon: '🗺️', name: 'Charted Waters', desc: reach('Shipshape', 21), coins: 100, progress: (s) => [Math.min(s.sort['shipshape'].level, 21), 21] },
  { id: 'chapter5', games: ['shipshape'], icon: '🧭', name: 'Voyager', desc: reach('Shipshape', 81), coins: 400, progress: (s) => [Math.min(s.sort['shipshape'].level, 81), 81] },
  { id: 'ball25', games: ['buoy-oh-buoy'], icon: '🛟', name: 'Buoyant', desc: reach('Buoy Oh Buoy', 26), coins: 150, progress: (s) => [Math.min(s.sort['buoy-oh-buoy'].level, 26), 26] },
  { id: 'nut25', games: ['knots-and-bolts'], icon: '🪢', name: 'Knot Master', desc: reach('Knots & Bolts', 26), coins: 150, progress: (s) => [Math.min(s.sort['knots-and-bolts'].level, 26), 26] },
  {
    id: 'explorer',
    games: ARCADE_ONLY,
    icon: '⚓',
    name: 'Port of Call',
    desc: 'Play every game in the fleet',
    coins: 100,
    progress: (s) => [ALL_GAMES.filter((g) => s.stats.played[g]).length, ALL_GAMES.length],
  },
  { id: 'hexa1k', games: ['hex-marks-the-spot'], icon: '💰', name: 'Buried Treasure', desc: 'Score 1,000 in Hex Marks the Spot', coins: 50, progress: (s) => [Math.min(s.hexa.best, 1000), 1000] },
  { id: 'hexa10k', games: ['hex-marks-the-spot'], icon: '🏴‍☠️', name: 'Pirate King', desc: 'Score 10,000 in Hex Marks the Spot', coins: 300, progress: (s) => [Math.min(s.hexa.best, 10000), 10000] },
  { id: 'hexaChain', games: ['hex-marks-the-spot'], icon: '⛓️', name: 'Anchor Chain', desc: 'Trigger a x3 chain dig in Hex Marks the Spot', coins: 100, progress: (s) => [Math.min(s.stats.hexaBestChain, 3), 3] },
  { id: 'hexaTiles', games: ['hex-marks-the-spot'], icon: '🪙', name: 'Treasure Hunter', desc: 'Dig up 1,000 hex tiles', coins: 200, progress: (s) => [Math.min(s.stats.hexaCleared, 1000), 1000] },
];

const ALL_GAMES = ['shipshape', 'buoy-oh-buoy', 'knots-and-bolts', 'hex-marks-the-spot'];

/** The achievements this build offers: all of them in the arcade, the reachable ones in a single-game app. */
export const ACHIEVEMENTS = EDITION
  ? ALL_ACHIEVEMENTS.filter((a) => !a.games || a.games.includes(EDITION!))
  : ALL_ACHIEVEMENTS;

export const isUnlocked = (a: Achievement, s: ArcadeState) => {
  const [c, g] = a.progress(s);
  return c >= g;
};
