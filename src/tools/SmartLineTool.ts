import { Tool } from './Tool';
import { Position, InputModifiers, Cell } from '../core/types';
import { Document } from '../document/Document';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';
import { N, S, E, W, resolveChar, BoxStyle } from './BoxDrawing';

export class SmartLineTool implements Tool {
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

  getName() { return 'smartline'; }
  getIcon() { return '─'; }
  getShortcut() { return 'J'; }

  onMouseDown(pos: Position, _modifiers: InputModifiers): void {
    this.startPos = pos;
    this.isDrawing = true;
  }

  onMouseDrag(pos: Position): void {
    if (!this.isDrawing || !this.startPos) return;
    this.showPreview(pos);
  }

  onMouseUp(pos: Position): void {
    if (!this.isDrawing || !this.startPos) return;
    this.renderer.clearPreview();
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
  }

  private getSmartLinePoints(start: Position, end: Position): Array<{ pos: Position; connections: number }> {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const isHorizontal = dx >= dy;
    const points: Array<{ pos: Position; connections: number }> = [];

    if (isHorizontal) {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      for (let x = minX; x <= maxX; x++) {
        points.push({ pos: { x, y: start.y }, connections: E | W });
      }
    } else {
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      for (let y = minY; y <= maxY; y++) {
        points.push({ pos: { x: start.x, y }, connections: N | S });
      }
    }

    return points;
  }

  private showPreview(endPos: Position): void {
    const points = this.getSmartLinePoints(this.startPos!, endPos);
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

  private commitLine(start: Position, end: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || layer.locked) return;

    const points = this.getSmartLinePoints(start, end);
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
      this.undoManager.execute(new CellChangeCommand(this.doc, layer.id, changes, 'Smart Line'));
    }
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
