import { Layer } from './Layer';
import { LayerData } from '../core/types';
import { eventBus, Events } from '../core/EventBus';

export class LayerManager {
  private layers: Layer[] = [];
  private activeLayerId: string = '';

  constructor(private width: number, private height: number) {}

  init(): void {
    const bg = this.addLayer('Background');
    this.activeLayerId = bg.id;
  }

  addLayer(name?: string): Layer {
    const layer = new Layer(this.width, this.height, name ?? `Layer ${this.layers.length + 1}`);
    this.layers.push(layer);
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
    eventBus.emit(Events.LAYER_CHANGED, null);
  }

  moveLayerToIndex(id: string, newIndex: number): void {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx === -1) return;
    if (newIndex < 0 || newIndex >= this.layers.length) return;
    if (idx === newIndex) return;
    const [layer] = this.layers.splice(idx, 1);
    this.layers.splice(newIndex, 0, layer);
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
    this.activeLayerId = copy.id;
    eventBus.emit(Events.LAYER_CHANGED, null);
    eventBus.emit(Events.ACTIVE_LAYER_CHANGED, copy.id);
    return copy;
  }

  loadLayers(layersData: LayerData[], activeLayerId?: string): void {
    this.layers = layersData.map(d => Layer.fromData(d));
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
    if (lower.locked) return false;
    for (let y = 0; y < upper.getHeight(); y++) {
      for (let x = 0; x < upper.getWidth(); x++) {
        const cell = upper.getCell(x, y);
        if (cell) lower.setCell(x, y, cell);
      }
    }
    this.layers.splice(idx, 1);
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
}
