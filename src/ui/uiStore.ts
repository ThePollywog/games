import { create } from 'zustand';
import { EDITION } from '../games/edition';
import type { GameId } from '../games/registry';

export type Panel = 'leaderboard' | 'achievements' | 'shop' | 'settings' | null;
export type BoardTab = 'daily' | 'blitz' | 'campaign' | 'weekly' | 'xp';

export interface BoardSel {
  game: GameId;
  tab: BoardTab;
}

export const useUi = create<{
  panel: Panel;
  board: BoardSel;
  open(panel: Panel, board?: BoardSel): void;
  close(): void;
}>((set) => ({
  panel: null,
  board: { game: EDITION ?? 'shipshape', tab: 'daily' },
  open: (panel, board) => set((s) => ({ panel, board: board ?? s.board })),
  close: () => set({ panel: null }),
}));
