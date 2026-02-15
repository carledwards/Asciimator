import { eventBus, Events } from '../core/EventBus';

const CHAR_GROUPS = [
  {
    label: 'Letters',
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  },
  {
    label: 'Numbers & Symbols',
    chars: '0123456789!@#$%^&*()-_=+[]{}|;:\'",.<>?/`~',
  },
  {
    label: 'Box Drawing',
    chars: '─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╒╓╘╙╞╡╤╥╧╨╪╫',
  },
  {
    label: 'Blocks & Shading',
    chars: '█▓▒░▄▀▌▐■□▪▫▬▲►▼◄◆◇○●◘◙',
  },
  {
    label: 'Misc',
    chars: '♠♣♥♦☺☻♪♫☼►◄↑↓→←↔↕▲▼',
  },
];

export class CharacterPicker {
  private element: HTMLElement;
  private selectedChar = ' ';

  constructor(private container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'char-picker';
    container.appendChild(this.element);
    this.render();

    eventBus.on(Events.TOOL_CHANGED, (name: unknown) => {
      const tool = name as string;
      this.element.style.display = (tool === 'smartline' || tool === 'smartbox') ? 'none' : '';
    });
  }

  private render(): void {
    this.element.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'Characters';
    this.element.appendChild(header);

    // Current char display
    const current = document.createElement('div');
    current.className = 'current-char';
    current.textContent = this.selectedChar === ' ' ? 'Current: (space)' : `Current: ${this.selectedChar}`;
    this.element.appendChild(current);

    // Space character button
    const spaceRow = document.createElement('div');
    spaceRow.className = 'char-grid';
    const spaceCell = document.createElement('div');
    spaceCell.className = `char-cell char-cell-space ${this.selectedChar === ' ' ? 'selected' : ''}`;
    spaceCell.textContent = '␣';
    spaceCell.title = 'Space (U+0020)';
    spaceCell.addEventListener('click', () => {
      this.selectedChar = ' ';
      eventBus.emit(Events.CHAR_CHANGED, ' ');
      this.render();
    });
    spaceRow.appendChild(spaceCell);
    this.element.appendChild(spaceRow);

    for (const group of CHAR_GROUPS) {
      const label = document.createElement('div');
      label.className = 'char-group-label';
      label.textContent = group.label;
      this.element.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'char-grid';
      for (const ch of group.chars) {
        const cell = document.createElement('div');
        cell.className = `char-cell ${ch === this.selectedChar ? 'selected' : ''}`;
        cell.textContent = ch;
        cell.title = `${ch} (U+${ch.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()})`;
        cell.addEventListener('click', () => {
          this.selectedChar = ch;
          eventBus.emit(Events.CHAR_CHANGED, ch);
          this.render();
        });
        grid.appendChild(cell);
      }
      this.element.appendChild(grid);
    }
  }

  getSelectedChar(): string { return this.selectedChar; }
}
