import { Tool } from './Tool';
import { Position, InputModifiers, Cell } from '../core/types';
import { Document } from '../document/Document';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';

export class RectangleTool implements Tool {
  private startPos: Position | null = null;
  private isDrawing = false;
  private filled = false;
  private currentChar = ' ';
  private foreground = 15;
  private background = 0;
  private undoManager!: UndoRedoManager;

  constructor(private doc: Document, private renderer: CanvasRenderer) {
    eventBus.on(Events.CHAR_CHANGED, (ch: unknown) => { this.currentChar = ch as string; });
    eventBus.on(Events.COLOR_CHANGED, (data: unknown) => {
      const d = data as { foreground?: number; background?: number };
      if (d.foreground !== undefined) this.foreground = d.foreground;
      if (d.background !== undefined) this.background = d.background;
    });
  }

  setUndoManager(um: UndoRedoManager): void { this.undoManager = um; }

  setDocument(doc: Document): void {
    this.doc = doc;
    this.isDrawing = false;
    this.startPos = null;
    this.renderer.clearPreview();
  }

  getName() { return 'rectangle'; }
  getIcon() { return '▭'; }
  getShortcut() { return 'R'; }

  onMouseDown(pos: Position, modifiers: InputModifiers): void {
    this.startPos = pos;
    this.isDrawing = true;
    this.filled = modifiers.shift;
  }

  onMouseDrag(pos: Position): void {
    if (!this.isDrawing || !this.startPos) return;
    this.showPreview(pos);
  }

  onMouseUp(pos: Position): void {
    if (!this.isDrawing || !this.startPos) return;
    this.renderer.clearPreview();
    this.commitRect(this.startPos, pos);
    this.startPos = null;
    this.isDrawing = false;
  }

  onMouseMove(_pos: Position): void {}
  onKeyDown(_key: string, _modifiers: InputModifiers): void {}
  onActivate(): void {}
  onDeactivate(): void {
    this.isDrawing = false;
    this.startPos = null;
    this.renderer.clearPreview();
  }

  private getRectPoints(p0: Position, p1: Position): Position[] {
    const x1 = Math.min(p0.x, p1.x);
    const y1 = Math.min(p0.y, p1.y);
    const x2 = Math.max(p0.x, p1.x);
    const y2 = Math.max(p0.y, p1.y);
    const points: Position[] = [];

    if (this.filled) {
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          points.push({ x, y });
        }
      }
    } else {
      for (let x = x1; x <= x2; x++) {
        points.push({ x, y: y1 });
        points.push({ x, y: y2 });
      }
      for (let y = y1 + 1; y < y2; y++) {
        points.push({ x: x1, y });
        points.push({ x: x2, y });
      }
    }
    return points;
  }

  private showPreview(endPos: Position): void {
    const points = this.getRectPoints(this.startPos!, endPos);
    const preview = new Map<string, Cell>();
    const cell: Cell = {
      char: this.currentChar,
      attributes: { foreground: this.foreground, background: this.background },
    };
    for (const p of points) {
      preview.set(`${p.x},${p.y}`, cell);
    }
    this.renderer.setPreviewCells(preview);
  }

  private commitRect(start: Position, end: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || layer.locked) return;

    const points = this.getRectPoints(start, end);
    const changes: CellChange[] = [];
    const newCell: Cell = {
      char: this.currentChar,
      attributes: { foreground: this.foreground, background: this.background },
    };

    for (const p of points) {
      const oldCell = layer.getCell(p.x, p.y);
      changes.push({
        x: p.x, y: p.y,
        oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
        newCell: { ...newCell, attributes: { ...newCell.attributes } },
      });
      layer.setCell(p.x, p.y, { ...newCell, attributes: { ...newCell.attributes } });
    }

    if (changes.length > 0 && this.undoManager) {
      this.undoManager.execute(new CellChangeCommand(this.doc, layer.id, changes, 'Rectangle'));
    }
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
