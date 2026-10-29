import { ACHIEVEMENTS } from '../platform/achievements';
import { useArcade } from '../platform/store';

export function Achievements() {
  const state = useArcade();
  const done = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  return (
    <div>
      <div className="progress-line">
        <span>
          {done} / {ACHIEVEMENTS.length} unlocked
        </span>
        <div className="bar">
          <div style={{ width: `${(done / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
      </div>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = !!state.achievements[a.id];
          const [cur, goal] = a.progress(state);
          return (
            <div key={a.id} className={`ach${unlocked ? ' unlocked' : ''}`}>
              <div className="ach-icon">{unlocked ? a.icon : '🔒'}</div>
              <div className="ach-text">
                <strong>{a.name}</strong>
                <span>{a.desc}</span>
                {!unlocked && goal > 1 && (
                  <div className="bar thin">
                    <div style={{ width: `${(cur / goal) * 100}%` }} />
                  </div>
                )}
              </div>
              <div className="ach-reward">{unlocked ? '✓' : `+${a.coins} coins`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
