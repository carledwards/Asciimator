import { Position, InputModifiers } from '../core/types';
import { eventBus, Events } from '../core/EventBus';
import { CanvasRenderer } from '../rendering/CanvasRenderer';

export class MouseService {
  private isButtonDown = false;
  private lastPosition: Position | null = null;
  private modifiers: InputModifiers = { ctrl: false, alt: false, shift: false, meta: false };

  constructor(private renderer: CanvasRenderer) {
    const canvas = renderer.getCanvas();
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('mouseleave', this.handleMouseLeave);
    canvas.addEventListener('mouseenter', this.handleMouseEnter);
    // Prevent context menu on canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private updateModifiers(e: MouseEvent): void {
    this.modifiers = {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
    };
  }

  private handleMouseMove = (e: MouseEvent): void => {
    this.updateModifiers(e);
    const pos = this.renderer.screenToGrid(e.clientX, e.clientY);

    if (this.lastPosition && this.lastPosition.x === pos.x && this.lastPosition.y === pos.y) {
      return; // Same cell, skip
    }
    this.lastPosition = pos;

    if (this.isButtonDown) {
      eventBus.emit(Events.MOUSE_DRAG, pos);
    } else {
      eventBus.emit(Events.MOUSE_MOVE, pos);
    }
    eventBus.emit(Events.CURSOR_MOVED, pos);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return; // Left button only
    this.updateModifiers(e);
    this.isButtonDown = true;
    const pos = this.renderer.screenToGrid(e.clientX, e.clientY);
    this.lastPosition = pos;
    eventBus.emit(Events.MOUSE_DOWN, { position: pos, modifiers: this.modifiers });

    // Track drag outside canvas via document-level listeners
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    document.addEventListener('mouseup', this.handleDocumentMouseUp);
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    this.updateModifiers(e);
    this.isButtonDown = false;
    const pos = this.renderer.screenToGrid(e.clientX, e.clientY);
    eventBus.emit(Events.MOUSE_UP, { position: pos, modifiers: this.modifiers });
    this.removeDocumentListeners();
  };

  private handleDocumentMouseMove = (e: MouseEvent): void => {
    // Only handle when mouse is outside the canvas (canvas handles its own moves)
    const canvas = this.renderer.getCanvas();
    const rect = canvas.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (inside) return;

    this.updateModifiers(e);
    const pos = this.renderer.screenToGrid(e.clientX, e.clientY);
    if (this.lastPosition && this.lastPosition.x === pos.x && this.lastPosition.y === pos.y) {
      return;
    }
    this.lastPosition = pos;
    eventBus.emit(Events.MOUSE_DRAG, pos);
  };

  private handleDocumentMouseUp = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    this.updateModifiers(e);
    this.isButtonDown = false;
    const pos = this.renderer.screenToGrid(e.clientX, e.clientY);
    eventBus.emit(Events.MOUSE_UP, { position: pos, modifiers: this.modifiers });
    this.removeDocumentListeners();
  };

  private removeDocumentListeners(): void {
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    document.removeEventListener('mouseup', this.handleDocumentMouseUp);
  }

  private handleMouseLeave = (): void => {
    // Don't reset isButtonDown - let document listeners handle drag outside canvas
    if (!this.isButtonDown) {
      this.lastPosition = null;
      eventBus.emit(Events.MOUSE_LEAVE, null);
      eventBus.emit(Events.CURSOR_HIDDEN, null);
    }
  };

  private handleMouseEnter = (e: MouseEvent): void => {
    this.updateModifiers(e);
    const pos = this.renderer.screenToGrid(e.clientX, e.clientY);
    this.lastPosition = pos;
    if (this.isButtonDown) {
      eventBus.emit(Events.MOUSE_DRAG, pos);
    } else {
      eventBus.emit(Events.MOUSE_MOVE, pos);
    }
  };

  getModifiers(): InputModifiers {
    return { ...this.modifiers };
  }

  cleanup(): void {
    const canvas = this.renderer.getCanvas();
    canvas.removeEventListener('mousemove', this.handleMouseMove);
    canvas.removeEventListener('mousedown', this.handleMouseDown);
    canvas.removeEventListener('mouseup', this.handleMouseUp);
    canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    canvas.removeEventListener('mouseenter', this.handleMouseEnter);
    this.removeDocumentListeners();
  }
}
