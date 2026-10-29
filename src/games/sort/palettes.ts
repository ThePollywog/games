export interface Palette {
  id: string;
  name: string;
  price: number;
  colors: string[];
  bg: string;
}

// Each palette needs 12 colors that stay distinguishable side by side.
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
    colors: ['#ff1744', '#2979ff', '#00e676', '#ffea00', '#d500f9', '#ff9100', '#00e5ff', '#ff4081', '#76ff03', '#651fff', '#1de9b6', '#ffffff'],
    bg: 'repeating-linear-gradient(0deg, rgba(28, 45, 49, 0.12) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(28, 45, 49, 0.12) 0 1px, transparent 1px 60px), #c9cdc8',
  },
  {
    id: 'pastel',
    name: 'Sea Glass',
    price: 400,
    colors: ['#ff8fa3', '#7aa7ff', '#7ee3a1', '#ffe873', '#c792ea', '#ffb86b', '#7fe7f2', '#ffb3de', '#c4a484', '#d4f08c', '#8c8cf5', '#f2f2f2'],
    bg: 'repeating-linear-gradient(0deg, rgba(13, 84, 96, 0.1) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(13, 84, 96, 0.1) 0 1px, transparent 1px 60px), #dde3df',
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    price: 700,
    colors: ['#ff6f61', '#0077b6', '#2a9d8f', '#e9c46a', '#8338ec', '#f4a261', '#48cae4', '#ff99c8', '#6b4226', '#90be6d', '#023e8a', '#f1faee'],
    bg: 'repeating-linear-gradient(0deg, rgba(28, 45, 49, 0.1) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(28, 45, 49, 0.1) 0 1px, transparent 1px 60px), #d3d9dc',
  },
  {
    id: 'sunset',
    name: 'Red Sky at Night',
    price: 700,
    colors: ['#d62828', '#1d3557', '#588157', '#fcbf49', '#9d4edd', '#f77f00', '#4cc9f0', '#ff5d8f', '#7f4f24', '#b5e48c', '#3d348b', '#e0e1dd'],
    bg: 'repeating-linear-gradient(0deg, rgba(142, 44, 44, 0.08) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(142, 44, 44, 0.08) 0 1px, transparent 1px 60px), #e6ddd3',
  },
  {
    id: 'candy',
    name: 'Coral Reef',
    price: 1200,
    colors: ['#ff4d6d', '#4361ee', '#38b000', '#ffd60a', '#b5179e', '#fb8500', '#4cc9f0', '#f72585', '#a0522d', '#80ed99', '#3a0ca3', '#fefae0'],
    bg: 'repeating-linear-gradient(0deg, rgba(231, 115, 12, 0.08) 0 1px, transparent 1px 60px), repeating-linear-gradient(90deg, rgba(231, 115, 12, 0.08) 0 1px, transparent 1px 60px), #e9e1d6',
  },
];

export const paletteById = (id: string) => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

/** Shapes drawn on each color in color-blind mode, indexed like palette colors. */
export const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚', '♥', '♠', '♣', '☀', '☾', '✿'];
