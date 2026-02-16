import { Tool } from './Tool';
import { Position, InputModifiers } from '../core/types';
import { Document } from '../document/Document';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';

export class EraserTool implements Tool {
  private isErasing = false;
  private undoManager!: UndoRedoManager;
  private pendingChanges: CellChange[] = [];

  constructor(private doc: Document) {}

  setUndoManager(um: UndoRedoManager): void { this.undoManager = um; }

  setDocument(doc: Document): void {
    this.doc = doc;
    this.isErasing = false;
  }

  getName() { return 'eraser'; }
  getIcon() { return '⌫'; }
  getShortcut() { return 'E'; }

  onMouseDown(pos: Position, _modifiers: InputModifiers): void {
    this.isErasing = true;
    this.pendingChanges = [];
    this.eraseAt(pos);
  }

  onMouseDrag(pos: Position): void {
    if (!this.isErasing) return;
    this.eraseAt(pos);
  }

  onMouseUp(_pos: Position): void {
    if (this.isErasing && this.pendingChanges.length > 0 && this.undoManager) {
      const layerId = this.doc.layerManager.getActiveLayerId();
      this.undoManager.execute(new CellChangeCommand(this.doc, layerId, [...this.pendingChanges], 'Erase'));
      this.pendingChanges = [];
    }
    this.isErasing = false;
  }

  onMouseMove(_pos: Position): void {}
  onKeyDown(_key: string, _modifiers: InputModifiers): void {}
  onActivate(): void {}
  onDeactivate(): void { this.isErasing = false; }

  private eraseAt(pos: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || this.doc.layerManager.isLayerEffectivelyLocked(layer)) return;
    const oldCell = layer.getCell(pos.x, pos.y);
    if (oldCell === null) return; // Already transparent
    this.pendingChanges.push({
      x: pos.x, y: pos.y,
      oldCell: { ...oldCell, attributes: { ...oldCell.attributes } },
      newCell: null,
    });
    layer.setCell(pos.x, pos.y, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
