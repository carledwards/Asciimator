import { LayerCell, Position, Cell } from '../core/types';
import { Document } from '../document/Document';
import { CellChangeCommand, CellChange } from './Command';
import { UndoRedoManager } from './UndoRedoManager';
import { eventBus, Events } from '../core/EventBus';

export interface ClipboardRegion {
  cells: LayerCell[][];
  width: number;
  height: number;
}

export class Clipboard {
  private internalBuffer: ClipboardRegion | null = null;

  constructor(private doc: Document, private undoManager: UndoRedoManager) {}

  setDocument(doc: Document): void {
    this.doc = doc;
  }

  setUndoManager(undoManager: UndoRedoManager): void {
    this.undoManager = undoManager;
  }

  copy(startX: number, startY: number, endX: number, endY: number): void {
    const x1 = Math.min(startX, endX);
    const y1 = Math.min(startY, endY);
    const x2 = Math.max(startX, endX);
    const y2 = Math.max(startY, endY);
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;

    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer) return;

    const cells: LayerCell[][] = [];
    for (let y = 0; y < h; y++) {
      const row: LayerCell[] = [];
      for (let x = 0; x < w; x++) {
        const cell = layer.getCell(x1 + x, y1 + y);
        row.push(cell ? { ...cell, attributes: { ...cell.attributes } } : null);
      }
      cells.push(row);
    }

    this.internalBuffer = { cells, width: w, height: h };

    // Also copy as plain text to system clipboard
    const text = cells.map(row =>
      row.map(c => c?.char ?? ' ').join('')
    ).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }

  paste(targetX: number, targetY: number): void {
    if (!this.internalBuffer) return;
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || this.doc.layerManager.isLayerEffectivelyLocked(layer)) return;

    const changes: CellChange[] = [];
    for (let y = 0; y < this.internalBuffer.height; y++) {
      for (let x = 0; x < this.internalBuffer.width; x++) {
        const cell = this.internalBuffer.cells[y][x];
        if (cell) {
          const tx = targetX + x;
          const ty = targetY + y;
          if (tx < this.doc.width && ty < this.doc.height) {
            const oldCell = layer.getCell(tx, ty);
            changes.push({
              x: tx, y: ty,
              oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
              newCell: { ...cell, attributes: { ...cell.attributes } },
            });
          }
        }
      }
    }

    if (changes.length > 0) {
      const cmd = new CellChangeCommand(this.doc, layer.id, changes, 'Paste');
      cmd.execute();
      this.undoManager.execute(cmd);
    }
  }

  async pasteFromSystem(targetX: number, targetY: number): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const layer = this.doc.layerManager.getActiveLayer();
      if (!layer || this.doc.layerManager.isLayerEffectivelyLocked(layer)) return;

      const lines = text.split('\n');
      const changes: CellChange[] = [];
      for (let y = 0; y < lines.length; y++) {
        for (let x = 0; x < lines[y].length; x++) {
          const tx = targetX + x;
          const ty = targetY + y;
          if (tx < this.doc.width && ty < this.doc.height) {
            const oldCell = layer.getCell(tx, ty);
            changes.push({
              x: tx, y: ty,
              oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
              newCell: { char: lines[y][x], attributes: { foreground: 15, background: 0 } },
            });
          }
        }
      }

      if (changes.length > 0) {
        const cmd = new CellChangeCommand(this.doc, layer.id, changes, 'Paste from clipboard');
        cmd.execute();
        this.undoManager.execute(cmd);
      }
    } catch {
      // Clipboard API may not be available
    }
  }

  hasContent(): boolean {
    return this.internalBuffer !== null;
  }
}
