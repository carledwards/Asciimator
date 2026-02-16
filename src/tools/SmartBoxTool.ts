import { Tool } from './Tool';
import { Position, InputModifiers, Cell } from '../core/types';
import { Document } from '../document/Document';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';
import { N, S, E, W, resolveChar, BoxStyle } from './BoxDrawing';

export class SmartBoxTool implements Tool {
  private startPos: Position | null = null;
  private isDrawing = false;
  private foreground = 15;
  private background = 0;
  private boxStyle: BoxStyle = 'single';
  private undoManager!: UndoRedoManager;

  constructor(private doc: Document, private renderer: CanvasRenderer) {
    eventBus.on(Events.COLOR_CHANGED, (data: unknown) => {
      const d = data as { foreground?: number; background?: number };
      if (d.foreground !== undefined) this.foreground = d.foreground;
      if (d.background !== undefined) this.background = d.background;
    });
    eventBus.on<BoxStyle>(Events.BOX_STYLE_CHANGED, (style) => {
      this.boxStyle = style;
    });
  }

  setUndoManager(um: UndoRedoManager): void { this.undoManager = um; }

  setDocument(doc: Document): void {
    this.doc = doc;
    this.isDrawing = false;
    this.startPos = null;
    this.renderer.clearPreview();
  }

  getName() { return 'smartbox'; }
  getIcon() { return '□'; }
  getShortcut() { return 'B'; }

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
    this.commitBox(this.startPos, pos);
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
    const area = w * h;
    eventBus.emit(Events.TOOL_DRAG_INFO, {
      position: endPos,
      lines: [`${w} x ${h}`, `area ${area}`],
    });
  }

  private getSmartBoxPoints(p0: Position, p1: Position): Array<{ pos: Position; connections: number }> {
    const x1 = Math.min(p0.x, p1.x);
    const y1 = Math.min(p0.y, p1.y);
    const x2 = Math.max(p0.x, p1.x);
    const y2 = Math.max(p0.y, p1.y);
    const points: Array<{ pos: Position; connections: number }> = [];

    // Degenerate: single cell
    if (x1 === x2 && y1 === y2) {
      points.push({ pos: { x: x1, y: y1 }, connections: E | W });
      return points;
    }

    // Degenerate: vertical line
    if (x1 === x2) {
      for (let y = y1; y <= y2; y++) {
        points.push({ pos: { x: x1, y }, connections: N | S });
      }
      return points;
    }

    // Degenerate: horizontal line
    if (y1 === y2) {
      for (let x = x1; x <= x2; x++) {
        points.push({ pos: { x, y: y1 }, connections: E | W });
      }
      return points;
    }

    // Normal rectangle outline
    // Corners
    points.push({ pos: { x: x1, y: y1 }, connections: S | E });  // TL
    points.push({ pos: { x: x2, y: y1 }, connections: S | W });  // TR
    points.push({ pos: { x: x1, y: y2 }, connections: N | E });  // BL
    points.push({ pos: { x: x2, y: y2 }, connections: N | W });  // BR

    // Top edge
    for (let x = x1 + 1; x < x2; x++) {
      points.push({ pos: { x, y: y1 }, connections: E | W });
    }
    // Bottom edge
    for (let x = x1 + 1; x < x2; x++) {
      points.push({ pos: { x, y: y2 }, connections: E | W });
    }
    // Left edge
    for (let y = y1 + 1; y < y2; y++) {
      points.push({ pos: { x: x1, y }, connections: N | S });
    }
    // Right edge
    for (let y = y1 + 1; y < y2; y++) {
      points.push({ pos: { x: x2, y }, connections: N | S });
    }

    return points;
  }

  private showPreview(endPos: Position): void {
    const points = this.getSmartBoxPoints(this.startPos!, endPos);
    const preview = new Map<string, Cell>();
    const layer = this.doc.layerManager.getActiveLayer();

    for (const { pos, connections } of points) {
      const existing = layer?.getCell(pos.x, pos.y);
      const ch = resolveChar(existing?.char, connections, this.boxStyle);
      preview.set(`${pos.x},${pos.y}`, {
        char: ch,
        attributes: { foreground: this.foreground, background: this.background },
      });
    }
    this.renderer.setPreviewCells(preview);
  }

  private commitBox(start: Position, end: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || this.doc.layerManager.isLayerEffectivelyLocked(layer)) return;

    const points = this.getSmartBoxPoints(start, end);
    const changes: CellChange[] = [];

    for (const { pos, connections } of points) {
      const oldCell = layer.getCell(pos.x, pos.y);
      const ch = resolveChar(oldCell?.char, connections, this.boxStyle);
      const newCell: Cell = {
        char: ch,
        attributes: { foreground: this.foreground, background: this.background },
      };

      changes.push({
        x: pos.x, y: pos.y,
        oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
        newCell: { ...newCell, attributes: { ...newCell.attributes } },
      });
      layer.setCell(pos.x, pos.y, { ...newCell, attributes: { ...newCell.attributes } });
    }

    if (changes.length > 0 && this.undoManager) {
      this.undoManager.execute(new CellChangeCommand(this.doc, layer.id, changes, 'Smart Box'));
    }
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
