type EventHandler<T = unknown> = (data: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);
    return () => this.off(event, handler);
  }

  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler);
  }

  emit<T = unknown>(event: string, data: T): void {
    this.handlers.get(event)?.forEach(handler => handler(data));
  }
}

export const eventBus = new EventBus();

// Event name constants
export const Events = {
  DOCUMENT_CHANGED: 'document:changed',
  DOCUMENT_RESIZED: 'document:resized',
  LAYER_CHANGED: 'layer:changed',
  ACTIVE_LAYER_CHANGED: 'activeLayer:changed',
  TOOL_CHANGED: 'tool:changed',
  COLOR_CHANGED: 'color:changed',
  CHAR_CHANGED: 'char:changed',
  CURSOR_MOVED: 'cursor:moved',
  CURSOR_HIDDEN: 'cursor:hidden',
  MOUSE_DOWN: 'mouse:down',
  MOUSE_UP: 'mouse:up',
  MOUSE_MOVE: 'mouse:move',
  MOUSE_DRAG: 'mouse:drag',
  MOUSE_LEAVE: 'mouse:leave',
  KEY_DOWN: 'key:down',
  KEY_UP: 'key:up',
  UNDO: 'command:undo',
  REDO: 'command:redo',
  SELECTION_CHANGED: 'selection:changed',
  RENDER_REQUEST: 'render:request',
  ZOOM_CHANGED: 'zoom:changed',
  GRID_TOGGLED: 'grid:toggled',
  TAB_CHANGED: 'tab:changed',
  TAB_LIST_CHANGED: 'tab:list:changed',
  BOX_STYLE_CHANGED: 'boxStyle:changed',
} as const;
