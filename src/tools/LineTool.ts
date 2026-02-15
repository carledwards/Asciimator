import { Tool } from './Tool';
import { Position, InputModifiers, Cell } from '../core/types';
import { Document } from '../document/Document';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';

export class LineTool implements Tool {
  private startPos: Position | null = null;
  private isDrawing = false;
  private currentChar = '█';
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

  getName() { return 'line'; }
  getIcon() { return '╱'; }
  getShortcut() { return 'L'; }

  onMouseDown(pos: Position, _modifiers: InputModifiers): void {
    this.startPos = pos;
    this.isDrawing = true;
    this.updateDragInfo(pos);
  }

  onMouseDrag(pos: Position): void {
    if (!this.isDrawing || !this.startPos) return;
    this.showPreview(pos);
    this.updateDragInfo(pos);
  }

  onMouseUp(pos: Position): void {
    if (!this.isDrawing || !this.startPos) return;
    this.renderer.clearPreview();
    eventBus.emit(Events.TOOL_DRAG_INFO, null);
    this.commitLine(this.startPos, pos);
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
    eventBus.emit(Events.TOOL_DRAG_INFO, null);
  }

  private updateDragInfo(endPos: Position): void {
    if (!this.startPos) return;
    const w = Math.abs(endPos.x - this.startPos.x) + 1;
    const h = Math.abs(endPos.y - this.startPos.y) + 1;
    const len = this.getLinePoints(this.startPos, endPos).length;
    eventBus.emit(Events.TOOL_DRAG_INFO, {
      position: endPos,
      lines: [`${w} x ${h}`, `len ${len}`],
    });
  }

  private getLinePoints(p0: Position, p1: Position): Position[] {
    const points: Position[] = [];
    let x0 = p0.x, y0 = p0.y, x1 = p1.x, y1 = p1.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      points.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    return points;
  }

  private showPreview(endPos: Position): void {
    const points = this.getLinePoints(this.startPos!, endPos);
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

  private commitLine(start: Position, end: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || layer.locked) return;

    const points = this.getLinePoints(start, end);
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
      this.undoManager.execute(new CellChangeCommand(this.doc, layer.id, changes, 'Line'));
    }
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
