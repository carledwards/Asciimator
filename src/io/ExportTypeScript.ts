import { CompositeBuffer } from '../rendering/CompositeBuffer';
import { ExportRegion } from './ExportPlainText';

export function exportTypeScript(buffer: CompositeBuffer, variableName: string = 'asciiArt', region?: ExportRegion, includeColors?: boolean): string {
  const cells = buffer.flatten();
  const y1 = region ? region.y1 : 0;
  const y2 = region ? region.y2 : cells.length - 1;
  const x1 = region ? region.x1 : 0;
  const x2 = region ? region.x2 : (cells[0]?.length ?? 1) - 1;

  const lines: string[] = [];
  const colorLines: string[] = [];

  for (let y = y1; y <= y2; y++) {
    if (y < 0 || y >= cells.length) continue;
    const row = cells[y];
    let line = '';
    const colorRow: string[] = [];
    for (let x = x1; x <= x2; x++) {
      if (x < 0 || x >= row.length) continue;
      line += row[x].char || ' ';
      if (includeColors) {
        const fg = row[x].attributes.foreground;
        const bg = row[x].attributes.background;
        colorRow.push(`{fg:${fg},bg:${bg}}`);
      }
    }
    lines.push(`  '${line.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
    if (includeColors) {
      colorLines.push(`  [${colorRow.join(',')}]`);
    }
  }

  // Trim trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === "''") {
    lines.pop();
    if (includeColors) colorLines.pop();
  }

  let output = `const ${variableName}: string[] = [\n${lines.join(',\n')}\n];\n`;

  if (includeColors) {
    output += `\nconst ${variableName}Colors: {fg:number,bg:number}[][] = [\n${colorLines.join(',\n')}\n];\n`;
  }

  return output;
}
