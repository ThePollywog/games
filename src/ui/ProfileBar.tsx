import { Coins, Flame } from 'lucide-react';
import { levelFromXp, rankTitle } from '../platform/progression';
import { liveStreak, useArcade } from '../platform/store';
import { useUi } from './uiStore';

export function CoinPill() {
  const coins = useArcade((s) => s.coins);
  return (
    <button className="pill coin" onClick={() => useUi.getState().open('shop')} aria-label="Coins (open shop)">
      <Coins size={16} /> {coins.toLocaleString()}
    </button>
  );
}

export function StreakPill() {
  const streak = useArcade((s) => liveStreak(s.streak));
  return (
    <span className={`pill streak${streak ? ' lit' : ''}`} title="Daily streak: solve a puzzle every day">
      <Flame size={16} /> {streak}
    </span>
  );
}

export function ProfileBar() {
  const { name, xp } = useArcade();
  const lv = levelFromXp(xp);
  return (
    <header className="profile-bar">
      <button className="avatar" onClick={() => useUi.getState().open('settings')} aria-label="Profile & settings">
        {name.slice(0, 2).toUpperCase()}
        <span className="avatar-level">{lv.level}</span>
      </button>
      <div className="profile-meta">
        <strong>{name}</strong>
        <span className="muted small">{rankTitle(lv.level)}</span>
        <div className="bar xp" title={`${lv.into} / ${lv.need} XP`}>
          <div style={{ width: `${(lv.into / lv.need) * 100}%` }} />
        </div>
      </div>
      <StreakPill />
      <CoinPill />
    </header>
  );
}
