// Which game(s) this build ships. The web build is the whole arcade; each App Store app is built
// with VITE_GAME=<id> and contains just that game.
import { isSortGame } from '../../shared/sort/levels.ts';
import type { Route } from '../router';
import { GAMES, type GameId } from './registry';

const isGameId = (v: unknown): v is GameId => v === 'hex-marks-the-spot' || (typeof v === 'string' && isSortGame(v));

const raw: unknown = import.meta.env.VITE_GAME;
if (raw && !isGameId(raw)) throw new Error(`Unknown VITE_GAME "${String(raw)}"`);

/** The single game in this build, or null for the full arcade. */
export const EDITION: GameId | null = raw ? (raw as GameId) : null;

/** Games available in this build. */
export const APP_GAMES = EDITION ? GAMES.filter((g) => g.id === EDITION) : GAMES;

export const inApp = (game: GameId) => !EDITION || game === EDITION;

export const homeRoute = (game: GameId): Route => (game === 'hex-marks-the-spot' ? { name: 'hexa-home' } : { name: 'sort-home', game });
