import { LayerManager } from '../document/LayerManager';
import { LayerGroup } from '../document/LayerGroup';
import { Layer } from '../document/Layer';
import { eventBus, Events } from '../core/EventBus';
import { UndoRedoManager } from '../state/UndoRedoManager';
import { LayerStructureCommand } from '../state/Command';

type VisualEntry =
  | { type: 'groupHeader'; group: LayerGroup }
  | { type: 'layer'; layer: Layer; arrayIndex: number };

type MenuAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

type BackdropMode = 'solid' | 'checker';

export class LayerPanel {
  private element: HTMLElement;
  private draggedId: string | null = null; // layer id or group id
  private draggedType: 'layer' | 'group' = 'layer';
  private draggedVisualIndex: number = -1;
  private activeGroupId: string | null = null;
  private dragHintEl: HTMLElement | null = null;

  setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
    this.ensureActiveGroupExists();
    this.render();
  }

  constructor(
    private container: HTMLElement,
    private layerManager: LayerManager,
    private undoManager: UndoRedoManager,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'layer-panel';
    container.appendChild(this.element);
    this.render();

    eventBus.on(Events.LAYER_CHANGED, () => {
      this.ensureActiveGroupExists();
      this.render();
    });
    eventBus.on(Events.ACTIVE_LAYER_CHANGED, () => {
      this.activeGroupId = null;
      this.render();
    });
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
  }

  private ensureActiveGroupExists(): void {
    if (!this.activeGroupId) return;
    if (!this.layerManager.getGroupById(this.activeGroupId)) {
      this.activeGroupId = null;
    }
  }

  private runLayerMutation(description: string, mutate: () => void): void {
    const before = this.layerManager.getStateSnapshot();
    mutate();
    const after = this.layerManager.getStateSnapshot();
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.undoManager.execute(new LayerStructureCommand(this.layerManager, before, after, description));
  }

  private addLayerAtSelection(): void {
    if (!this.activeGroupId || !this.layerManager.getGroupById(this.activeGroupId)) {
      this.runLayerMutation('Add layer', () => {
        this.layerManager.addLayer();
      });
      return;
    }

    this.runLayerMutation('Add layer to group', () => {
      const topInGroup = this.layerManager.getHighestIndexInGroup(this.activeGroupId!);
      const insertIndex = topInGroup >= 0 ? topInGroup + 1 : this.layerManager.getLayers().length;
      this.layerManager.addLayer(undefined, {
        groupId: this.activeGroupId,
        index: insertIndex,
      });
    });
  }

  private addLayerToGroup(groupId: string): void {
    this.activeGroupId = groupId;
    this.addLayerAtSelection();
  }

  private ensureDragHint(): HTMLElement {
    if (this.dragHintEl) return this.dragHintEl;
    const el = document.createElement('div');
    el.className = 'layer-drag-hint';
    document.body.appendChild(el);
    this.dragHintEl = el;
    return el;
  }

  private updateDragHint(text: string, x: number, y: number): void {
    const hint = this.ensureDragHint();
    hint.textContent = text;
    hint.style.left = `${x + 12}px`;
    hint.style.top = `${y + 14}px`;
    hint.style.display = 'block';
  }

  private hideDragHint(): void {
    if (!this.dragHintEl) return;
    this.dragHintEl.style.display = 'none';
  }

  private getDropActionLabel(targetEntry: VisualEntry, dropAbove: boolean): string {
    if (!this.draggedId) return 'Move';

    if (this.draggedType === 'group') {
      if (targetEntry.type === 'groupHeader' && targetEntry.group.id === this.draggedId) {
        return 'Keep group position';
      }
      return 'Move group';
    }

    const draggedLayer = this.layerManager.getLayerById(this.draggedId);
    if (!draggedLayer) return 'Move layer';

    if (targetEntry.type === 'groupHeader') {
      if (dropAbove) return `Place above ${targetEntry.group.name}`;
      if (draggedLayer.groupId === targetEntry.group.id) return 'Remove from Group';
      return `Add to ${targetEntry.group.name}`;
    }

    if (targetEntry.layer.id === draggedLayer.id) {
      return 'Keep position';
    }

    if (targetEntry.layer.groupId && targetEntry.layer.groupId !== draggedLayer.groupId) {
      const group = this.layerManager.getGroupById(targetEntry.layer.groupId);
      if (group) return `Add to ${group.name}`;
    }

    if (!targetEntry.layer.groupId && draggedLayer.groupId) {
      return 'Remove from Group';
    }

    return 'Move layer';
  }

  private render(): void {
    this.element.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'Layers';
    this.element.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'layer-actions';

    const addBtn = document.createElement('button');
    addBtn.className = 'layer-action-btn';
    addBtn.textContent = '+';
    addBtn.title = this.activeGroupId ? 'Add layer to selected group' : 'Add layer';
    addBtn.addEventListener('click', () => this.addLayerAtSelection());
    actions.appendChild(addBtn);

    const addGroupBtn = document.createElement('button');
    addGroupBtn.className = 'layer-action-btn';
    addGroupBtn.innerHTML = `
      <svg class="layer-action-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M3 3h2v2h2v2H5v2H3V7H1V5h2V3zm6 0h10v2H9V3zm0 4h10v2H9V7zm0 4h10v2H9v-2zm0 4h10v2H9v-2z" />
      </svg>
    `;
    addGroupBtn.title = 'Add group';
    addGroupBtn.addEventListener('click', () => {
      this.runLayerMutation('Add group', () => {
        const group = this.layerManager.addGroup();
        this.activeGroupId = group.id;
      });
      // addGroup emits before local activeGroupId is set; ensure selected state is reflected.
      this.render();
    });
    actions.appendChild(addGroupBtn);

    const dupBtn = document.createElement('button');
    dupBtn.className = 'layer-action-btn';
    dupBtn.textContent = '⧉';
    dupBtn.title = 'Duplicate layer';
    dupBtn.addEventListener('click', () => {
      this.activeGroupId = null;
      this.runLayerMutation('Duplicate layer', () => {
        this.layerManager.duplicateLayer(this.layerManager.getActiveLayerId());
      });
    });
    actions.appendChild(dupBtn);

    const mergeBtn = document.createElement('button');
    mergeBtn.className = 'layer-action-btn';
    mergeBtn.textContent = '⤓';
    mergeBtn.title = 'Merge down';
    mergeBtn.addEventListener('click', () => {
      this.activeGroupId = null;
      this.runLayerMutation('Merge layer down', () => {
        this.layerManager.mergeDown(this.layerManager.getActiveLayerId());
      });
    });
    actions.appendChild(mergeBtn);

    this.element.appendChild(actions);

    const entries = this.buildVisualEntries();
    const activeId = this.activeGroupId ? '' : this.layerManager.getActiveLayerId();

    const list = document.createElement('div');
    list.className = 'layer-list';

    for (let vi = 0; vi < entries.length; vi++) {
      const entry = entries[vi];
      if (entry.type === 'groupHeader') {
        list.appendChild(this.renderGroupHeader(entry.group, vi, entries, list));
      } else {
        list.appendChild(this.renderLayerItem(entry.layer, entry.arrayIndex, vi, activeId, entries, list));
      }
    }

    const rootZone = document.createElement('div');
    rootZone.className = 'layer-root-drop-zone';
    this.attachRootDropHandlers(rootZone, list);
    list.appendChild(rootZone);

    this.element.appendChild(list);

    const quickActions = document.createElement('div');
    quickActions.className = 'layer-quick-actions';

    const backdropLabel = document.createElement('label');
    backdropLabel.className = 'layer-quick-toggle';

    const backdropToggle = document.createElement('input');
    backdropToggle.type = 'checkbox';
    backdropToggle.checked = this.getBackdropMode() === 'solid';
    backdropToggle.title = 'Toggle solid backdrop';
    backdropToggle.addEventListener('change', () => {
      this.setBackdropMode(backdropToggle.checked ? 'solid' : 'checker');
    });

    const text = document.createElement('span');
    text.textContent = 'Backdrop';

    backdropLabel.appendChild(backdropToggle);
    backdropLabel.appendChild(text);
    quickActions.appendChild(backdropLabel);
    this.element.appendChild(quickActions);
  }

  private buildVisualEntries(): VisualEntry[] {
    const layers = [...this.layerManager.getLayers()];
    const groups = this.layerManager.getGroups();
    const entries: VisualEntry[] = [];

    const membersByGroup = new Map<string, { layer: Layer; arrayIndex: number }[]>();
    const ungrouped: { layer: Layer; arrayIndex: number }[] = [];

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer.groupId) {
        ungrouped.push({ layer, arrayIndex: i });
        continue;
      }
      const bucket = membersByGroup.get(layer.groupId) ?? [];
      bucket.push({ layer, arrayIndex: i });
      membersByGroup.set(layer.groupId, bucket);
    }

    const blocks: Array<
      | { type: 'group'; group: LayerGroup; anchor: number }
      | { type: 'layer'; layer: Layer; arrayIndex: number; anchor: number }
    > = [];

    for (const group of groups) {
      blocks.push({
        type: 'group',
        group,
        anchor: this.layerManager.getGroupAnchorIndex(group.id),
      });
    }

    for (const entry of ungrouped) {
      blocks.push({
        type: 'layer',
        layer: entry.layer,
        arrayIndex: entry.arrayIndex,
        anchor: entry.arrayIndex,
      });
    }

    blocks.sort((a, b) => {
      if (a.anchor !== b.anchor) return b.anchor - a.anchor;
      if (a.type === 'group' && b.type === 'layer') return -1;
      if (a.type === 'layer' && b.type === 'group') return 1;
      if (a.type === 'group' && b.type === 'group') {
        return b.group.order - a.group.order;
      }
      if (a.type === 'layer' && b.type === 'layer') {
        return b.arrayIndex - a.arrayIndex;
      }
      return 0;
    });

    for (const block of blocks) {
      if (block.type === 'layer') {
        entries.push({ type: 'layer', layer: block.layer, arrayIndex: block.arrayIndex });
        continue;
      }

      entries.push({ type: 'groupHeader', group: block.group });
      if (block.group.collapsed) continue;

      const members = membersByGroup.get(block.group.id) ?? [];
      members.sort((a, b) => b.arrayIndex - a.arrayIndex);
      for (const member of members) {
        entries.push({ type: 'layer', layer: member.layer, arrayIndex: member.arrayIndex });
      }
    }

    return entries;
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!(e.target instanceof Node)) return;
    if (this.element.contains(e.target)) {
      if ((e.target as Element).closest('.layer-row-menu')) return;
    }
    this.closeAllRowMenus();
  }

  private closeAllRowMenus(): void {
    this.element.querySelectorAll('details.layer-row-menu[open]').forEach((other) => {
      (other as HTMLDetailsElement).open = false;
    });
  }

  private selectGroup(groupId: string): void {
    if (this.activeGroupId === groupId) return;
    this.activeGroupId = groupId;
    this.render();
  }

  private selectLayer(layerId: string): void {
    this.activeGroupId = null;
    this.layerManager.setActiveLayer(layerId);
  }

  private getBackdropMode(): BackdropMode {
    const stored = localStorage.getItem('asciimator-canvas-backdrop');
    return stored === 'checker' ? 'checker' : 'solid';
  }

  private setBackdropMode(mode: BackdropMode): void {
    localStorage.setItem('asciimator-canvas-backdrop', mode);
    eventBus.emit(Events.CANVAS_BACKDROP_CHANGED, { mode });
  }

  private startInlineRename(
    labelEl: HTMLElement,
    currentName: string,
    onCommit: (name: string) => void,
  ): void {
    if (labelEl.parentElement?.querySelector('.layer-inline-rename')) return;
    const parent = labelEl.parentElement;
    if (!parent) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layer-inline-rename';
    input.value = currentName;

    const finish = (commit: boolean): void => {
      if (!input.isConnected) return;
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('keydown', onKeyDown);
      labelEl.style.display = '';
      input.remove();

      if (!commit) return;
      const next = input.value.trim();
      if (!next || next === currentName) return;
      onCommit(next);
    };

    const onBlur = (): void => finish(true);
    const onKeyDown = (e: KeyboardEvent): void => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finish(false);
      }
    };

    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('mousedown', (e) => e.stopPropagation());

    labelEl.style.display = 'none';
    parent.insertBefore(input, labelEl.nextSibling);
    input.focus();
    input.select();
  }

  private renderGroupHeader(
    group: LayerGroup,
    visualIndex: number,
    entries: VisualEntry[],
    list: HTMLElement,
  ): HTMLElement {
    const item = document.createElement('div');
    item.className = 'layer-group-header';
    if (group.id === this.activeGroupId) item.classList.add('active');
    item.draggable = true;
    item.dataset.groupId = group.id;
    item.dataset.visualIndex = String(visualIndex);

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'group-collapse-btn';
    collapseBtn.textContent = group.collapsed ? '▶' : '▼';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.runLayerMutation('Toggle group collapsed', () => {
        this.layerManager.toggleGroupCollapsed(group.id);
      });
    });
    item.appendChild(collapseBtn);

    const visBtn = document.createElement('button');
    visBtn.className = 'layer-vis-btn';
    visBtn.textContent = group.visible ? '👁' : '○';
    visBtn.title = group.visible ? 'Hide group' : 'Show group';
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.runLayerMutation('Toggle group visibility', () => {
        this.layerManager.toggleGroupVisibility(group.id);
      });
    });
    item.appendChild(visBtn);

    const lockBtn = document.createElement('button');
    lockBtn.className = 'layer-lock-btn';
    lockBtn.textContent = group.locked ? '🔒' : '🔓';
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.runLayerMutation('Toggle group lock', () => {
        this.layerManager.toggleGroupLock(group.id);
      });
    });
    item.appendChild(lockBtn);

    const name = document.createElement('span');
    name.className = 'group-name';
    name.textContent = group.name;
    name.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectGroup(group.id);
    });
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.startInlineRename(name, group.name, (newName) => {
        this.runLayerMutation('Rename group', () => {
          this.layerManager.renameGroup(group.id, newName);
        });
      });
    });
    item.appendChild(name);

    item.appendChild(this.createRowMenu([
      {
        label: 'Rename group',
        onClick: () => {
          const newName = prompt('Rename group:', group.name);
          if (!newName) return;
          this.runLayerMutation('Rename group', () => {
            this.layerManager.renameGroup(group.id, newName);
          });
        },
      },
      {
        label: 'Add layer here',
        onClick: () => this.addLayerToGroup(group.id),
      },
      {
        label: 'Delete group',
        danger: true,
        onClick: () => {
          this.runLayerMutation('Delete group', () => {
            this.layerManager.removeGroup(group.id);
            if (this.activeGroupId === group.id) this.activeGroupId = null;
          });
        },
      },
    ]));

    item.addEventListener('dragstart', (e) => {
      this.draggedId = group.id;
      this.draggedType = 'group';
      this.draggedVisualIndex = visualIndex;
      item.classList.add('dragging');
      this.updateDragHint('Move group', e.clientX, e.clientY);
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', group.id);
    });

    item.addEventListener('dragend', () => {
      this.draggedId = null;
      this.draggedType = 'layer';
      this.draggedVisualIndex = -1;
      item.classList.remove('dragging');
      this.hideDragHint();
      this.clearDropIndicators(list);
    });

    this.attachDropHandlers(item, visualIndex, entries, list);

    item.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, summary, details, input')) return;
      e.stopPropagation();
      this.startInlineRename(name, group.name, (newName) => {
        this.runLayerMutation('Rename group', () => {
          this.layerManager.renameGroup(group.id, newName);
        });
      });
    });

    item.addEventListener('click', () => {
      this.selectGroup(group.id);
    });

    return item;
  }

  private renderLayerItem(
    layer: Layer,
    _arrayIndex: number,
    visualIndex: number,
    activeId: string,
    entries: VisualEntry[],
    list: HTMLElement,
  ): HTMLElement {
    const isGrouped = !!layer.groupId;
    const groupHidden = isGrouped && !this.layerManager.isLayerEffectivelyVisible(layer) && layer.visible;
    const groupLocked = isGrouped && this.layerManager.isLayerEffectivelyLocked(layer) && !layer.locked;

    const item = document.createElement('div');
    item.className = 'layer-item';
    if (layer.id === activeId) item.classList.add('active');
    if (isGrouped) item.classList.add('grouped');
    if (groupHidden) item.classList.add('group-hidden');
    if (groupLocked) item.classList.add('group-locked');
    item.draggable = true;
    item.dataset.layerId = layer.id;
    item.dataset.visualIndex = String(visualIndex);

    const handle = document.createElement('span');
    handle.className = 'layer-drag-handle';
    handle.textContent = '⠿';
    item.appendChild(handle);

    const visBtn = document.createElement('button');
    visBtn.className = 'layer-vis-btn';
    visBtn.textContent = layer.visible ? '👁' : '○';
    visBtn.title = layer.visible ? 'Hide' : 'Show';
    visBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.runLayerMutation('Toggle layer visibility', () => {
        this.layerManager.toggleVisibility(layer.id);
      });
    });
    item.appendChild(visBtn);

    const lockBtn = document.createElement('button');
    lockBtn.className = 'layer-lock-btn';
    lockBtn.textContent = layer.locked ? '🔒' : '🔓';
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.runLayerMutation('Toggle layer lock', () => {
        this.layerManager.toggleLock(layer.id);
      });
    });
    item.appendChild(lockBtn);

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.name;
    name.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectLayer(layer.id);
    });
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.startInlineRename(name, layer.name, (newName) => {
        this.runLayerMutation('Rename layer', () => {
          this.layerManager.renameLayer(layer.id, newName);
        });
      });
    });
    item.appendChild(name);

    item.appendChild(this.createRowMenu([
      {
        label: 'Rename layer',
        onClick: () => {
          const newName = prompt('Rename layer:', layer.name);
          if (!newName) return;
          this.runLayerMutation('Rename layer', () => {
            this.layerManager.renameLayer(layer.id, newName);
          });
        },
      },
      {
        label: 'Duplicate layer',
        onClick: () => {
          this.activeGroupId = null;
          this.runLayerMutation('Duplicate layer', () => {
            this.layerManager.duplicateLayer(layer.id);
          });
        },
      },
      {
        label: 'Remove from Group',
        onClick: () => {
          this.activeGroupId = null;
          this.runLayerMutation('Move layer to root', () => {
            this.layerManager.setLayerGroup(layer.id, null);
          });
        },
      },
      {
        label: 'Delete layer',
        danger: true,
        onClick: () => {
          this.activeGroupId = null;
          this.runLayerMutation('Delete layer', () => {
            this.layerManager.removeLayer(layer.id);
          });
        },
      },
    ]));

    item.addEventListener('dragstart', (e) => {
      this.draggedId = layer.id;
      this.draggedType = 'layer';
      this.draggedVisualIndex = visualIndex;
      item.classList.add('dragging');
      this.updateDragHint(layer.groupId ? 'Remove from Group' : 'Move layer', e.clientX, e.clientY);
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.setData('text/plain', layer.id);
    });

    item.addEventListener('dragend', () => {
      this.draggedId = null;
      this.draggedType = 'layer';
      this.draggedVisualIndex = -1;
      item.classList.remove('dragging');
      this.hideDragHint();
      this.clearDropIndicators(list);
    });

    this.attachDropHandlers(item, visualIndex, entries, list);

    item.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, summary, details, input')) return;
      e.stopPropagation();
      this.startInlineRename(name, layer.name, (newName) => {
        this.runLayerMutation('Rename layer', () => {
          this.layerManager.renameLayer(layer.id, newName);
        });
      });
    });

    item.addEventListener('click', () => {
      this.selectLayer(layer.id);
    });

    return item;
  }

  private createRowMenu(actions: MenuAction[]): HTMLElement {
    const details = document.createElement('details');
    details.className = 'layer-row-menu';

    const summary = document.createElement('summary');
    summary.className = 'layer-row-menu-trigger';
    summary.textContent = '...';
    summary.title = 'More actions';
    details.appendChild(summary);

    const menu = document.createElement('div');
    menu.className = 'layer-row-menu-list';

    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = 'layer-row-menu-item';
      if (action.danger) btn.classList.add('danger');
      btn.textContent = action.label;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        details.open = false;
        action.onClick();
      });
      menu.appendChild(btn);
    }

    details.addEventListener('toggle', () => {
      if (!details.open) return;
      this.closeAllRowMenus();
      details.open = true;
    });

    details.addEventListener('click', (e) => e.stopPropagation());
    details.appendChild(menu);
    return details;
  }

  private attachDropHandlers(
    item: HTMLElement,
    visualIndex: number,
    entries: VisualEntry[],
    list: HTMLElement,
  ): void {
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.draggedId) return;
      e.dataTransfer!.dropEffect = 'move';

      list.querySelectorAll('.layer-item, .layer-group-header, .layer-root-drop-zone').forEach((el) => {
        if (el !== item) el.classList.remove('drop-above', 'drop-below', 'drop-inside', 'drop-root-target');
      });

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const dropAbove = e.clientY < midY;
      const targetEntry = entries[visualIndex];
      this.updateDragHint(this.getDropActionLabel(targetEntry, dropAbove), e.clientX, e.clientY);

      item.classList.remove('drop-above', 'drop-below', 'drop-inside');
      if (dropAbove) {
        item.classList.add('drop-above');
        return;
      }

      if (targetEntry.type === 'groupHeader' && this.draggedType === 'layer') {
        const draggedLayer = this.draggedId ? this.layerManager.getLayerById(this.draggedId) : undefined;
        const draggingFromSameGroup = !!draggedLayer && draggedLayer.groupId === targetEntry.group.id;
        if (draggingFromSameGroup) {
          item.classList.add('drop-below');
        } else {
          item.classList.add('drop-inside');
        }
      } else {
        item.classList.add('drop-below');
      }
    });

    item.addEventListener('dragleave', (e) => {
      if (!item.contains(e.relatedTarget as Node)) {
        item.classList.remove('drop-above', 'drop-below', 'drop-inside');
      }
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      this.clearDropIndicators(list);
      if (!this.draggedId) return;

      const draggedId = this.draggedId;
      const draggedType = this.draggedType;

      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const dropAbove = e.clientY < midY;

      this.runLayerMutation(
        draggedType === 'group' ? 'Reorder group' : 'Move layer',
        () => {
          if (draggedType === 'group') {
            this.handleGroupDrop(draggedId, visualIndex, dropAbove, entries);
          } else {
            this.handleLayerDrop(draggedId, visualIndex, dropAbove, entries);
          }
        },
      );

      this.draggedId = null;
      this.draggedType = 'layer';
      this.draggedVisualIndex = -1;
      this.hideDragHint();
    });
  }

  private attachRootDropHandlers(rootZone: HTMLElement, list: HTMLElement): void {
    rootZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.draggedId) return;
      e.dataTransfer!.dropEffect = 'move';
      this.clearDropIndicators(list);
      rootZone.classList.add('drop-root-target');
      if (this.draggedType === 'layer') {
        const draggedLayer = this.layerManager.getLayerById(this.draggedId);
        this.updateDragHint(draggedLayer?.groupId ? 'Remove from Group' : 'Move to Root', e.clientX, e.clientY);
      } else {
        this.updateDragHint('Move group to root', e.clientX, e.clientY);
      }
    });

    rootZone.addEventListener('dragleave', (e) => {
      if (!rootZone.contains(e.relatedTarget as Node)) {
        rootZone.classList.remove('drop-root-target');
        this.hideDragHint();
      }
    });

    rootZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.clearDropIndicators(list);
      if (!this.draggedId) return;

      const draggedId = this.draggedId;
      const draggedType = this.draggedType;

      this.runLayerMutation(
        draggedType === 'group' ? 'Move group to root' : 'Move layer to root',
        () => {
          if (draggedType === 'layer') {
            this.layerManager.setLayerGroup(draggedId, null);
            this.layerManager.moveLayerToIndex(draggedId, 0);
            this.activeGroupId = null;
          } else {
            const memberIds = this.layerManager.getLayersInGroup(draggedId).map((l) => l.id);
            if (memberIds.length > 0) {
              this.layerManager.moveLayersToIndex(memberIds, 0);
            } else {
              this.layerManager.setGroupOrder(draggedId, 0);
            }
          }
        },
      );

      this.draggedId = null;
      this.draggedType = 'layer';
      this.draggedVisualIndex = -1;
      this.hideDragHint();
    });
  }

  private handleLayerDrop(
    draggedLayerId: string,
    targetVisualIndex: number,
    dropAbove: boolean,
    entries: VisualEntry[],
  ): void {
    const targetEntry = entries[targetVisualIndex];

    if (targetEntry.type === 'layer' && targetEntry.layer.id === draggedLayerId) {
      const draggedLayer = this.layerManager.getLayerById(draggedLayerId);
      if (draggedLayer?.groupId && !dropAbove) {
        // Dropping on the lower half of itself means "remove from group in place".
        this.layerManager.setLayerGroup(draggedLayerId, null);
      }
      return;
    }

    if (targetEntry.type === 'groupHeader') {
      const group = targetEntry.group;
      const draggedLayer = this.layerManager.getLayerById(draggedLayerId);
      if (!draggedLayer) return;

      if (dropAbove) {
        this.layerManager.setLayerGroup(draggedLayerId, null);
        const members = this.layerManager.getLayersInGroup(group.id);
        if (members.length > 0) {
          const allLayers = [...this.layerManager.getLayers()];
          let maxIdx = -1;
          for (const member of members) {
            const idx = allLayers.findIndex((l) => l.id === member.id);
            if (idx > maxIdx) maxIdx = idx;
          }
          const dragIdx = allLayers.findIndex((l) => l.id === draggedLayerId);
          const newIdx = dragIdx > maxIdx ? maxIdx + 1 : maxIdx;
          this.layerManager.moveLayerToIndex(draggedLayerId, Math.min(newIdx, allLayers.length - 1));
        }
      } else {
        if (draggedLayer.groupId === group.id) {
          // Dropping on the lower half of the same group header means "ungroup in place".
          this.layerManager.setLayerGroup(draggedLayerId, null);
          return;
        }
        const members = this.layerManager.getLayersInGroup(group.id);
        this.layerManager.setLayerGroup(draggedLayerId, group.id);
        if (members.length > 0) {
          const allLayers = [...this.layerManager.getLayers()];
          let maxIdx = -1;
          for (const member of members) {
            const idx = allLayers.findIndex((l) => l.id === member.id);
            if (idx > maxIdx) maxIdx = idx;
          }
          this.layerManager.moveLayerToIndex(draggedLayerId, maxIdx);
        }
      }
      return;
    }

    const targetLayer = targetEntry.layer;
    const targetGroupId = targetLayer.groupId;

    this.layerManager.setLayerGroup(draggedLayerId, targetGroupId);

    const layers = [...this.layerManager.getLayers()];
    const dragIdx = layers.findIndex((l) => l.id === draggedLayerId);
    if (dragIdx === -1) return;

    const currentTargetIdx = layers.findIndex((l) => l.id === targetLayer.id);

    let newArrayIndex: number;
    if (dropAbove) {
      newArrayIndex = dragIdx > currentTargetIdx ? currentTargetIdx + 1 : currentTargetIdx;
    } else {
      newArrayIndex = dragIdx > currentTargetIdx ? currentTargetIdx : currentTargetIdx - 1;
    }

    newArrayIndex = Math.max(0, Math.min(layers.length - 1, newArrayIndex));
    this.layerManager.moveLayerToIndex(draggedLayerId, newArrayIndex);
  }

  private handleGroupDrop(
    draggedGroupId: string,
    targetVisualIndex: number,
    dropAbove: boolean,
    entries: VisualEntry[],
  ): void {
    const targetEntry = entries[targetVisualIndex];
    if (targetEntry.type === 'groupHeader' && targetEntry.group.id === draggedGroupId) return;

    let targetArrayIndex: number;
    if (targetEntry.type === 'layer') {
      targetArrayIndex = targetEntry.arrayIndex;
    } else {
      const members = this.layerManager.getLayersInGroup(targetEntry.group.id);
      if (members.length > 0) {
        const allLayers = [...this.layerManager.getLayers()];
        let maxIdx = 0;
        for (const member of members) {
          const idx = allLayers.findIndex((l) => l.id === member.id);
          if (idx > maxIdx) maxIdx = idx;
        }
        targetArrayIndex = maxIdx;
      } else {
        targetArrayIndex = Math.max(0, this.layerManager.getLayers().length - 1);
      }
    }

    const memberIds = this.layerManager.getLayersInGroup(draggedGroupId).map((l) => l.id);
    if (memberIds.length === 0) {
      if (targetEntry.type === 'groupHeader') {
        this.layerManager.moveGroupRelativeToGroup(draggedGroupId, targetEntry.group.id, dropAbove);
        return;
      }
      const adjustedIndex = dropAbove ? targetArrayIndex + 1 : targetArrayIndex;
      this.layerManager.setGroupOrder(draggedGroupId, adjustedIndex);
      return;
    }

    const adjustedIndex = dropAbove ? targetArrayIndex + 1 : targetArrayIndex;
    this.layerManager.moveLayersToIndex(memberIds, adjustedIndex);
  }

  private clearDropIndicators(list: HTMLElement): void {
    list.querySelectorAll('.layer-item, .layer-group-header, .layer-root-drop-zone').forEach((el) => {
      el.classList.remove('drop-above', 'drop-below', 'drop-inside', 'drop-root-target');
    });
  }
}
