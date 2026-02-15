import { CompositeBuffer } from '../rendering/CompositeBuffer';
import { getPaletteColor } from '../core/DosColors';
import { ExportRegion } from './ExportPlainText';

export async function exportPNG(
  buffer: CompositeBuffer,
  region?: ExportRegion,
  includeBackgrounds: boolean = true,
): Promise<Blob> {
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
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width * charW);
  canvas.height = Math.max(1, height * charH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create PNG export context');

  // Start transparent; explicit cell backgrounds are drawn per-cell below.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const fontSize = Math.floor(charH * 0.75);
  ctx.font = `bold ${fontSize}px "Courier New", "Consolas", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const textY = Math.round(charH * 0.12);

  for (let y = y1; y <= y2; y++) {
    if (y < 0 || y >= cells.length) continue;
    const row = cells[y];
    const tRow = transparencyMap[y];
    for (let x = x1; x <= x2; x++) {
      if (x < 0 || x >= row.length) continue;
      const cell = row[x];
      const px = (x - x1) * charW;
      const py = (y - y1) * charH;

      if (includeBackgrounds && tRow && !tRow[x]) {
        ctx.fillStyle = getPaletteColor(cell.attributes.background);
        ctx.fillRect(px, py, charW, charH);
      }

      const ch = cell.char || ' ';
      if (ch !== ' ') {
        ctx.fillStyle = getPaletteColor(cell.attributes.foreground);
        ctx.fillText(ch, px, py + textY);
      }
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to encode PNG'));
    }, 'image/png');
  });

  return blob;
}
