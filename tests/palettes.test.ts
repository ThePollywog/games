import { describe, expect, it } from 'vitest';
import { PALETTES } from '../src/games/sort/palettes.ts';

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('palettes', () => {
  for (const p of PALETTES) {
    // The background's base color is its last hex; the brand palette sits on the paper grid.
    const bg = p.bg.match(/#[0-9a-f]{6}/gi)?.at(-1) ?? '#e4e3db';
    it(`${p.name}: 12 distinct colors that all stand out from the background`, () => {
      expect(new Set(p.colors).size).toBe(12);
      for (const c of p.colors) expect(contrast(c, bg), `${c} on ${bg}`).toBeGreaterThanOrEqual(1.5);
    });
  }
});
