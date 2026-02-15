import { Tool } from './Tool';
import { Position, InputModifiers, Cell, CellAttributes } from '../core/types';
import { Document } from '../document/Document';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand } from '../state/Command';

export class PencilTool implements Tool {
  private isDrawing = false;
  private currentChar = ' ';
  private foreground = 15;
  private background = 0;
  private undoManager!: UndoRedoManager;
  private pendingChanges: { x: number; y: number; oldCell: Cell | null; newCell: Cell }[] = [];

  constructor(private doc: Document) {
    eventBus.on(Events.CHAR_CHANGED, (ch: unknown) => { this.currentChar = ch as string; });
    eventBus.on(Events.COLOR_CHANGED, (data: unknown) => {
      const d = data as { foreground?: number; background?: number };
      if (d.foreground !== undefined) this.foreground = d.foreground;
      if (d.background !== undefined) this.background = d.background;
    });
  }

  setUndoManager(um: UndoRedoManager): void {
    this.undoManager = um;
  }

  setDocument(doc: Document): void {
    this.doc = doc;
  }

  getName() { return 'pencil'; }
  getIcon() { return '✏'; }
  getShortcut() { return 'P'; }

  onMouseDown(pos: Position, _modifiers: InputModifiers): void {
    this.isDrawing = true;
    this.pendingChanges = [];
    this.drawAt(pos);
  }

  onMouseDrag(pos: Position): void {
    if (!this.isDrawing) return;
    this.drawAt(pos);
  }

  onMouseUp(_pos: Position): void {
    if (this.isDrawing && this.pendingChanges.length > 0 && this.undoManager) {
      const layerId = this.doc.layerManager.getActiveLayerId();
      this.undoManager.execute(new CellChangeCommand(this.doc, layerId, [...this.pendingChanges]));
      this.pendingChanges = [];
    }
    this.isDrawing = false;
  }

  onMouseMove(_pos: Position): void {}

  onKeyDown(_key: string, _modifiers: InputModifiers): void {}

  onActivate(): void {}
  onDeactivate(): void {
    this.isDrawing = false;
  }

  private drawAt(pos: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || layer.locked) return;
    const oldCell = layer.getCell(pos.x, pos.y);
    const newCell: Cell = {
      char: this.currentChar,
      attributes: { foreground: this.foreground, background: this.background },
    };
    // Track for undo but apply immediately
    this.pendingChanges.push({
      x: pos.x,
      y: pos.y,
      oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
      newCell: { ...newCell, attributes: { ...newCell.attributes } },
    });
    layer.setCell(pos.x, pos.y, newCell);
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
