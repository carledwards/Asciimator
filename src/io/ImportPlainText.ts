import { Cell, LayerCell } from '../core/types';
import { Document } from '../document/Document';
import { CellChangeCommand, CellChange } from '../state/Command';
import { UndoRedoManager } from '../state/UndoRedoManager';
import { eventBus, Events } from '../core/EventBus';

export function importPlainText(
  text: string,
  doc: Document,
  undoManager: UndoRedoManager,
  foreground: number = 15,
  background: number = 0,
): void {
  const layer = doc.layerManager.getActiveLayer();
  if (!layer || doc.layerManager.isLayerEffectivelyLocked(layer)) return;

  const lines = text.split('\n');
  const changes: CellChange[] = [];

  for (let y = 0; y < Math.min(lines.length, doc.height); y++) {
    for (let x = 0; x < Math.min(lines[y].length, doc.width); x++) {
      const ch = lines[y][x];
      if (ch === ' ') continue;
      const oldCell = layer.getCell(x, y);
      const newCell: Cell = {
        char: ch,
        attributes: { foreground, background },
      };
      changes.push({
        x, y,
        oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
        newCell,
      });
      layer.setCell(x, y, newCell);
    }
  }

  if (changes.length > 0) {
    undoManager.execute(new CellChangeCommand(doc, layer.id, changes, 'Import text'));
  }
  eventBus.emit(Events.DOCUMENT_CHANGED, null);
  eventBus.emit(Events.RENDER_REQUEST, null);
}
