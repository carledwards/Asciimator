import { CompositeBuffer } from '../rendering/CompositeBuffer';
import { ExportRegion } from './ExportPlainText';

export function exportPython(
  buffer: CompositeBuffer,
  variableName: string = 'ascii_art',
  region?: ExportRegion,
  includeColors?: boolean,
): string {
  const cells = buffer.flatten();
  const transparencyMap = buffer.getTransparencyMap();
  const y1 = region ? region.y1 : 0;
  const y2 = region ? region.y2 : cells.length - 1;
  const x1 = region ? region.x1 : 0;
  const x2 = region ? region.x2 : (cells[0]?.length ?? 1) - 1;

  const lines: string[] = [];
  const colorLines: string[] = [];

  for (let y = y1; y <= y2; y++) {
    if (y < 0 || y >= cells.length) continue;
    const row = cells[y];
    const tRow = transparencyMap[y];
    let line = '';
    const colorRow: string[] = [];

    for (let x = x1; x <= x2; x++) {
      if (x < 0 || x >= row.length) continue;
      const cell = row[x];
      const rawCh = cell.char || ' ';
      const isTransparent = !!(tRow && tRow[x]);
      line += rawCh === ' ' && !isTransparent ? '█' : rawCh;
      if (includeColors) {
        const fg = cell.attributes.foreground;
        const bg = cell.attributes.background;
        colorRow.push(`{"fg": ${fg}, "bg": ${bg}}`);
      }
    }

    const escaped = line
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");

    lines.push(`    '${escaped}',`);
    if (includeColors) {
      colorLines.push(`    [${colorRow.join(', ')}],`);
    }
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === "'',") {
    lines.pop();
    if (includeColors) colorLines.pop();
  }

  let output = `${variableName} = [\n${lines.join('\n')}\n]\n`;

  if (includeColors) {
    output += `\n${variableName}_colors = [\n${colorLines.join('\n')}\n]\n`;
  }

  return output;
}
