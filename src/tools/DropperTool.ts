import { Tool } from './Tool';
import { Position, InputModifiers } from '../core/types';
import { eventBus, Events } from '../core/EventBus';
import { Document } from '../document/Document';
import { CompositeBuffer } from '../rendering/CompositeBuffer';

export class DropperTool implements Tool {
  constructor(
    private doc: Document,
    private compositeBuffer: CompositeBuffer,
  ) {}

  setDocument(doc: Document): void {
    this.doc = doc;
  }

  getName() { return 'dropper'; }
  getIcon() { return '◉'; }
  getShortcut() { return 'I'; }

  onMouseDown(pos: Position, _modifiers: InputModifiers): void {
    this.sampleAt(pos);
  }

  onMouseDrag(pos: Position): void {
    this.sampleAt(pos);
  }

  onMouseUp(_pos: Position): void {}
  onMouseMove(_pos: Position): void {}
  onKeyDown(_key: string, _modifiers: InputModifiers): void {}
  onActivate(): void {}
  onDeactivate(): void {}

  private sampleAt(pos: Position): void {
    if (pos.x < 0 || pos.y < 0 || pos.x >= this.doc.width || pos.y >= this.doc.height) return;
    const buffer = this.compositeBuffer.flatten();
    const cell = buffer[pos.y]?.[pos.x];
    if (!cell) return;

    eventBus.emit(Events.CHAR_CHANGED, cell.char ?? ' ');
    eventBus.emit(Events.COLOR_CHANGED, {
      foreground: cell.attributes.foreground,
      background: cell.attributes.background,
    });
  }
}
