import { Capacitor } from '@capacitor/core';
import type { HexAction } from '../../shared/hexa/engine.ts';
import { SORT_GAME_IDS, type SortGameId } from '../../shared/sort/levels.ts';
import type { Action } from '../../shared/sort/session.ts';
import { GC_UNAVAILABLE, gameCenterApi, syncGameCenterStats } from './gameCenter';
import { useArcade } from './store';

export interface BoardEntry {
  rank: number;
  playerId: string;
  name: string;
  score: number;
  detail: Record<string, number>;
}

export interface BoardResponse {
  board: string;
  total: number;
  entries: BoardEntry[];
  me: Omit<BoardEntry, 'name'> | null;
}

export interface SubmitResponse {
  board: string;
  score: number;
  best: Omit<BoardEntry, 'name'> | null;
}

/** Static hosting (GitHub Pages) has no leaderboard server, so every request fails as offline. */
const STATIC = !!import.meta.env.VITE_STATIC;

async function request<T>(path: string, body?: object): Promise<T> {
  if (STATIC) throw new Error('No leaderboard server in the static build');
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

const who = () => {
  const { playerId, name } = useArcade.getState();
  return { playerId, name };
};

const httpApi = {
  board: (board: string) =>
    request<BoardResponse>(`/api/boards/${encodeURIComponent(board)}?player=${who().playerId}&limit=50`),
  rename: (name: string) => request<{ name: string }>('/api/players', { ...who(), name }),
  submitDaily: (game: SortGameId, date: string, actions: Action[], timeMs: number) =>
    request<SubmitResponse>(`/api/sort/${game}/daily`, { ...who(), date, actions, timeMs }),
  submitBlitz: (game: SortGameId, runSeed: string, levels: { actions: Action[]; timeMs: number }[]) =>
    request<SubmitResponse>(`/api/sort/${game}/blitz`, { ...who(), runSeed, levels }),
  submitHexDaily: (date: string, actions: HexAction[], timeMs: number) =>
    request<SubmitResponse>('/api/hexa/daily', { ...who(), date, actions, timeMs }),
  submitHexRun: (runSeed: string, actions: HexAction[], timeMs: number) =>
    request<SubmitResponse>('/api/hexa/run', { ...who(), runSeed, actions, timeMs }),
  showNative: undefined as ((board: string) => void) | undefined,
};

/** The iOS app uses Game Center only; the web uses this repo's verified leaderboard server. */
const native = Capacitor.isNativePlatform();
export const api: typeof httpApi = native ? gameCenterApi : httpApi;
export const OFFLINE_MESSAGE = native
  ? GC_UNAVAILABLE
  : STATIC
    ? 'Leaderboards are only in the iOS apps. Your progress is saved on this device.'
    : 'Leaderboards are offline right now. Your progress is saved on this device.';

let statsTimer: ReturnType<typeof setTimeout> | undefined;
/** Debounced push of progression boards (XP, campaign levels). Failures are silent: offline-first. */
export function syncStats() {
  clearTimeout(statsTimer);
  statsTimer = setTimeout(() => {
    if (native) return void syncGameCenterStats();
    if (STATIC) return;
    const s = useArcade.getState();
    const campaign = Object.fromEntries(SORT_GAME_IDS.map((g) => [g, s.sort[g].level]));
    request('/api/stats', { ...who(), xp: s.xp, campaign }).catch(() => {});
  }, 1500);
}
