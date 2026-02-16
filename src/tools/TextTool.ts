import { Tool } from './Tool';
import { Position, InputModifiers, Cell } from '../core/types';
import { Document } from '../document/Document';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';

export class TextTool implements Tool {
  private cursorPos: Position | null = null;
  private startX = 0;
  private typing = false;
  private foreground = 15;
  private background = 0;
  private undoManager!: UndoRedoManager;
  private pendingChanges: CellChange[] = [];

  constructor(private doc: Document) {
    eventBus.on(Events.COLOR_CHANGED, (data: unknown) => {
      const d = data as { foreground?: number; background?: number };
      if (d.foreground !== undefined) this.foreground = d.foreground;
      if (d.background !== undefined) this.background = d.background;
    });
  }

  setUndoManager(um: UndoRedoManager): void { this.undoManager = um; }

  setDocument(doc: Document): void {
    this.commitPending();
    this.typing = false;
    this.cursorPos = null;
    this.doc = doc;
  }

  getName() { return 'text'; }
  getIcon() { return 'T'; }
  getShortcut() { return 'T'; }

  isActive(): boolean { return this.typing; }

  onMouseDown(pos: Position, _modifiers: InputModifiers): void {
    // Commit previous text entry
    this.commitPending();
    this.cursorPos = pos;
    this.startX = pos.x;
    this.typing = true;
    this.pendingChanges = [];
  }

  onMouseDrag(_pos: Position): void {}
  onMouseUp(_pos: Position): void {}
  onMouseMove(_pos: Position): void {}

  onKeyDown(key: string, modifiers: InputModifiers): void {
    if (!this.typing || !this.cursorPos) return;
    if (modifiers.ctrl || modifiers.meta || modifiers.alt) return;

    if (key === 'Escape') {
      this.commitPending();
      this.typing = false;
      return;
    }

    if (key === 'Enter') {
      this.cursorPos = { x: this.startX, y: this.cursorPos.y + 1 };
      if (this.cursorPos.y >= this.doc.height) {
        this.commitPending();
        this.typing = false;
      }
      return;
    }

    if (key === 'Backspace') {
      if (this.cursorPos.x > 0) {
        this.cursorPos = { x: this.cursorPos.x - 1, y: this.cursorPos.y };
        this.typeChar(' ');
        this.cursorPos = { x: this.cursorPos.x - 1, y: this.cursorPos.y };
      }
      return;
    }

    if (key.length === 1) {
      this.typeChar(key);
    }
  }

  onActivate(): void {}
  onDeactivate(): void {
    this.commitPending();
    this.typing = false;
    this.cursorPos = null;
  }

  prepareForUndoRedo(): void {
    if (!this.typing) return;
    this.commitPending();
  }

  private typeChar(ch: string): void {
    if (!this.cursorPos) return;
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || this.doc.layerManager.isLayerEffectivelyLocked(layer)) return;

    const oldCell = layer.getCell(this.cursorPos.x, this.cursorPos.y);
    const newCell: Cell = {
      char: ch,
      attributes: { foreground: this.foreground, background: this.background },
    };
    this.pendingChanges.push({
      x: this.cursorPos.x,
      y: this.cursorPos.y,
      oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
      newCell,
    });
    layer.setCell(this.cursorPos.x, this.cursorPos.y, newCell);
    eventBus.emit(Events.RENDER_REQUEST, null);

    // Advance cursor
    this.cursorPos = { x: this.cursorPos.x + 1, y: this.cursorPos.y };
    if (this.cursorPos.x >= this.doc.width) {
      this.cursorPos = { x: 0, y: this.cursorPos.y + 1 };
      if (this.cursorPos.y >= this.doc.height) {
        this.commitPending();
        this.typing = false;
      }
    }
  }

  private commitPending(): void {
    if (this.pendingChanges.length > 0 && this.undoManager) {
      const layerId = this.doc.layerManager.getActiveLayerId();
      this.undoManager.execute(new CellChangeCommand(this.doc, layerId, [...this.pendingChanges], 'Text'));
      this.pendingChanges = [];
    }
  }
}
