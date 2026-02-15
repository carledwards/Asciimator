import { Position, CellAttributes, Cell } from '../core/types';
import { eventBus, Events } from '../core/EventBus';
import { CompositeBuffer } from './CompositeBuffer';
import { CanvasRenderer } from './CanvasRenderer';

export class CursorRenderer {
  private position: Position | null = null;
  private isVisible = false;
  private autoHideTimeout = 3000;
  private lastMovement = Date.now();
  private autoHideTimer: number | null = null;
  private currentChar = '█';
  private activeTool = '';

  constructor(
    private compositeBuffer: CompositeBuffer,
    private canvasRenderer: CanvasRenderer,
  ) {
    eventBus.on(Events.MOUSE_MOVE, (data: unknown) => {
      const pos = data as Position;
      this.update(pos);
    });
    eventBus.on(Events.MOUSE_DRAG, (data: unknown) => {
      const pos = data as Position;
      this.update(pos);
    });
    eventBus.on(Events.MOUSE_LEAVE, () => {
      this.hide();
    });
    eventBus.on(Events.KEY_DOWN, () => {
      this.handleKeyPress();
    });
    eventBus.on(Events.CHAR_CHANGED, (ch: unknown) => {
      this.currentChar = ch as string;
    });
    eventBus.on(Events.TOOL_CHANGED, (name: unknown) => {
      this.activeTool = name as string;
    });
  }

  private update(position: Position): void {
    if (this.position && this.position.x === position.x && this.position.y === position.y) {
      return;
    }
    this.position = position;
    this.isVisible = true;
    this.lastMovement = Date.now();
    this.startAutoHideTimer();
    this.applyToRenderer();
  }

  private hide(): void {
    this.isVisible = false;
    this.position = null;
    this.canvasRenderer.setCursor(null, '', null);
  }

  private handleKeyPress(): void {
    this.isVisible = false;
    if (this.autoHideTimer) {
      window.clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    this.canvasRenderer.setCursor(null, '', null);
  }

  private startAutoHideTimer(): void {
    if (this.autoHideTimer) {
      window.clearTimeout(this.autoHideTimer);
    }
    this.autoHideTimer = window.setTimeout(() => {
      if (Date.now() - this.lastMovement >= this.autoHideTimeout) {
        this.isVisible = false;
        this.canvasRenderer.setCursor(null, '', null);
      }
    }, this.autoHideTimeout);
  }

  private getInvertedAttributes(attrs: CellAttributes): CellAttributes {
    return {
      foreground: 15 - attrs.foreground,
      background: 15 - attrs.background,
    };
  }

  private applyToRenderer(): void {
    if (!this.position || !this.isVisible) {
      this.canvasRenderer.setCursor(null, '', null);
      return;
    }
    const cell = this.compositeBuffer.getCell(this.position.x, this.position.y);
    const isSmartTool = this.activeTool === 'smartline' || this.activeTool === 'smartbox';
    const displayChar = isSmartTool ? ' ' : this.currentChar;
    const inverted = this.getInvertedAttributes(cell.attributes);
    this.canvasRenderer.setCursor(this.position, displayChar, inverted);
  }

  getPosition(): Position | null {
    return this.position;
  }

  cleanup(): void {
    if (this.autoHideTimer) {
      window.clearTimeout(this.autoHideTimer);
    }
  }
}
