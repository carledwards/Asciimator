import { Document } from '../document/Document';
import { LayerCell } from '../core/types';
import { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';

interface Bounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function normalizeBounds(bounds: Bounds): Bounds {
  return {
    x1: Math.min(bounds.x1, bounds.x2),
    y1: Math.min(bounds.y1, bounds.y2),
    x2: Math.max(bounds.x1, bounds.x2),
    y2: Math.max(bounds.y1, bounds.y2),
  };
}

export function justifyHorizontal(
  doc: Document,
  layerId: string,
  bounds: Bounds,
  alignment: 'left' | 'center' | 'right',
  undoManager: UndoRedoManager,
): void {
  const b = normalizeBounds(bounds);
  const layer = doc.layerManager.getLayerById(layerId);
  if (!layer) return;

  const width = b.x2 - b.x1 + 1;
  const changes: CellChange[] = [];

  for (let y = b.y1; y <= b.y2; y++) {
    // Collect cells in this row within selection
    const rowCells: LayerCell[] = [];
    for (let x = b.x1; x <= b.x2; x++) {
      rowCells.push(layer.getCell(x, y));
    }

    // Find the non-space content span
    let firstContent = -1;
    let lastContent = -1;
    for (let i = 0; i < rowCells.length; i++) {
      const cell = rowCells[i];
      if (cell && cell.char !== ' ') {
        if (firstContent === -1) firstContent = i;
        lastContent = i;
      }
    }

    // Skip empty rows
    if (firstContent === -1) continue;

    // Extract the content cells (preserve colors/attributes)
    const contentCells = rowCells.slice(firstContent, lastContent + 1);
    const contentWidth = contentCells.length;

    let offset: number;
    if (alignment === 'left') {
      offset = 0;
    } else if (alignment === 'right') {
      offset = width - contentWidth;
    } else {
      offset = Math.floor((width - contentWidth) / 2);
    }

    // Build new row: clear all, then place content at offset
    for (let i = 0; i < width; i++) {
      const x = b.x1 + i;
      const oldCell = layer.getCell(x, y);
      let newCell: LayerCell;

      if (i >= offset && i < offset + contentWidth) {
        newCell = contentCells[i - offset];
      } else {
        newCell = null;
      }

      // Only record change if different
      const oldChar = oldCell?.char ?? null;
      const newChar = newCell?.char ?? null;
      if (oldChar !== newChar || JSON.stringify(oldCell?.attributes) !== JSON.stringify(newCell?.attributes)) {
        changes.push({
          x,
          y,
          oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
          newCell: newCell ? { ...newCell, attributes: { ...newCell.attributes } } : null,
        });
      }
    }
  }

  if (changes.length > 0) {
    undoManager.execute(new CellChangeCommand(doc, layerId, changes, `Justify ${alignment}`));
  }
}

export function justifyVertical(
  doc: Document,
  layerId: string,
  bounds: Bounds,
  alignment: 'top' | 'bottom',
  undoManager: UndoRedoManager,
): void {
  const b = normalizeBounds(bounds);
  const layer = doc.layerManager.getLayerById(layerId);
  if (!layer) return;

  const changes: CellChange[] = [];
  const height = b.y2 - b.y1 + 1;

  // Collect non-empty rows (rows that have at least one non-space cell)
  const contentRows: { y: number; cells: LayerCell[] }[] = [];
  for (let y = b.y1; y <= b.y2; y++) {
    const cells: LayerCell[] = [];
    let hasContent = false;
    for (let x = b.x1; x <= b.x2; x++) {
      const cell = layer.getCell(x, y);
      cells.push(cell);
      if (cell && cell.char !== ' ') hasContent = true;
    }
    if (hasContent) {
      contentRows.push({ y, cells });
    }
  }

  if (contentRows.length === 0) return;

  const offset = alignment === 'top' ? 0 : height - contentRows.length;

  // Build the new arrangement
  for (let rowIdx = 0; rowIdx < height; rowIdx++) {
    const targetY = b.y1 + rowIdx;
    const sourceIdx = rowIdx - offset;
    const width = b.x2 - b.x1 + 1;

    for (let i = 0; i < width; i++) {
      const x = b.x1 + i;
      const oldCell = layer.getCell(x, targetY);
      let newCell: LayerCell;

      if (sourceIdx >= 0 && sourceIdx < contentRows.length) {
        newCell = contentRows[sourceIdx].cells[i];
      } else {
        newCell = null;
      }

      const oldChar = oldCell?.char ?? null;
      const newChar = newCell?.char ?? null;
      if (oldChar !== newChar || JSON.stringify(oldCell?.attributes) !== JSON.stringify(newCell?.attributes)) {
        changes.push({
          x,
          y: targetY,
          oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
          newCell: newCell ? { ...newCell, attributes: { ...newCell.attributes } } : null,
        });
      }
    }
  }

  if (changes.length > 0) {
    undoManager.execute(new CellChangeCommand(doc, layerId, changes, `Justify ${alignment}`));
  }
}
