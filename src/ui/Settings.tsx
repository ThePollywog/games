import { useState } from 'react';
import { api } from '../platform/api';
import { toast } from '../platform/notify';
import { useArcade, type Settings as S } from '../platform/store';

const TOGGLES: { key: keyof S; label: string; hint: string }[] = [
  { key: 'sound', label: 'Sound effects', hint: 'Pours, chimes and fanfares' },
  { key: 'haptics', label: 'Vibration', hint: 'Haptic taps on supported phones' },
  { key: 'colorblind', label: 'Color-blind symbols', hint: 'Draw a shape on every color' },
  { key: 'reducedMotion', label: 'Reduce motion', hint: 'Skip pour animations and confetti' },
];

export function Settings() {
  const { name, settings, setSettings, setName, reset } = useArcade();
  const [draft, setDraft] = useState(name);
  const [confirmReset, setConfirmReset] = useState(false);

  async function saveName() {
    const clean = draft.trim();
    if (clean.length < 2 || clean === name) return;
    setName(clean.slice(0, 18));
    try {
      const r = await api.rename(clean);
      setName(r.name);
      toast({ icon: '✏️', title: 'Name updated' });
    } catch (e) {
      toast({ icon: '📴', title: 'Saved locally', body: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <div className="settings">
      {api.showNative ? (
        <p className="muted small">Leaderboards use your Game Center name.</p>
      ) : (
        <label className="field">
          <span>Leaderboard name</span>
          <div className="row">
            <input value={draft} maxLength={18} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} />
            <button className="btn small primary" onClick={saveName} disabled={draft.trim() === name || draft.trim().length < 2}>
              Save
            </button>
          </div>
        </label>
      )}
      {TOGGLES.map((t) => (
        <label key={t.key} className="toggle">
          <div>
            <strong>{t.label}</strong>
            <span>{t.hint}</span>
          </div>
          <input type="checkbox" checked={settings[t.key]} onChange={(e) => setSettings({ [t.key]: e.target.checked })} />
        </label>
      ))}
      <div className="danger">
        {confirmReset ? (
          <div className="row">
            <span>Erase all progress?</span>
            <button className="btn small danger-btn" onClick={() => (reset(), setConfirmReset(false))}>
              Erase
            </button>
            <button className="btn small" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn small ghost" onClick={() => setConfirmReset(true)}>
            Reset progress
          </button>
        )}
      </div>
    </div>
  );
}
