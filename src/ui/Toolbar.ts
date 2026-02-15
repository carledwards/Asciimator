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
      } else if (tool.getName() === 'fill') {
        const icon = document.createElement('span');
        icon.className = 'tool-fill-icon';
        const drop = document.createElement('span');
        drop.className = 'tool-fill-drop';
        icon.appendChild(drop);
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
