// Synthesized sound effects (no audio assets) and haptics.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useArcade } from './store';

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (!useArcade.getState().settings.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  dur: number,
  { type = 'sine' as OscillatorType, gain = 0.12, delay = 0, to = 0 } = {},
) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

export const sfx = {
  tap: () => tone(660, 0.05, { type: 'triangle', gain: 0.06 }),
  error: () => tone(160, 0.14, { type: 'square', gain: 0.04, to: 110 }),
  /** Rising "glug" — pitch climbs as the target tube fills. */
  pour(amount: number, fill: number) {
    for (let i = 0; i < amount; i++) {
      const f = 260 + (fill + i) * 70;
      tone(f, 0.09, { delay: i * 0.07, gain: 0.08, to: f * 1.35 });
    }
  },
  /** Glassy clack; slightly higher the fuller the tube. */
  ball(fill: number) {
    tone(900 + fill * 120, 0.05, { type: 'triangle', gain: 0.09 });
    tone(1800 + fill * 200, 0.03, { type: 'sine', gain: 0.04, delay: 0.01 });
  },
  /** Ratchet clicks as nuts screw down. */
  nut(count: number) {
    for (let i = 0; i < 3 + count * 2; i++) tone(320 + (i % 2) * 90, 0.025, { type: 'square', gain: 0.035, delay: i * 0.045 });
  },
  complete(combo: number) {
    const start = Math.min(combo - 1, 4);
    [0, 2, 4].forEach((n, i) => tone(NOTES[start + n] ?? 1500, 0.22, { delay: i * 0.06, type: 'triangle', gain: 0.09 }));
  },
  win() {
    [0, 2, 4, 7].forEach((n, i) => tone(NOTES[n] ?? 1046, 0.35, { delay: i * 0.11, type: 'triangle', gain: 0.1 }));
  },
  coin: () => {
    tone(988, 0.08, { type: 'square', gain: 0.04 });
    tone(1319, 0.2, { type: 'square', gain: 0.04, delay: 0.07 });
  },
  levelUp() {
    [0, 1, 2, 3, 4, 5, 7].forEach((n, i) => tone(NOTES[n], 0.18, { delay: i * 0.06, type: 'triangle', gain: 0.08 }));
  },
  tick: () => tone(1200, 0.03, { type: 'square', gain: 0.03 }),
};

/** iOS has no navigator.vibrate, so the native app maps patterns to Taptic Engine impacts. */
function nativeBuzz(pattern: number | number[]) {
  let delay = 0;
  // Same shape as navigator.vibrate: [on, off, on, ...] in ms.
  (typeof pattern === 'number' ? [pattern] : pattern).forEach((ms, i) => {
    if (i % 2 === 0) {
      const style = ms >= 35 ? ImpactStyle.Heavy : ms >= 20 ? ImpactStyle.Medium : ImpactStyle.Light;
      setTimeout(() => Haptics.impact({ style }).catch(() => {}), delay);
    }
    delay += ms;
  });
}

export function buzz(pattern: number | number[]) {
  if (!useArcade.getState().settings.haptics) return;
  if (Capacitor.isNativePlatform()) nativeBuzz(pattern);
  else if ('vibrate' in navigator) navigator.vibrate(pattern);
}
