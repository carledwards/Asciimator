import { Tool } from './Tool';
import { Position, InputModifiers, Cell } from '../core/types';
import { Document } from '../document/Document';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';
import { N, S, E, W, resolveChar, BoxStyle, isBoxChar, charToConnections } from './BoxDrawing';

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
    const len = Math.max(w, h);
    eventBus.emit(Events.TOOL_DRAG_INFO, {
      position: endPos,
      lines: [`${w} x ${h}`, `len ${len}`],
    });
  }

  private getSmartLinePoints(start: Position, end: Position): Position[] {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const isHorizontal = dx >= dy;
    const points: Position[] = [];

    if (isHorizontal) {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      for (let x = minX; x <= maxX; x++) {
        points.push({ x, y: start.y });
      }
    } else {
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      for (let y = minY; y <= maxY; y++) {
        points.push({ x: start.x, y });
      }
    }

    return points;
  }

  private getPlannedConnections(points: Position[]): Map<string, number> {
    const map = new Map<string, number>();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let conn = 0;
      const prev = i > 0 ? points[i - 1] : null;
      const next = i < points.length - 1 ? points[i + 1] : null;
      if (prev) {
        if (prev.x === p.x - 1 && prev.y === p.y) conn |= W;
        if (prev.x === p.x + 1 && prev.y === p.y) conn |= E;
        if (prev.x === p.x && prev.y === p.y - 1) conn |= N;
        if (prev.x === p.x && prev.y === p.y + 1) conn |= S;
      }
      if (next) {
        if (next.x === p.x - 1 && next.y === p.y) conn |= W;
        if (next.x === p.x + 1 && next.y === p.y) conn |= E;
        if (next.x === p.x && next.y === p.y - 1) conn |= N;
        if (next.x === p.x && next.y === p.y + 1) conn |= S;
      }
      if (conn === 0) conn = E | W; // single-cell degenerate line
      map.set(`${p.x},${p.y}`, conn);
    }
    return map;
  }

  private getNeighborConnections(layer: ReturnType<Document['layerManager']['getActiveLayer']>, x: number, y: number): number {
    if (!layer) return 0;
    const dirs = [
      { bit: N, dx: 0, dy: -1, opposite: S },
      { bit: S, dx: 0, dy: 1, opposite: N },
      { bit: E, dx: 1, dy: 0, opposite: W },
      { bit: W, dx: -1, dy: 0, opposite: E },
    ];
    let conn = 0;
    for (const d of dirs) {
      const n = layer.getCell(x + d.dx, y + d.dy);
      if (!n || !isBoxChar(n.char)) continue;
      const info = charToConnections(n.char);
      if (info.style !== this.boxStyle) continue;
      if (info.connections & d.opposite) {
        conn |= d.bit;
      }
    }
    return conn;
  }

  private showPreview(endPos: Position): void {
    const points = this.getSmartLinePoints(this.startPos!, endPos);
    const planned = this.getPlannedConnections(points);
    const preview = new Map<string, Cell>();
    const layer = this.doc.layerManager.getActiveLayer();

    for (const pos of points) {
      const existing = layer?.getCell(pos.x, pos.y);
      const connections = planned.get(`${pos.x},${pos.y}`) ?? (E | W);
      const merged = connections | this.getNeighborConnections(layer, pos.x, pos.y);
      preview.set(`${pos.x},${pos.y}`, {
        char: resolveChar(existing?.char, merged || connections, this.boxStyle),
        attributes: { foreground: this.foreground, background: this.background },
      });
    }
    this.renderer.setPreviewCells(preview);
  }

  private commitLine(start: Position, end: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || layer.locked) return;

    const points = this.getSmartLinePoints(start, end);
    const planned = this.getPlannedConnections(points);
    const changes: CellChange[] = [];

    for (const pos of points) {
      const oldCell = layer.getCell(pos.x, pos.y);
      const connections = planned.get(`${pos.x},${pos.y}`) ?? (E | W);
      const merged = connections | this.getNeighborConnections(layer, pos.x, pos.y);
      const ch = resolveChar(oldCell?.char, merged || connections, this.boxStyle);
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
