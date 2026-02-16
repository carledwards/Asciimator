import { eventBus, Events } from '../core/EventBus';
import { Position, Cell, CellAttributes, InputModifiers } from '../core/types';
import type { ToolManager } from '../tools/ToolManager';

interface KeyDownEvent {
  key: string;
  code: string;
  modifiers: InputModifiers;
  preventDefault: () => void;
  raw: KeyboardEvent;
}

interface MouseDownEvent {
  position: Position;
  modifiers: InputModifiers;
}

export class InputManager {
  private toolManager!: ToolManager;

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  constructor() {
    eventBus.on<MouseDownEvent>(Events.MOUSE_DOWN, (data) => {
      this.toolManager?.getActiveTool()?.onMouseDown(data.position, data.modifiers);
    });

    eventBus.on<Position>(Events.MOUSE_DRAG, (pos) => {
      this.toolManager?.getActiveTool()?.onMouseDrag(pos);
    });

    eventBus.on<MouseDownEvent>(Events.MOUSE_UP, (data) => {
      this.toolManager?.getActiveTool()?.onMouseUp(data.position);
    });

    eventBus.on<Position>(Events.MOUSE_MOVE, (pos) => {
      this.toolManager?.getActiveTool()?.onMouseMove(pos);
    });

    eventBus.on<KeyDownEvent>(Events.KEY_DOWN, (data) => {
      if (this.isTypingTarget(data.raw.target)) return;
      // Handle global shortcuts first
      if (this.handleGlobalShortcut(data)) return;
      // Pass to active tool
      this.toolManager?.getActiveTool()?.onKeyDown(data.key, data.modifiers);
    });
  }

  setToolManager(tm: ToolManager): void {
    this.toolManager = tm;
  }

  private handleGlobalShortcut(data: KeyDownEvent): boolean {
    const mod = data.modifiers.meta || data.modifiers.ctrl;
    const keyLower = data.key.toLowerCase();
    const active = this.toolManager?.getActiveTool();

    // Undo: Ctrl/Cmd+Z
    if (mod && !data.modifiers.shift && keyLower === 'z') {
      active?.prepareForUndoRedo?.();
      data.preventDefault();
      eventBus.emit(Events.UNDO, null);
      return true;
    }
    // Redo: Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
    if (mod && data.modifiers.shift && keyLower === 'z') {
      active?.prepareForUndoRedo?.();
      data.preventDefault();
      eventBus.emit(Events.REDO, null);
      return true;
    }
    if (mod && keyLower === 'y') {
      active?.prepareForUndoRedo?.();
      data.preventDefault();
      eventBus.emit(Events.REDO, null);
      return true;
    }

    // Tool shortcuts (only when no modifier)
    if (!mod && !data.modifiers.alt) {
      const toolMap: Record<string, string> = {
        'p': 'pencil',
        'l': 'line',
        'r': 'rectangle',
        'u': 'filled-rectangle',
        'c': 'circle',
        'o': 'filled-circle',
        'f': 'fill',
        'i': 'dropper',
        't': 'text',
        'e': 'eraser',
        's': 'selection',
        'j': 'smartline',
        'b': 'smartbox',
      };
      const toolName = toolMap[data.key.toLowerCase()];
      if (toolName && this.toolManager) {
        // Don't switch tools if text tool is active and typing
        if (active?.getName() === 'text' && active.isActive?.()) return false;
        this.toolManager.setActiveTool(toolName);
        return true;
      }
    }

    return false;
  }
}
