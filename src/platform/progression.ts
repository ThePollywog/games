export interface LevelInfo {
  level: number;
  into: number;
  need: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level++;
    need = 100 + (level - 1) * 60;
  }
  return { level, into: xp - acc, need };
}

const RANKS: [number, string][] = [
  // Crossing the line: every sailor starts as a pollywog and earns their shellback.
  [1, 'Pollywog'],
  [4, 'Deckhand'],
  [8, 'Able Sailor'],
  [13, 'Bosun'],
  [20, 'Shellback'],
  [30, 'Golden Shellback'],
  [45, 'Captain'],
  [70, 'Admiral of the Seas'],
];

export function rankTitle(level: number): string {
  let title = RANKS[0][1];
  for (const [min, name] of RANKS) if (level >= min) title = name;
  return title;
}

export const levelUpCoins = (level: number) => 40 + level * 10;

/** Streak reward for the first solve of the day: grows for a week, then holds. */
export const streakCoins = (streak: number) => 15 + Math.min(streak, 7) * 10;

const ADJ = ['Salty', 'Briny', 'Breezy', 'Stormy', 'Jolly', 'Lucky', 'Swift', 'Misty', 'Brave', 'Tidal', 'Mellow', 'Plucky'];
const NOUN = ['Otter', 'Puffin', 'Narwhal', 'Squid', 'Gull', 'Manatee', 'Krill', 'Seal', 'Pelican', 'Walrus', 'Dolphin', 'Crab'];
export function randomName(): string {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ADJ)}${pick(NOUN)}${Math.floor(Math.random() * 90 + 10)}`;
}
