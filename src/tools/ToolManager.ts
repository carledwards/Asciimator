import { Tool } from './Tool';
import { eventBus, Events } from '../core/EventBus';

export class ToolManager {
  private tools = new Map<string, Tool>();
  private activeTool: Tool | null = null;

  registerTool(tool: Tool): void {
    this.tools.set(tool.getName(), tool);
  }

  setActiveTool(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) return;
    if (this.activeTool === tool) return;
    this.activeTool?.onDeactivate();
    this.activeTool = tool;
    this.activeTool.onActivate();
    eventBus.emit(Events.TOOL_CHANGED, name);
  }

  getActiveTool(): Tool | null {
    return this.activeTool;
  }

  getActiveToolName(): string {
    return this.activeTool?.getName() ?? '';
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}
