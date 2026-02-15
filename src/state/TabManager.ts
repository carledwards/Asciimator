import { Document } from '../document/Document';
import { Command } from './Command';
import { eventBus, Events } from '../core/EventBus';

export interface TabSession {
  id: string;
  name: string;
  doc: Document;
  undoStack: Command[];
  redoStack: Command[];
}

let nextId = 1;

function createTabId(): string {
  return `tab-${nextId++}`;
}

export class TabManager {
  private sessions: TabSession[] = [];
  private activeIndex = 0;
  private tabCounter = 0;

  createTab(): TabSession {
    this.tabCounter++;
    const session: TabSession = {
      id: createTabId(),
      name: `Untitled ${this.tabCounter}`,
      doc: new Document(80, 25),
      undoStack: [],
      redoStack: [],
    };
    this.sessions.push(session);
    this.activeIndex = this.sessions.length - 1;
    eventBus.emit(Events.TAB_LIST_CHANGED, null);
    eventBus.emit(Events.TAB_CHANGED, session);
    return session;
  }

  closeTab(id: string): TabSession | null {
    if (this.sessions.length <= 1) return null;
    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx < 0) return null;

    const wasActive = idx === this.activeIndex;
    this.sessions.splice(idx, 1);

    if (this.activeIndex >= this.sessions.length) {
      this.activeIndex = this.sessions.length - 1;
    } else if (this.activeIndex > idx) {
      this.activeIndex--;
    }

    const active = this.sessions[this.activeIndex];
    eventBus.emit(Events.TAB_LIST_CHANGED, null);
    if (wasActive) {
      eventBus.emit(Events.TAB_CHANGED, active);
    }
    return active;
  }

  switchTab(id: string): TabSession | null {
    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx < 0 || idx === this.activeIndex) return null;
    this.activeIndex = idx;
    const session = this.sessions[this.activeIndex];
    eventBus.emit(Events.TAB_CHANGED, session);
    return session;
  }

  renameTab(id: string, name: string): void {
    const session = this.sessions.find(s => s.id === id);
    if (session) {
      session.name = name;
      eventBus.emit(Events.TAB_LIST_CHANGED, null);
    }
  }

  getActiveSession(): TabSession {
    return this.sessions[this.activeIndex];
  }

  getSessions(): TabSession[] {
    return this.sessions;
  }

  getActiveIndex(): number {
    return this.activeIndex;
  }
}
