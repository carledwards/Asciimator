import { CompositeBuffer } from '../rendering/CompositeBuffer';

export interface ExportRegion {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// DOS color index to ANSI escape code mappings
// Indices 0-7 → foreground 30-37, background 40-47
// Indices 8-15 → foreground 90-97, background 100-107
function dosToAnsiFg(index: number): number {
  return index < 8 ? 30 + index : 90 + (index - 8);
}

function dosToAnsiBg(index: number): number {
  return index < 8 ? 40 + index : 100 + (index - 8);
}

export function exportPlainText(buffer: CompositeBuffer, region?: ExportRegion, includeAnsi?: boolean): string {
  const cells = buffer.flatten();
  const y1 = region ? region.y1 : 0;
  const y2 = region ? region.y2 : cells.length - 1;
  const x1 = region ? region.x1 : 0;
  const x2 = region ? region.x2 : (cells[0]?.length ?? 1) - 1;

  const lines: string[] = [];
  for (let y = y1; y <= y2; y++) {
    if (y < 0 || y >= cells.length) continue;
    const row = cells[y];
    let line = '';
    for (let x = x1; x <= x2; x++) {
      if (x < 0 || x >= row.length) continue;
      const cell = row[x];
      const ch = cell.char || ' ';
      if (includeAnsi) {
        const fg = dosToAnsiFg(cell.attributes.foreground);
        const bg = dosToAnsiBg(cell.attributes.background);
        line += `\x1b[${fg};${bg}m${ch}`;
      } else {
        line += ch;
      }
    }
    if (includeAnsi) {
      line += '\x1b[0m';
    }
    lines.push(line);
  }
  // Trim trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  return lines.join('\n');
}
