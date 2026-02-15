import { TabManager } from '../state/TabManager';
import { eventBus, Events } from '../core/EventBus';

export class TabBar {
  private element: HTMLElement;

  constructor(private container: HTMLElement, private tabManager: TabManager) {
    this.element = document.createElement('div');
    this.element.className = 'tab-bar';
    container.appendChild(this.element);
    this.render();

    eventBus.on(Events.TAB_LIST_CHANGED, () => this.render());
    eventBus.on(Events.TAB_CHANGED, () => this.render());
  }

  private render(): void {
    this.element.innerHTML = '';

    const sessions = this.tabManager.getSessions();
    const active = this.tabManager.getActiveSession();

    for (const session of sessions) {
      const tab = document.createElement('div');
      tab.className = `tab-item ${session.id === active.id ? 'active' : ''}`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.textContent = session.name;

      // Double-click to rename
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.startRename(tab, session.id, nameSpan);
      });

      tab.appendChild(nameSpan);

      // Close button (only if more than 1 tab)
      if (sessions.length > 1) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '\u00d7';
        closeBtn.title = 'Close tab';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.tabManager.closeTab(session.id);
        });
        tab.appendChild(closeBtn);
      }

      // Click to switch
      tab.addEventListener('click', () => {
        this.tabManager.switchTab(session.id);
      });

      this.element.appendChild(tab);
    }

    // Add tab button
    const addBtn = document.createElement('button');
    addBtn.className = 'tab-add';
    addBtn.textContent = '+';
    addBtn.title = 'New tab';
    addBtn.addEventListener('click', () => {
      this.tabManager.createTab();
    });
    this.element.appendChild(addBtn);
  }

  private startRename(tabEl: HTMLElement, sessionId: string, nameSpan: HTMLSpanElement): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-rename-input';
    input.value = nameSpan.textContent ?? '';
    input.style.width = `${Math.max(nameSpan.offsetWidth, 40)}px`;

    const commit = () => {
      const newName = input.value.trim();
      if (newName) {
        this.tabManager.renameTab(sessionId, newName);
      }
      this.render();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
      if (e.key === 'Escape') {
        input.removeEventListener('blur', commit);
        this.render();
      }
    });

    nameSpan.replaceWith(input);
    input.focus();
    input.select();
  }
}
