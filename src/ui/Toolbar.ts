import { ToolManager } from '../tools/ToolManager';
import { eventBus, Events } from '../core/EventBus';

export class Toolbar {
  private element: HTMLElement;

  constructor(private container: HTMLElement, private toolManager: ToolManager) {
    this.element = document.createElement('div');
    this.element.className = 'toolbar';
    container.appendChild(this.element);
    this.render();

    eventBus.on(Events.TOOL_CHANGED, () => this.render());
  }

  private render(): void {
    this.element.innerHTML = '';
    const tools = this.toolManager.getTools();
    const activeToolName = this.toolManager.getActiveToolName();

    for (const tool of tools) {
      const btn = document.createElement('button');
      btn.className = `toolbar-btn ${tool.getName() === activeToolName ? 'active' : ''}`;
      btn.title = `${tool.getName()} (${tool.getShortcut()})`;
      if (tool.getName() === 'selection') {
        const icon = document.createElement('span');
        icon.className = 'tool-select-icon';
        btn.appendChild(icon);
      } else if (tool.getName() === 'pencil') {
        const icon = document.createElement('span');
        icon.className = 'tool-pencil-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'line') {
        const icon = document.createElement('span');
        icon.className = 'tool-line-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'rectangle') {
        const icon = document.createElement('span');
        icon.className = 'tool-rectangle-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'filled-rectangle') {
        const icon = document.createElement('span');
        icon.className = 'tool-filled-rectangle-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'circle') {
        const icon = document.createElement('span');
        icon.className = 'tool-circle-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'filled-circle') {
        const icon = document.createElement('span');
        icon.className = 'tool-filled-circle-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'smartline') {
        const icon = document.createElement('span');
        icon.className = 'tool-smartline-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'smartbox') {
        const icon = document.createElement('span');
        icon.className = 'tool-smartbox-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'fill') {
        const icon = document.createElement('span');
        icon.className = 'tool-fill-icon-file';
        btn.appendChild(icon);
      } else if (tool.getName() === 'dropper') {
        const icon = document.createElement('span');
        icon.className = 'tool-dropper-icon-file';
        btn.appendChild(icon);
      } else {
        btn.textContent = tool.getIcon();
      }
      btn.addEventListener('click', () => {
        this.toolManager.setActiveTool(tool.getName());
      });
      this.element.appendChild(btn);
    }
  }
}
