import { eventBus, Events } from '../core/EventBus';
import type { BoxStyle } from '../tools/BoxDrawing';

const STYLES: Array<{ id: BoxStyle; label: string; preview: string }> = [
  { id: 'single', label: 'Single', preview: '┌─┐' },
  { id: 'double', label: 'Double', preview: '╔═╗' },
];

export class BoxStylePicker {
  private element: HTMLElement;
  private selected: BoxStyle = 'single';

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'box-style-picker';
    this.element.style.display = 'none';
    container.appendChild(this.element);
    this.render();

    eventBus.on(Events.TOOL_CHANGED, (name: unknown) => {
      const tool = name as string;
      this.element.style.display = (tool === 'smartline' || tool === 'smartbox') ? '' : 'none';
    });
  }

  private render(): void {
    this.element.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'Box Style';
    this.element.appendChild(header);

    for (const style of STYLES) {
      const option = document.createElement('div');
      option.className = `box-style-option ${style.id === this.selected ? 'selected' : ''}`;
      option.addEventListener('click', () => {
        this.selected = style.id;
        eventBus.emit(Events.BOX_STYLE_CHANGED, style.id);
        this.render();
      });

      const label = document.createElement('span');
      label.className = 'box-style-label';
      label.textContent = style.label;

      const preview = document.createElement('span');
      preview.className = 'box-style-preview';
      preview.textContent = style.preview;

      option.appendChild(label);
      option.appendChild(preview);
      this.element.appendChild(option);
    }
  }
}
