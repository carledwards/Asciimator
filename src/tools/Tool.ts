import { Position, InputModifiers } from '../core/types';

export interface Tool {
  getName(): string;
  getIcon(): string;
  getShortcut(): string;
  onMouseDown(pos: Position, modifiers: InputModifiers): void;
  onMouseDrag(pos: Position): void;
  onMouseUp(pos: Position): void;
  onMouseMove(pos: Position): void;
  onKeyDown(key: string, modifiers: InputModifiers): void;
  onActivate(): void;
  onDeactivate(): void;
  isActive?(): boolean;
  prepareForUndoRedo?(): void;
  setDocument?(doc: import('../document/Document').Document): void;
}
