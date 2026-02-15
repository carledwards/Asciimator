// Connection bit flags
export const N = 1;  // up
export const S = 2;  // down
export const E = 4;  // right
export const W = 8;  // left

export type BoxStyle = 'single' | 'double';

const singleMap: Record<number, string> = {
  [E | W]:         '─',
  [N | S]:         '│',
  [S | E]:         '┌',
  [S | W]:         '┐',
  [N | E]:         '└',
  [N | W]:         '┘',
  [N | S | E]:     '├',
  [N | S | W]:     '┤',
  [E | W | S]:     '┬',
  [E | W | N]:     '┴',
  [N | S | E | W]: '┼',
};

const doubleMap: Record<number, string> = {
  [E | W]:         '═',
  [N | S]:         '║',
  [S | E]:         '╔',
  [S | W]:         '╗',
  [N | E]:         '╚',
  [N | W]:         '╝',
  [N | S | E]:     '╠',
  [N | S | W]:     '╣',
  [E | W | S]:     '╦',
  [E | W | N]:     '╩',
  [N | S | E | W]: '╬',
};

// Build reverse maps: char -> { connections, style }
const charToInfoMap: Record<string, { connections: number; style: BoxStyle }> = {};
for (const [k, v] of Object.entries(singleMap)) {
  charToInfoMap[v] = { connections: Number(k), style: 'single' };
}
for (const [k, v] of Object.entries(doubleMap)) {
  charToInfoMap[v] = { connections: Number(k), style: 'double' };
}

export function isBoxChar(ch: string): boolean {
  return ch in charToInfoMap;
}

export function charToConnections(ch: string): { connections: number; style: BoxStyle } {
  return charToInfoMap[ch] ?? { connections: 0, style: 'single' };
}

export function connectionsToChar(connections: number, style: BoxStyle = 'single'): string {
  const map = style === 'double' ? doubleMap : singleMap;
  if (map[connections]) return map[connections];
  // Single-direction fallbacks
  if (connections === N || connections === S) return style === 'double' ? '║' : '│';
  if (connections === E || connections === W) return style === 'double' ? '═' : '─';
  return style === 'double' ? '═' : '─';
}

export function resolveChar(existingChar: string | undefined, neededConnections: number, style: BoxStyle = 'single'): string {
  if (!existingChar || !isBoxChar(existingChar)) {
    return connectionsToChar(neededConnections, style);
  }
  const info = charToConnections(existingChar);
  // Only merge connections if existing char is the same style
  if (info.style === style) {
    return connectionsToChar(info.connections | neededConnections, style);
  }
  // Different style — overwrite (treat as 0 existing connections)
  return connectionsToChar(neededConnections, style);
}
