export const DOS_COLORS = {
  BLACK: 0,
  BLUE: 1,
  GREEN: 2,
  CYAN: 3,
  RED: 4,
  MAGENTA: 5,
  BROWN: 6,
  LIGHT_GRAY: 7,
  DARK_GRAY: 8,
  LIGHT_BLUE: 9,
  LIGHT_GREEN: 10,
  LIGHT_CYAN: 11,
  LIGHT_RED: 12,
  LIGHT_MAGENTA: 13,
  YELLOW: 14,
  WHITE: 15,
} as const;

export const DOS_PALETTE: readonly string[] = [
  '#000000', // BLACK
  '#0000aa', // BLUE
  '#00aa00', // GREEN
  '#00aaaa', // CYAN
  '#aa0000', // RED
  '#aa00aa', // MAGENTA
  '#aa5500', // BROWN
  '#aaaaaa', // LIGHT_GRAY
  '#555555', // DARK_GRAY
  '#5555ff', // LIGHT_BLUE
  '#55ff55', // LIGHT_GREEN
  '#55ffff', // LIGHT_CYAN
  '#ff5555', // LIGHT_RED
  '#ff55ff', // LIGHT_MAGENTA
  '#ffff55', // YELLOW
  '#ffffff', // WHITE
];

export const DOS_COLOR_NAMES: readonly string[] = [
  'Black', 'Blue', 'Green', 'Cyan',
  'Red', 'Magenta', 'Brown', 'Light Gray',
  'Dark Gray', 'Light Blue', 'Light Green', 'Light Cyan',
  'Light Red', 'Light Magenta', 'Yellow', 'White',
];

export const TRANSPARENT_COLOR = -1;

export function isTransparent(index: number): boolean {
  return index === TRANSPARENT_COLOR;
}

export function getPaletteColor(index: number): string {
  return DOS_PALETTE[index] ?? DOS_PALETTE[0];
}
