import { Layer } from './Layer';
import { LayerGroup } from './LayerGroup';
import { LayerData, LayerGroupData } from '../core/types';
import { eventBus, Events } from '../core/EventBus';

export interface LayerManagerState {
  layers: LayerData[];
  groups: LayerGroupData[];
  activeLayerId: string;
}

export class LayerManager {
  private layers: Layer[] = [];
  private groups: LayerGroup[] = [];
  private activeLayerId: string = '';

  constructor(private width: number, private height: number) {}

  private syncGroupOrdersFromMembers(): void {
    for (const group of this.groups) {
      const highest = this.getHighestIndexInGroup(group.id);
      if (highest >= 0) group.order = highest;
    }
  }

  init(): void {
    const bg = this.addLayer('Background');
    this.activeLayerId = bg.id;
  }

  addLayer(name?: string, options?: { groupId?: string | null; index?: number }): Layer {
    const layer = new Layer(this.width, this.height, name ?? `Layer ${this.layers.length + 1}`);
    if (options?.groupId && this.getGroupById(options.groupId)) {
      layer.groupId = options.groupId;
    }
    if (typeof options?.index === 'number') {
      const insertIndex = Math.max(0, Math.min(this.layers.length, options.index));
      this.layers.splice(insertIndex, 0, layer);
    } else {
      this.layers.push(layer);
    }
    this.syncGroupOrdersFromMembers();
    this.activeLayerId = layer.id;
    eventBus.emit(Events.LAYER_CHANGED, null);
    eventBus.emit(Events.ACTIVE_LAYER_CHANGED, layer.id);
    return layer;
  }

  removeLayer(id: string): boolean {
    if (this.layers.length <= 1) return false;
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1) return false;
    this.layers.splice(idx, 1);
    this.syncGroupOrdersFromMembers();
    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers[Math.min(idx, this.layers.length - 1)].id;
      eventBus.emit(Events.ACTIVE_LAYER_CHANGED, this.activeLayerId);
    }
    eventBus.emit(Events.LAYER_CHANGED, null);
    return true;
  }

  getActiveLayer(): Layer | undefined {
    return this.layers.find(l => l.id === this.activeLayerId);
  }

  getActiveLayerId(): string {
    return this.activeLayerId;
  }

  setActiveLayer(id: string): void {
    if (this.layers.find(l => l.id === id)) {
      this.activeLayerId = id;
      eventBus.emit(Events.ACTIVE_LAYER_CHANGED, id);
    }
  }

  getLayers(): readonly Layer[] {
    return this.layers;
  }

  getLayerById(id: string): Layer | undefined {
    return this.layers.find(l => l.id === id);
  }

  moveLayer(id: string, direction: 'up' | 'down'): void {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= this.layers.length) return;
    [this.layers[idx], this.layers[newIdx]] = [this.layers[newIdx], this.layers[idx]];
    this.syncGroupOrdersFromMembers();
    eventBus.emit(Events.LAYER_CHANGED, null);
  }

  moveLayerToIndex(id: string, newIndex: number): void {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    if (newIndex < 0 || newIndex >= this.layers.length) return;
    if (idx === newIndex) return;
    const [layer] = this.layers.splice(idx, 1);
    this.layers.splice(newIndex, 0, layer);
    this.syncGroupOrdersFromMembers();
    eventBus.emit(Events.LAYER_CHANGED, null);
  }

  /** Move a contiguous block of layers to a new starting index */
  moveLayersToIndex(ids: string[], newStartIndex: number): void {
    // Remove all layers in the set, preserving their relative order
    const moving: Layer[] = [];
    const idSet = new Set(ids);
    this.layers = this.layers.filter(l => {
      if (idSet.has(l.id)) { moving.push(l); return false; }
      return true;
    });
    if (moving.length === 0) return;
    const clamped = Math.max(0, Math.min(this.layers.length, newStartIndex));
    this.layers.splice(clamped, 0, ...moving);
    this.syncGroupOrdersFromMembers();
    eventBus.emit(Events.LAYER_CHANGED, null);
  }

  renameLayer(id: string, name: string): void {
    const layer = this.getLayerById(id);
    if (layer) {
      layer.name = name;
      eventBus.emit(Events.LAYER_CHANGED, null);
    }
  }

  toggleVisibility(id: string): void {
    const layer = this.getLayerById(id);
    if (layer) {
      layer.visible = !layer.visible;
      eventBus.emit(Events.LAYER_CHANGED, null);
      eventBus.emit(Events.RENDER_REQUEST, null);
    }
  }

  toggleLock(id: string): void {
    const layer = this.getLayerById(id);
    if (layer) {
      layer.locked = !layer.locked;
      eventBus.emit(Events.LAYER_CHANGED, null);
    }
  }

  duplicateLayer(id: string): Layer | undefined {
    const source = this.getLayerById(id);
    if (!source) return undefined;
    const copy = source.clone();
    copy.name = `${source.name} copy`;
    const idx = this.layers.findIndex(l => l.id === id);
    this.layers.splice(idx + 1, 0, copy);
    this.syncGroupOrdersFromMembers();
    this.activeLayerId = copy.id;
    eventBus.emit(Events.LAYER_CHANGED, null);
    eventBus.emit(Events.ACTIVE_LAYER_CHANGED, copy.id);
    return copy;
  }

  loadLayers(layersData: LayerData[], activeLayerId?: string, groupsData?: LayerGroupData[]): void {
    this.layers = layersData.map(d => Layer.fromData(d));
    // Reconstruct groups
    this.groups = (groupsData ?? []).map(g => LayerGroup.fromData(g));
    // Clean up orphaned groupId references
    const validGroupIds = new Set(this.groups.map(g => g.id));
    for (const layer of this.layers) {
      if (layer.groupId && !validGroupIds.has(layer.groupId)) {
        layer.groupId = null;
      }
    }
    this.syncGroupOrdersFromMembers();
    if (activeLayerId && this.layers.find(l => l.id === activeLayerId)) {
      this.activeLayerId = activeLayerId;
    } else if (this.layers.length > 0) {
      this.activeLayerId = this.layers[0].id;
    }
    eventBus.emit(Events.LAYER_CHANGED, null);
    eventBus.emit(Events.ACTIVE_LAYER_CHANGED, this.activeLayerId);
  }

  mergeDown(id: string): boolean {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx <= 0) return false;
    const upper = this.layers[idx];
    const lower = this.layers[idx - 1];
    if (this.isLayerEffectivelyLocked(lower)) return false;
    for (let y = 0; y < upper.getHeight(); y++) {
      for (let x = 0; x < upper.getWidth(); x++) {
        const cell = upper.getCell(x, y);
        if (cell) lower.setCell(x, y, cell);
      }
    }
    this.layers.splice(idx, 1);
    this.syncGroupOrdersFromMembers();
    this.activeLayerId = lower.id;
    eventBus.emit(Events.LAYER_CHANGED, null);
    eventBus.emit(Events.ACTIVE_LAYER_CHANGED, lower.id);
    return true;
  }

  resize(newWidth: number, newHeight: number): void {
    this.width = newWidth;
    this.height = newHeight;
    for (const layer of this.layers) {
      layer.resize(newWidth, newHeight);
    }
    eventBus.emit(Events.LAYER_CHANGED, null);
  }

  // === Group CRUD ===

  addGroup(name?: string, options?: { kind?: 'layer' | 'animation'; order?: number }): LayerGroup {
    const highestOrder = this.groups.reduce((max, g) => Math.max(max, g.order), -1);
    const group = new LayerGroup(name, {
      kind: options?.kind ?? 'layer',
      order: options?.order ?? Math.max(this.layers.length, highestOrder + 1),
    });
    this.groups.push(group);
    eventBus.emit(Events.LAYER_CHANGED, null);
    return group;
  }

  removeGroup(groupId: string): void {
    const idx = this.groups.findIndex(g => g.id === groupId);
    if (idx === -1) return;
    // Ungroup all member layers (don't delete them)
    for (const layer of this.layers) {
      if (layer.groupId === groupId) layer.groupId = null;
    }
    this.groups.splice(idx, 1);
    this.syncGroupOrdersFromMembers();
    eventBus.emit(Events.LAYER_CHANGED, null);
  }

  getGroups(): readonly LayerGroup[] {
    return this.groups;
  }

  getGroupById(id: string): LayerGroup | undefined {
    return this.groups.find(g => g.id === id);
  }

  renameGroup(groupId: string, name: string): void {
    const group = this.getGroupById(groupId);
    if (group) {
      group.name = name;
      eventBus.emit(Events.LAYER_CHANGED, null);
    }
  }

  toggleGroupVisibility(groupId: string): void {
    const group = this.getGroupById(groupId);
    if (group) {
      group.visible = !group.visible;
      eventBus.emit(Events.LAYER_CHANGED, null);
      eventBus.emit(Events.RENDER_REQUEST, null);
    }
  }

  toggleGroupLock(groupId: string): void {
    const group = this.getGroupById(groupId);
    if (group) {
      group.locked = !group.locked;
      eventBus.emit(Events.LAYER_CHANGED, null);
    }
  }

  toggleGroupCollapsed(groupId: string): void {
    const group = this.getGroupById(groupId);
    if (group) {
      group.collapsed = !group.collapsed;
      eventBus.emit(Events.LAYER_CHANGED, null);
    }
  }

  // === Group membership ===

  setLayerGroup(layerId: string, groupId: string | null): void {
    const layer = this.getLayerById(layerId);
    if (layer) {
      const previousGroupId = layer.groupId;
      const previousLayerIndex = this.layers.findIndex(l => l.id === layerId);
      layer.groupId = groupId;
      if (previousGroupId && previousGroupId !== groupId) {
        const previousGroup = this.getGroupById(previousGroupId);
        if (previousGroup && this.getLayersInGroup(previousGroupId).length === 0 && previousLayerIndex >= 0) {
          previousGroup.order = previousLayerIndex;
        }
      }
      this.syncGroupOrdersFromMembers();
      eventBus.emit(Events.LAYER_CHANGED, null);
    }
  }

  getLayersInGroup(groupId: string): Layer[] {
    return this.layers.filter(l => l.groupId === groupId);
  }

  getHighestIndexInGroup(groupId: string): number {
    let highest = -1;
    for (let i = 0; i < this.layers.length; i++) {
      if (this.layers[i].groupId === groupId) highest = i;
    }
    return highest;
  }

  getGroupAnchorIndex(groupId: string): number {
    const group = this.getGroupById(groupId);
    if (!group) return -1;
    const highest = this.getHighestIndexInGroup(groupId);
    if (highest >= 0) return highest;
    return group.order;
  }

  setGroupOrder(groupId: string, order: number): void {
    const group = this.getGroupById(groupId);
    if (!group) return;
    group.order = Math.max(0, order);
    eventBus.emit(Events.LAYER_CHANGED, null);
  }

  moveGroupRelativeToGroup(draggedGroupId: string, targetGroupId: string, dropAbove: boolean): void {
    if (draggedGroupId === targetGroupId) return;
    const sorted = [...this.groups].sort((a, b) => b.order - a.order);
    const draggedIdx = sorted.findIndex(g => g.id === draggedGroupId);
    const targetIdx = sorted.findIndex(g => g.id === targetGroupId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const [dragged] = sorted.splice(draggedIdx, 1);
    const adjustedTargetIdx = draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
    const insertIdx = dropAbove ? adjustedTargetIdx : adjustedTargetIdx + 1;
    sorted.splice(Math.max(0, Math.min(sorted.length, insertIdx)), 0, dragged);
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].order = sorted.length - 1 - i;
    }
    eventBus.emit(Events.LAYER_CHANGED, null);
  }

  getStateSnapshot(): LayerManagerState {
    return {
      layers: this.layers.map(layer => layer.toData()),
      groups: this.groups.map(group => group.toData()),
      activeLayerId: this.activeLayerId,
    };
  }

  restoreState(state: LayerManagerState): void {
    this.loadLayers(state.layers, state.activeLayerId, state.groups);
  }

  // === Effective state queries ===

  isLayerEffectivelyVisible(layer: Layer): boolean {
    if (!layer.visible) return false;
    if (layer.groupId) {
      const group = this.getGroupById(layer.groupId);
      if (group && !group.visible) return false;
    }
    return true;
  }

  isLayerEffectivelyLocked(layer: Layer): boolean {
    if (layer.locked) return true;
    if (layer.groupId) {
      const group = this.getGroupById(layer.groupId);
      if (group && group.locked) return true;
    }
    return false;
  }
}
