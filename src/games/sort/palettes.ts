export interface Palette {
  id: string;
  name: string;
  price: number;
  colors: string[];
  bg: string;
}

// Each palette needs 12 colors that stay distinguishable side by side. All of them are muted,
// flat colors that sit on paper, per the Pollywog brand (BRANDING): no neon or candy brights.
export const PALETTES: Palette[] = [
  {
    // The brand palette: muted versions of the mission wallpaper's colors (see BRANDING).
    id: 'classic',
    name: 'Mission',
    price: 0,
    colors: ['#e7730c', '#1b7a80', '#7a7442', '#8e2c2c', '#d2b26e', '#4e6e99', '#efe8d4', '#4f7a3a', '#1c2d31', '#6b4c7a', '#8a5a33', '#8d9799'],
    bg: 'var(--grid-paper)',
  },
  {
    id: 'neon',
    name: 'Bioluminescence',
    price: 400,
    colors: ['#1b7a80', '#3f8f6b', '#5a7fa8', '#c8b45a', '#8a5f9e', '#d07a3a', '#7fb8b4', '#b25a6e', '#2c4a6b', '#9fb86a', '#5b4a7f', '#e8e4d2'],
    bg: 'repeating-linear-gradient(0deg, rgba(28, 45, 49, 0.12) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(28, 45, 49, 0.12) 0 1px, transparent 1px 60px), #c9cdc8',
  },
  {
    id: 'pastel',
    name: 'Sea Glass',
    price: 400,
    colors: ['#c4857f', '#87a3c4', '#8fb89b', '#d6c47f', '#a593c2', '#d9a073', '#86bfc2', '#c79db3', '#a68b70', '#b3c585', '#7a83b3', '#efece2'],
    bg: 'repeating-linear-gradient(0deg, rgba(13, 84, 96, 0.1) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(13, 84, 96, 0.1) 0 1px, transparent 1px 60px), #dde3df',
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    price: 700,
    colors: ['#c4614f', '#2f5f8a', '#2f7f78', '#c9a656', '#5d4f8a', '#c98a4f', '#5e9fb5', '#b47a92', '#5c4130', '#7f9c5e', '#1f3b5c', '#e6e2d4'],
    bg: 'repeating-linear-gradient(0deg, rgba(28, 45, 49, 0.1) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(28, 45, 49, 0.1) 0 1px, transparent 1px 60px), #d3d9dc',
  },
  {
    id: 'sunset',
    name: 'Red Sky at Night',
    price: 700,
    colors: ['#a83a32', '#24384f', '#5d7a52', '#d4a24a', '#6e4a7a', '#c8672a', '#6a92a8', '#b8697a', '#6b4a2e', '#a8b07a', '#3b3a6b', '#e2ddd0'],
    bg: 'repeating-linear-gradient(0deg, rgba(142, 44, 44, 0.08) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(142, 44, 44, 0.08) 0 1px, transparent 1px 60px), #e6ddd3',
  },
  {
    id: 'candy',
    name: 'Coral Reef',
    price: 1200,
    colors: ['#c75a5a', '#4a68a8', '#5a8a3e', '#d9b04a', '#8a4a7a', '#d77a3a', '#4f9aa8', '#c4708f', '#8a5a3a', '#8fbf8a', '#3f3a7a', '#efe6d2'],
    bg: 'repeating-linear-gradient(0deg, rgba(231, 115, 12, 0.08) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(231, 115, 12, 0.08) 0 1px, transparent 1px 60px), #e9e1d6',
  },
];

export const paletteById = (id: string) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/** Shapes drawn on each color in color-blind mode, indexed like palette colors. */
export const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚', '♥', '♠', '♣', '☀', '☾', '✿'];
