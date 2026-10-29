import type { SortGameId } from '../../shared/sort/levels.ts';
import type { Route } from '../router';

export type GameId = SortGameId | 'hex-marks-the-spot';

export interface GameInfo {
  id: GameId;
  name: string;
  tagline: string;
  emoji: string;
  route: Route;
}

export type Skin = 'liquid' | 'balls' | 'nuts';

/** Everything that makes one sort game feel different from another. */
export interface SortMeta {
  id: SortGameId;
  name: string;
  emoji: string;
  skin: Skin;
  /** Container / item nouns used in copy. */
  container: string;
  item: string;
  chapters: string[];
  tips: Record<number, string>;
  /** Highest color count Zen offers. */
  zenMax: number;
}

export const SORT_META: Record<SortGameId, SortMeta> = {
  'shipshape': {
    id: 'shipshape',
    name: 'Shipshape',
    emoji: '🍾',
    skin: 'liquid',
    container: 'bottle',
    item: 'sea water',
    chapters: ['Harbor', 'Lagoon', 'Coral Reef', 'Kelp Forest', 'Shipwreck Cove', 'Ice Floes', 'Maelstrom', 'Davy Jones’ Locker'],
    tips: {
      1: 'Tap a bottle to lift it, then tap another to pour. Sea water only lands on the same color or in an empty bottle.',
      3: 'Fill a bottle with one color to cork it. Cork bottles back-to-back for combo bonuses!',
      10: 'Storm warning! One extra color — and bonus coins for weathering it.',
      24: 'Murky layers (?) stay hidden until they reach the top — and a bottle only corks once every layer is clear.',
    },
    zenMax: 12,
  },
  'buoy-oh-buoy': {
    id: 'buoy-oh-buoy',
    name: 'Buoy Oh Buoy',
    emoji: '🛟',
    skin: 'balls',
    container: 'channel',
    item: 'buoy',
    chapters: ['Marina', 'Fishing Grounds', 'Lighthouse Point', 'Shipping Lane', 'Regatta', 'Fog Bank', 'Northern Lights', 'The Bermuda Triangle'],
    tips: {
      1: 'Tap a channel, then tap where its top buoy should go. One buoy moves at a time — onto the same color or into an empty channel.',
      3: 'Plan ahead: every single buoy move counts toward par.',
      10: 'Storm warning! One extra color to keep afloat.',
      30: 'Buoys lost in the fog (?) show their color once they reach the top.',
    },
    zenMax: 10,
  },
  'knots-and-bolts': {
    id: 'knots-and-bolts',
    name: 'Knots & Bolts',
    emoji: '🪢',
    skin: 'nuts',
    container: 'bollard',
    item: 'rope coil',
    chapters: ['Dockside', 'Boatyard', 'Fishing Pier', 'Dry Dock', 'Rigging Loft', 'Clipper Deck', 'Galleon', 'The Flying Dutchman'],
    tips: {
      1: 'Tap a bollard, then another: every matching rope coil on top slides across. Four coils of one color make it fast.',
      4: 'Some bollards are taller — they hold an extra coil. Use them as breathing room.',
      12: 'Only one spare bollard from here on. The tall ones are your lifeline.',
      30: 'Tarred coils (?) show their color once they reach the top.',
    },
    zenMax: 11,
  },
};

export const GAMES: GameInfo[] = [
  {
    id: 'shipshape',
    name: 'Shipshape',
    tagline: 'Pour until every bottle holds one sea',
    emoji: '🍾',
    route: { name: 'sort-home', game: 'shipshape' },
  },
  {
    id: 'buoy-oh-buoy',
    name: 'Buoy Oh Buoy',
    tagline: 'One buoy at a time. Every move counts.',
    emoji: '🛟',
    route: { name: 'sort-home', game: 'buoy-oh-buoy' },
  },
  {
    id: 'knots-and-bolts',
    name: 'Knots & Bolts',
    tagline: 'Coil rope onto bollards of every height',
    emoji: '🪢',
    route: { name: 'sort-home', game: 'knots-and-bolts' },
  },
  {
    id: 'hex-marks-the-spot',
    name: 'Hex Marks the Spot',
    tagline: 'Stack the treasure, ten of a color clears',
    emoji: '🏴‍☠️',
    route: { name: 'hexa-home' },
  },
];

export const gameName = (id: GameId) => GAMES.find((g) => g.id === id)?.name ?? id;

export function chapterOf(game: SortGameId, level: number) {
  const names = SORT_META[game].chapters;
  const i = Math.floor((level - 1) / 20);
  const lap = Math.floor(i / names.length);
  return { index: i, name: names[i % names.length] + (lap ? ` ${lap + 1}` : '') };
}
