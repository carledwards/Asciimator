import { CompositeBuffer } from '../rendering/CompositeBuffer';
import { getPaletteColor } from '../core/DosColors';
import { ExportRegion } from './ExportPlainText';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportSVG(
  buffer: CompositeBuffer,
  region?: ExportRegion,
  includeBackgrounds: boolean = true,
): string {
  const cells = buffer.flatten();
  const transparencyMap = buffer.getTransparencyMap();
  const y1 = region ? region.y1 : 0;
  const y2 = region ? region.y2 : cells.length - 1;
  const x1 = region ? region.x1 : 0;
  const x2 = region ? region.x2 : (cells[0]?.length ?? 1) - 1;
  const width = Math.max(0, x2 - x1 + 1);
  const height = Math.max(0, y2 - y1 + 1);

  const charW = 10;
  const charH = 16;
  const svgW = width * charW;
  const svgH = height * charH;
  const fontSize = Math.floor(charH * 0.75);
  const textY = Math.round(charH * 0.53);

  const bgRects: string[] = [];
  const glyphs: string[] = [];

  for (let y = y1; y <= y2; y++) {
    if (y < 0 || y >= cells.length) continue;
    const row = cells[y];
    const tRow = transparencyMap[y];
    for (let x = x1; x <= x2; x++) {
      if (x < 0 || x >= row.length) continue;
      const cell = row[x];
      const rx = (x - x1) * charW;
      const ry = (y - y1) * charH;

      if (includeBackgrounds && tRow && !tRow[x]) {
        bgRects.push(
          `<rect x="${rx}" y="${ry}" width="${charW}" height="${charH}" fill="${getPaletteColor(cell.attributes.background)}"/>`
        );
      }

      const ch = cell.char || ' ';
      if (ch !== ' ') {
        glyphs.push(
          `<text x="${rx}" y="${ry + textY}" fill="${getPaletteColor(cell.attributes.foreground)}">${escapeXml(ch)}</text>`
        );
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}">`,
    `<g font-family="'Courier New','Consolas',monospace" font-size="${fontSize}" font-weight="700">`,
    ...bgRects,
    ...glyphs,
    '</g>',
    '</svg>',
  ].join('\n');
}
