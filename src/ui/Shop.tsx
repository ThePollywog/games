import { Check, Coins } from 'lucide-react';
import { PALETTES } from '../games/sort/palettes';
import { sfx } from '../platform/feedback';
import { toast } from '../platform/notify';
import { useArcade } from '../platform/store';

export function Shop() {
  const { coins, palettes, palette, buyPalette, equipPalette } = useArcade();
  return (
    <div>
      <p className="muted small">
        Earn coins by solving puzzles, keeping streaks and unlocking achievements. No ads, no purchases — ever.
      </p>
      <div className="shop-grid">
        {PALETTES.map((p) => {
          const owned = palettes.includes(p.id);
          const active = palette === p.id;
          return (
            <div key={p.id} className={`shop-item${active ? ' active' : ''}`} style={{ background: p.bg }}>
              <div className="swatches">
                {p.colors.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </div>
              <strong>{p.name}</strong>
              {active ? (
                <button className="btn small" disabled>
                  <Check size={14} /> Equipped
                </button>
              ) : owned ? (
                <button className="btn small" onClick={() => equipPalette(p.id)}>
                  Equip
                </button>
              ) : (
                <button
                  className="btn small primary"
                  disabled={coins < p.price}
                  onClick={() => {
                    if (buyPalette(p.id, p.price)) {
                      sfx.coin();
                      toast({ icon: '🎨', title: `${p.name} unlocked!` });
                    }
                  }}
                >
                  <Coins size={14} /> {p.price}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
