import { Tool } from './Tool';
import { Position, InputModifiers, Cell, LayerCell } from '../core/types';
import { Document } from '../document/Document';
import { eventBus, Events } from '../core/EventBus';
import type { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';

export class FillTool implements Tool {
  private currentChar = ' ';
  private foreground = 15;
  private background = 0;
  private undoManager!: UndoRedoManager;

  constructor(private doc: Document) {
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
  }

  getName() { return 'fill'; }
  getIcon() { return ''; }
  getShortcut() { return 'F'; }

  onMouseDown(pos: Position, _modifiers: InputModifiers): void {
    this.floodFill(pos);
  }

  onMouseDrag(_pos: Position): void {}
  onMouseUp(_pos: Position): void {}
  onMouseMove(_pos: Position): void {}
  onKeyDown(_key: string, _modifiers: InputModifiers): void {}
  onActivate(): void {}
  onDeactivate(): void {}

  private floodFill(start: Position): void {
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || layer.locked) return;

    const targetCell = layer.getCell(start.x, start.y);
    const targetChar = targetCell?.char ?? ' ';
    const targetFg = targetCell?.attributes.foreground ?? 7;
    const targetBg = targetCell?.attributes.background ?? 0;

    // Don't fill if target matches what we'd draw
    if (targetChar === this.currentChar && targetFg === this.foreground && targetBg === this.background) {
      return;
    }

    const w = layer.getWidth();
    const h = layer.getHeight();
    const visited = new Set<string>();
    const queue: Position[] = [start];
    const changes: CellChange[] = [];

    const matches = (x: number, y: number): boolean => {
      const cell = layer.getCell(x, y);
      const ch = cell?.char ?? ' ';
      const fg = cell?.attributes.foreground ?? 7;
      const bg = cell?.attributes.background ?? 0;
      return ch === targetChar && fg === targetFg && bg === targetBg;
    };

    while (queue.length > 0) {
      const pos = queue.shift()!;
      const key = `${pos.x},${pos.y}`;
      if (visited.has(key)) continue;
      if (pos.x < 0 || pos.x >= w || pos.y < 0 || pos.y >= h) continue;
      if (!matches(pos.x, pos.y)) continue;

      visited.add(key);
      const oldCell = layer.getCell(pos.x, pos.y);
      const newCell: Cell = {
        char: this.currentChar,
        attributes: { foreground: this.foreground, background: this.background },
      };
      changes.push({
        x: pos.x, y: pos.y,
        oldCell: oldCell ? { ...oldCell, attributes: { ...oldCell.attributes } } : null,
        newCell,
      });
      layer.setCell(pos.x, pos.y, newCell);

      queue.push({ x: pos.x + 1, y: pos.y });
      queue.push({ x: pos.x - 1, y: pos.y });
      queue.push({ x: pos.x, y: pos.y + 1 });
      queue.push({ x: pos.x, y: pos.y - 1 });
    }

    if (changes.length > 0 && this.undoManager) {
      this.undoManager.execute(new CellChangeCommand(this.doc, layer.id, changes, 'Fill'));
    }
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
