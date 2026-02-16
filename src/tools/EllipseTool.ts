import { Tool } from './Tool';
import { Position, InputModifiers, Cell } from '../core/types';
import { Document } from '../document/Document';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';

export class EllipseTool implements Tool {
  private startPos: Position | null = null;
  private isDrawing = false;
  private currentChar = '█';
  private foreground = 15;
  private background = 0;
  private undoManager!: UndoRedoManager;

  constructor(
    private doc: Document,
    private renderer: CanvasRenderer,
    private toolName: 'circle' | 'filled-circle',
    private toolShortcut: string,
    private commandLabel: string,
    private filled: boolean,
  ) {
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

  getName() { return this.toolName; }
  getIcon() { return ''; }
  getShortcut() { return this.toolShortcut; }

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
    this.commitEllipse(this.startPos, pos);
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
    const rx = (w / 2).toFixed(1);
    const ry = (h / 2).toFixed(1);
    eventBus.emit(Events.TOOL_DRAG_INFO, {
      position: endPos,
      lines: [`${w} x ${h}`, `r ${rx}, ${ry}`],
    });
  }

  private isInsideEllipse(
    x: number,
    y: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
  ): boolean {
    if (rx <= 0 || ry <= 0) return false;
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }

  private getEllipsePoints(p0: Position, p1: Position): Position[] {
    const x1 = Math.min(p0.x, p1.x);
    const y1 = Math.min(p0.y, p1.y);
    const x2 = Math.max(p0.x, p1.x);
    const y2 = Math.max(p0.y, p1.y);

    const cx = (x1 + x2 + 1) / 2;
    const cy = (y1 + y2 + 1) / 2;
    const rx = (x2 - x1 + 1) / 2;
    const ry = (y2 - y1 + 1) / 2;

    const points: Position[] = [];
    const seen = new Set<string>();

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const outer = this.isInsideEllipse(x, y, cx, cy, rx, ry);
        if (!outer) continue;

        let include = false;
        if (this.filled) {
          include = true;
        } else if (rx <= 1 || ry <= 1) {
          include = true;
        } else {
          const inner = this.isInsideEllipse(x, y, cx, cy, rx - 1, ry - 1);
          include = !inner;
        }

        if (!include) continue;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        points.push({ x, y });
      }
    }

    return points;
  }

  private showPreview(endPos: Position): void {
    const points = this.getEllipsePoints(this.startPos!, endPos);
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

  private commitEllipse(start: Position, end: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || this.doc.layerManager.isLayerEffectivelyLocked(layer)) return;

    const points = this.getEllipsePoints(start, end);
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
      this.undoManager.execute(new CellChangeCommand(this.doc, layer.id, changes, this.commandLabel));
    }
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
