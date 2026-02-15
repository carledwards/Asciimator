import { Position } from '../core/types';
import { DOS_COLOR_NAMES } from '../core/DosColors';
import { eventBus, Events } from '../core/EventBus';

export class StatusBar {
  private element: HTMLElement;
  private cursorX = 0;
  private cursorY = 0;
  private toolName = 'pencil';
  private currentChar = '█';
  private foreground = 15;
  private background = 0;

  constructor(private container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'status-bar';
    container.appendChild(this.element);

    eventBus.on(Events.CURSOR_MOVED, (pos: unknown) => {
      const p = pos as Position;
      this.cursorX = p.x;
      this.cursorY = p.y;
      this.render();
    });
    eventBus.on(Events.TOOL_CHANGED, (name: unknown) => {
      this.toolName = name as string;
      this.render();
    });
    eventBus.on(Events.CHAR_CHANGED, (ch: unknown) => {
      this.currentChar = ch as string;
      this.render();
    });
    eventBus.on(Events.COLOR_CHANGED, (data: unknown) => {
      const d = data as { foreground?: number; background?: number };
      if (d.foreground !== undefined) this.foreground = d.foreground;
      if (d.background !== undefined) this.background = d.background;
      this.render();
    });

    this.render();
  }

  private render(): void {
    this.element.innerHTML = '';

    const items = [
      `Col: ${this.cursorX}`,
      `Row: ${this.cursorY}`,
      `Tool: ${this.toolName}`,
      `Char: ${this.currentChar === ' ' ? '(space)' : this.currentChar}`,
      `FG: ${this.foreground} (${DOS_COLOR_NAMES[this.foreground]})`,
      `BG: ${this.background} (${DOS_COLOR_NAMES[this.background]})`,
    ];

    for (const text of items) {
      const span = document.createElement('span');
      span.className = 'status-item';
      span.textContent = text;
      this.element.appendChild(span);
    }
  }
}
