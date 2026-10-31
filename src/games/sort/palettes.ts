export interface Palette {
  id: string;
  name: string;
  price: number;
  colors: string[];
  bg: string;
}

// Each palette needs 12 colors that stay distinguishable side by side and stand out from the paper
// background: no whites or creams (they vanish in a glass vial on paper), every color at least ~1.6:1
// against its background, and every pair at least ~15 apart in CIEDE2000. They're vivid but flat, per
// the Pollywog brand (BRANDING): no neon glows or gradients.
export const PALETTES: Palette[] = [
  {
    // The brand palette: the mission wallpaper's orange, teal, ink and maroon, plus saturated takes on
    // its sand, slate blue, moss, plum and rust. Hex Marks uses the first 8.
    id: 'classic',
    name: 'Mission',
    price: 0,
    colors: ['#e7730c', '#0f8a96', '#16232a', '#b8322f', '#dba01a', '#2a56d6', '#5e9a2e', '#4aa8e0', '#7d3f9a', '#d4547a', '#8b5a2b', '#7d8a86'],
    bg: 'var(--grid-paper)',
  },
  {
    id: 'neon',
    name: 'Bioluminescence',
    price: 400,
    colors: ['#008f9c', '#1f8f4e', '#3567d6', '#c79000', '#9a3fc0', '#e8600a', '#16243a', '#d6407a', '#0b5f73', '#8ab320', '#c22d2d', '#6a4a2a'],
    bg: 'repeating-linear-gradient(0deg, rgba(28, 45, 49, 0.12) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(28, 45, 49, 0.12) 0 1px, transparent 1px 60px), #c9cdc8',
  },
  {
    id: 'pastel',
    name: 'Sea Glass',
    price: 400,
    colors: ['#d0625a', '#4f86c6', '#3a9e74', '#d19a1e', '#8e6cc4', '#e0782c', '#22a1ad', '#c9658f', '#7a5636', '#7fa034', '#2a347f', '#5f6b62'],
    bg: 'repeating-linear-gradient(0deg, rgba(13, 84, 96, 0.1) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(13, 84, 96, 0.1) 0 1px, transparent 1px 60px), #dde3df',
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    price: 700,
    colors: ['#e0563f', '#1f6fb2', '#0f8a7a', '#d6a614', '#6a3fa0', '#ee7414', '#3aa9d4', '#d0608c', '#6b4226', '#6aa335', '#0f2e52', '#a62639'],
    bg: 'repeating-linear-gradient(0deg, rgba(28, 45, 49, 0.1) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(28, 45, 49, 0.1) 0 1px, transparent 1px 60px), #d3d9dc',
  },
  {
    id: 'sunset',
    name: 'Red Sky at Night',
    price: 700,
    colors: ['#c8302a', '#1d3a5f', '#4f8a3c', '#e09b14', '#8a3f8f', '#e8691a', '#2f8fc0', '#d65f84', '#6e4322', '#93a02a', '#6a6ae0', '#1f2b2e'],
    bg: 'repeating-linear-gradient(0deg, rgba(142, 44, 44, 0.08) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(142, 44, 44, 0.08) 0 1px, transparent 1px 60px), #e6ddd3',
  },
  {
    id: 'candy',
    name: 'Coral Reef',
    price: 1200,
    colors: ['#e8505b', '#3a62c4', '#3a9a2a', '#e8a514', '#a23b8c', '#f07a24', '#12a0b0', '#f06aa0', '#8a4f2a', '#5f6b70', '#2a1f6f', '#0f6a50'],
    bg: 'repeating-linear-gradient(0deg, rgba(231, 115, 12, 0.08) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(231, 115, 12, 0.08) 0 1px, transparent 1px 60px), #e9e1d6',
  },
];

export const paletteById = (id: string) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/** Shapes drawn on each color in color-blind mode, indexed like palette colors. */
export const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚', '♥', '♠', '♣', '☀', '☾', '✿'];

const INK_TEXT = 'rgba(11, 23, 28, 0.6)';
const CREAM_TEXT = 'rgba(241, 233, 210, 0.9)';

/** Text color for a label drawn on a piece: ink on light colors, cream on dark ones (ink, plum, brick...). */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const l = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast against ink (#0b171c, L≈0.008) vs cream (#f1e9d2, L≈0.81): pick the larger.
  return (l + 0.05) / 0.058 >= 0.86 / (l + 0.05) ? INK_TEXT : CREAM_TEXT;
}
