import { Tool } from './Tool';
import { Position, InputModifiers, Cell, LayerCell } from '../core/types';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { eventBus, Events } from '../core/EventBus';
import { Clipboard } from '../state/Clipboard';
import { Document } from '../document/Document';
import { UndoRedoManager } from '../state/UndoRedoManager';
import { CellChangeCommand, CellChange } from '../state/Command';

type SelectionState = 'idle' | 'selecting' | 'ready_to_move' | 'moving';

export class SelectionTool implements Tool {
  private startPos: Position | null = null;
  private endPos: Position | null = null;
  private state: SelectionState = 'idle';

  // Move state
  private capturedCells: LayerCell[][] | null = null;
  private moveOrigin: Position | null = null;
  private moveOffset: Position = { x: 0, y: 0 };
  private dragStart: Position | null = null;

  constructor(
    private renderer: CanvasRenderer,
    private clipboard: Clipboard,
    private doc: Document,
    private undoManager: UndoRedoManager,
  ) {}

  getName() { return 'selection'; }
  getIcon() { return ''; }
  getShortcut() { return 'S'; }

  setDocument(doc: Document): void {
    this.doc = doc;
  }

  onMouseDown(pos: Position, _modifiers: InputModifiers): void {
    if (this.startPos && this.endPos && this.isInsideSelection(pos)) {
      // Click inside existing selection → prepare to move
      this.state = 'ready_to_move';
      this.dragStart = pos;
      this.captureSelectionCells();
      this.moveOrigin = {
        x: Math.min(this.startPos.x, this.endPos.x),
        y: Math.min(this.startPos.y, this.endPos.y),
      };
      this.moveOffset = { x: 0, y: 0 };
    } else {
      // New selection
      this.state = 'selecting';
      this.startPos = pos;
      this.endPos = pos;
      this.capturedCells = null;
      this.renderer.clearPreview();
      this.renderer.setSelection(pos, pos);
    }
  }

  onMouseDrag(pos: Position): void {
    if (this.state === 'selecting') {
      this.endPos = pos;
      this.renderer.setSelection(this.startPos, pos);
    } else if (this.state === 'ready_to_move') {
      // Start moving
      this.state = 'moving';
      this.renderer.setMoveGuides(true);
      this.updateMovePreview(pos);
    } else if (this.state === 'moving') {
      this.updateMovePreview(pos);
    }
  }

  onMouseUp(pos: Position): void {
    if (this.state === 'selecting') {
      this.endPos = pos;
      this.state = 'idle';
      this.renderer.setSelection(this.startPos, pos);
      eventBus.emit(Events.SELECTION_CHANGED, {
        start: this.startPos,
        end: this.endPos,
      });
    } else if (this.state === 'ready_to_move') {
      // No drag happened, keep selection as-is
      this.state = 'idle';
    } else if (this.state === 'moving') {
      this.renderer.setMoveGuides(false);
      this.completeMoveOperation();
      this.state = 'idle';
    }
  }

  onMouseMove(_pos: Position): void {}

  onKeyDown(key: string, modifiers: InputModifiers): void {
    const mod = modifiers.meta || modifiers.ctrl;
    if (mod && key === 'c' && this.startPos && this.endPos) {
      this.clipboard.copy(this.startPos.x, this.startPos.y, this.endPos.x, this.endPos.y);
    }
    if (mod && key === 'x' && this.startPos && this.endPos) {
      // Cut: copy then erase
      this.clipboard.copy(this.startPos.x, this.startPos.y, this.endPos.x, this.endPos.y);
      this.eraseSelection('Cut');
    }
    if (mod && key === 'v') {
      // Paste at selection start or origin
      const target = this.startPos ?? { x: 0, y: 0 };
      this.clipboard.paste(target.x, target.y);
    }
    if ((key === 'Delete' || key === 'Backspace') && this.startPos && this.endPos) {
      this.eraseSelection('Delete');
    }
    if (key === 'Escape') {
      this.clearSelection();
    }
  }

  onActivate(): void {}
  onDeactivate(): void {
    this.clearSelection();
  }

  clearSelection(): void {
    this.startPos = null;
    this.endPos = null;
    this.state = 'idle';
    this.capturedCells = null;
    this.moveOrigin = null;
    this.dragStart = null;
    this.renderer.setMoveGuides(false);
    this.renderer.clearPreview();
    this.renderer.setSelection(null, null);
    eventBus.emit(Events.SELECTION_CHANGED, null);
  }

  getSelection(): { start: Position; end: Position } | null {
    if (!this.startPos || !this.endPos) return null;
    return { start: this.startPos, end: this.endPos };
  }

  private isInsideSelection(pos: Position): boolean {
    if (!this.startPos || !this.endPos) return false;
    const x1 = Math.min(this.startPos.x, this.endPos.x);
    const y1 = Math.min(this.startPos.y, this.endPos.y);
    const x2 = Math.max(this.startPos.x, this.endPos.x);
    const y2 = Math.max(this.startPos.y, this.endPos.y);
    return pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2;
  }

  private captureSelectionCells(): void {
    if (!this.startPos || !this.endPos) return;
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer) return;

    const x1 = Math.min(this.startPos.x, this.endPos.x);
    const y1 = Math.min(this.startPos.y, this.endPos.y);
    const x2 = Math.max(this.startPos.x, this.endPos.x);
    const y2 = Math.max(this.startPos.y, this.endPos.y);

    const cells: LayerCell[][] = [];
    for (let y = y1; y <= y2; y++) {
      const row: LayerCell[] = [];
      for (let x = x1; x <= x2; x++) {
        const cell = layer.getCell(x, y);
        row.push(cell ? { char: cell.char, attributes: { ...cell.attributes } } : null);
      }
      cells.push(row);
    }
    this.capturedCells = cells;
  }

  private updateMovePreview(currentPos: Position): void {
    if (!this.dragStart || !this.moveOrigin || !this.capturedCells || !this.startPos || !this.endPos) return;

    this.moveOffset = {
      x: currentPos.x - this.dragStart.x,
      y: currentPos.y - this.dragStart.y,
    };

    const x1 = Math.min(this.startPos.x, this.endPos.x);
    const y1 = Math.min(this.startPos.y, this.endPos.y);
    const x2 = Math.max(this.startPos.x, this.endPos.x);
    const y2 = Math.max(this.startPos.y, this.endPos.y);
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;

    const preview = new Map<string, Cell>();

    // Empty cells at old position
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const ox = x1 + dx;
        const oy = y1 + dy;
        preview.set(`${ox},${oy}`, { char: ' ', attributes: { foreground: 7, background: 0 } });
      }
    }

    // Captured cells at new position
    const newX = this.moveOrigin.x + this.moveOffset.x;
    const newY = this.moveOrigin.y + this.moveOffset.y;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const nx = newX + dx;
        const ny = newY + dy;
        if (nx >= 0 && nx < this.doc.width && ny >= 0 && ny < this.doc.height) {
          const cell = this.capturedCells[dy][dx];
          if (cell) {
            preview.set(`${nx},${ny}`, { char: cell.char, attributes: { ...cell.attributes } });
          }
        }
      }
    }

    this.renderer.setPreviewCells(preview);

    // Update selection rect to new position
    this.renderer.setSelection(
      { x: newX, y: newY },
      { x: newX + w - 1, y: newY + h - 1 },
    );
  }

  private completeMoveOperation(): void {
    if (!this.startPos || !this.endPos || !this.capturedCells || !this.moveOrigin) return;
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || this.doc.layerManager.isLayerEffectivelyLocked(layer)) {
      this.renderer.clearPreview();
      return;
    }

    const x1 = Math.min(this.startPos.x, this.endPos.x);
    const y1 = Math.min(this.startPos.y, this.endPos.y);
    const x2 = Math.max(this.startPos.x, this.endPos.x);
    const y2 = Math.max(this.startPos.y, this.endPos.y);
    const w = x2 - x1 + 1;
    const h = y2 - y1 + 1;

    const newX = this.moveOrigin.x + this.moveOffset.x;
    const newY = this.moveOrigin.y + this.moveOffset.y;

    // Build changes: track all affected positions
    const changeMap = new Map<string, CellChange>();

    // Erase old positions
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const ox = x1 + dx;
        const oy = y1 + dy;
        const key = `${ox},${oy}`;
        const oldCell = layer.getCell(ox, oy);
        changeMap.set(key, {
          x: ox, y: oy,
          oldCell: oldCell ? { char: oldCell.char, attributes: { ...oldCell.attributes } } : null,
          newCell: null,
        });
      }
    }

    // Place at new positions
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const nx = newX + dx;
        const ny = newY + dy;
        if (nx < 0 || nx >= this.doc.width || ny < 0 || ny >= this.doc.height) continue;
        const cell = this.capturedCells[dy][dx];
        if (!cell) continue;
        const key = `${nx},${ny}`;
        const existing = changeMap.get(key);
        if (existing) {
          // Position was already in the erase set; keep the original oldCell, update newCell
          existing.newCell = { char: cell.char, attributes: { ...cell.attributes } };
        } else {
          const oldCell = layer.getCell(nx, ny);
          changeMap.set(key, {
            x: nx, y: ny,
            oldCell: oldCell ? { char: oldCell.char, attributes: { ...oldCell.attributes } } : null,
            newCell: { char: cell.char, attributes: { ...cell.attributes } },
          });
        }
      }
    }

    const changes = Array.from(changeMap.values());
    if (changes.length > 0) {
      const cmd = new CellChangeCommand(this.doc, layer.id, changes, 'Move selection');
      cmd.execute();
      this.undoManager.execute(cmd);
    }

    this.renderer.clearPreview();

    // Update selection to new position
    this.startPos = { x: newX, y: newY };
    this.endPos = { x: newX + w - 1, y: newY + h - 1 };
    this.renderer.setSelection(this.startPos, this.endPos);
    this.capturedCells = null;
    this.moveOrigin = null;
    this.dragStart = null;
  }

  private eraseSelection(description: string): void {
    if (!this.startPos || !this.endPos) return;
    const layer = this.doc.layerManager.getActiveLayer();
    if (!layer || this.doc.layerManager.isLayerEffectivelyLocked(layer)) return;

    const x1 = Math.min(this.startPos.x, this.endPos.x);
    const y1 = Math.min(this.startPos.y, this.endPos.y);
    const x2 = Math.max(this.startPos.x, this.endPos.x);
    const y2 = Math.max(this.startPos.y, this.endPos.y);

    const changes: CellChange[] = [];
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const oldCell = layer.getCell(x, y);
        if (oldCell) {
          changes.push({
            x, y,
            oldCell: { char: oldCell.char, attributes: { ...oldCell.attributes } },
            newCell: null,
          });
        }
      }
    }

    if (changes.length > 0) {
      const cmd = new CellChangeCommand(this.doc, layer.id, changes, description);
      cmd.execute();
      this.undoManager.execute(cmd);
    }
  }
}
