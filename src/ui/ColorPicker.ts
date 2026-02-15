import { DOS_PALETTE, DOS_COLOR_NAMES, TRANSPARENT_COLOR, isTransparent } from '../core/DosColors';
import { eventBus, Events } from '../core/EventBus';

export class ColorPicker {
  private element: HTMLElement;
  private foreground = 15;
  private background = 0;

  constructor(private container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'color-picker';
    container.appendChild(this.element);
    this.render();
  }

  private render(): void {
    this.element.innerHTML = '';

    // Foreground section
    const fgLabel = document.createElement('div');
    fgLabel.className = 'color-label';
    fgLabel.textContent = 'FG';
    this.element.appendChild(fgLabel);

    const fgGrid = document.createElement('div');
    fgGrid.className = 'color-grid';
    for (let i = 0; i < 16; i++) {
      const swatch = this.createSwatch(i, 'fg');
      if (i === this.foreground) swatch.classList.add('selected');
      fgGrid.appendChild(swatch);
    }
    // Transparent swatch
    const fgTransparent = this.createTransparentSwatch('fg');
    if (isTransparent(this.foreground)) fgTransparent.classList.add('selected');
    fgGrid.appendChild(fgTransparent);
    this.element.appendChild(fgGrid);

    // Background section
    const bgLabel = document.createElement('div');
    bgLabel.className = 'color-label';
    bgLabel.textContent = 'BG';
    this.element.appendChild(bgLabel);

    const bgGrid = document.createElement('div');
    bgGrid.className = 'color-grid';
    for (let i = 0; i < 16; i++) {
      const swatch = this.createSwatch(i, 'bg');
      if (i === this.background) swatch.classList.add('selected');
      bgGrid.appendChild(swatch);
    }
    // Transparent swatch
    const bgTransparent = this.createTransparentSwatch('bg');
    if (isTransparent(this.background)) bgTransparent.classList.add('selected');
    bgGrid.appendChild(bgTransparent);
    this.element.appendChild(bgGrid);

    // Preview
    const preview = document.createElement('div');
    preview.className = 'color-preview';
    if (isTransparent(this.background)) {
      preview.style.background = 'repeating-conic-gradient(#cccccc 0% 25%, #999999 0% 50%) 50% / 12px 12px';
    } else {
      preview.style.backgroundColor = DOS_PALETTE[this.background];
    }
    if (isTransparent(this.foreground)) {
      preview.style.color = '#888888';
    } else {
      preview.style.color = DOS_PALETTE[this.foreground];
    }
    preview.textContent = 'Aa';
    this.element.appendChild(preview);
  }

  private createSwatch(colorIndex: number, type: 'fg' | 'bg'): HTMLElement {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = DOS_PALETTE[colorIndex];
    swatch.title = DOS_COLOR_NAMES[colorIndex];
    swatch.addEventListener('click', () => {
      if (type === 'fg') {
        this.foreground = colorIndex;
        eventBus.emit(Events.COLOR_CHANGED, { foreground: colorIndex });
      } else {
        this.background = colorIndex;
        eventBus.emit(Events.COLOR_CHANGED, { background: colorIndex });
      }
      this.render();
    });
    return swatch;
  }

  private createTransparentSwatch(type: 'fg' | 'bg'): HTMLElement {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch color-swatch-transparent';
    swatch.title = 'Transparent';
    swatch.addEventListener('click', () => {
      if (type === 'fg') {
        this.foreground = TRANSPARENT_COLOR;
        eventBus.emit(Events.COLOR_CHANGED, { foreground: TRANSPARENT_COLOR });
      } else {
        this.background = TRANSPARENT_COLOR;
        eventBus.emit(Events.COLOR_CHANGED, { background: TRANSPARENT_COLOR });
      }
      this.render();
    });
    return swatch;
  }

  getForeground(): number { return this.foreground; }
  getBackground(): number { return this.background; }
}
