import { useSyncExternalStore } from 'react';
import { isSortGame, type SortGameId } from '../shared/sort/levels.ts';
import { inApp } from './games/edition';

export type HexaMode = 'endless' | 'daily';

export type Route =
  | { name: 'hub' }
  | { name: 'sort-home'; game: SortGameId }
  | { name: 'sort-level'; game: SortGameId; level: number }
  | { name: 'sort-daily'; game: SortGameId }
  | { name: 'sort-blitz'; game: SortGameId }
  | { name: 'sort-zen'; game: SortGameId; colors: number }
  | { name: 'hexa-home' }
  | { name: 'hexa-play'; mode: HexaMode };

export function parse(hash: string): Route {
  const [game, kind, arg] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  // Single-game builds treat every other game's route as home.
  if (game && (game === 'hex-marks-the-spot' || isSortGame(game)) && !inApp(game)) return { name: 'hub' };
  if (game === 'hex-marks-the-spot') {
    return kind === 'endless' || kind === 'daily' ? { name: 'hexa-play', mode: kind } : { name: 'hexa-home' };
  }
  if (!game || !isSortGame(game)) return { name: 'hub' };
  const n = Number(arg);
  switch (kind) {
    case 'level':
      return Number.isInteger(n) && n > 0 ? { name: 'sort-level', game, level: n } : { name: 'sort-home', game };
    case 'daily':
      return { name: 'sort-daily', game };
    case 'blitz':
      return { name: 'sort-blitz', game };
    case 'zen':
      return { name: 'sort-zen', game, colors: Number.isInteger(n) ? Math.min(12, Math.max(3, n)) : 7 };
    default:
      return { name: 'sort-home', game };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'hub':
      return '#/';
    case 'sort-home':
      return `#/${r.game}`;
    case 'sort-level':
      return `#/${r.game}/level/${r.level}`;
    case 'sort-daily':
      return `#/${r.game}/daily`;
    case 'sort-blitz':
      return `#/${r.game}/blitz`;
    case 'sort-zen':
      return `#/${r.game}/zen/${r.colors}`;
    case 'hexa-home':
      return '#/hex-marks-the-spot';
    case 'hexa-play':
      return `#/hex-marks-the-spot/${r.mode}`;
  }
}

export const go = (r: Route, replace = false) => {
  if (replace) location.replace(href(r));
  else location.hash = href(r);
};

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export const useHash = () => useSyncExternalStore(subscribe, () => location.hash);
