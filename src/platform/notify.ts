import { create } from 'zustand';
import { ACHIEVEMENTS, isUnlocked } from './achievements';
import { sfx } from './feedback';
import { levelFromXp, levelUpCoins, rankTitle } from './progression';
import { useArcade } from './store';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  body?: string;
}

interface ToastState {
  toasts: Toast[];
  push(t: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
  levelUp: { level: number; coins: number; title: string } | null;
  closeLevelUp(): void;
}

let nextId = 1;
const queue: Toast[] = [];
let showing = false;

/** Toasts show one at a time so a burst of unlocks never buries the screen. */
function pump() {
  const next = queue.shift();
  if (!next) {
    showing = false;
    return;
  }
  showing = true;
  useToasts.setState({ toasts: [next] });
  setTimeout(() => {
    useToasts.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== next.id) }));
    setTimeout(pump, 250);
  }, 2600);
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(t) {
    queue.push({ ...t, id: nextId++ });
    if (!showing) pump();
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  levelUp: null,
  closeLevelUp: () => set({ levelUp: null }),
}));

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t);

/** Watches the arcade store for level-ups and newly met achievements, and pays out rewards. */
export function startWatchers() {
  let lastLevel = levelFromXp(useArcade.getState().xp).level;

  // Silently mark achievements already earned (e.g. after an update adds new ones).
  const s0 = useArcade.getState();
  const pre = Object.fromEntries(ACHIEVEMENTS.filter((a) => isUnlocked(a, s0) && !s0.achievements[a.id]).map((a) => [a.id, Date.now()]));
  if (Object.keys(pre).length) useArcade.setState({ achievements: { ...s0.achievements, ...pre } });

  return useArcade.subscribe((s) => {
    const level = levelFromXp(s.xp).level;
    if (level > lastLevel) {
      let coins = 0;
      for (let l = lastLevel + 1; l <= level; l++) coins += levelUpCoins(l);
      lastLevel = level;
      useToasts.setState({ levelUp: { level, coins, title: rankTitle(level) } });
      sfx.levelUp();
      s.addRewards({ coins });
      return;
    }
    lastLevel = level;

    const fresh = ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && isUnlocked(a, s));
    if (!fresh.length) return;
    const coins = fresh.reduce((n, a) => n + a.coins, 0);
    useArcade.setState({
      achievements: { ...s.achievements, ...Object.fromEntries(fresh.map((a) => [a.id, Date.now()])) },
      coins: s.coins + coins,
    });
    sfx.coin();
    for (const a of fresh) toast({ icon: a.icon, title: `Achievement: ${a.name}`, body: `${a.desc} · +${a.coins} coins` });
  });
}
