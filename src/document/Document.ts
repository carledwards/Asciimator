import { DocumentData, LayerCell, Cell, CellAttributes } from '../core/types';
import { LayerManager } from './LayerManager';
import { eventBus, Events } from '../core/EventBus';

export class Document {
  width: number;
  height: number;
  readonly layerManager: LayerManager;

  constructor(width: number = 80, height: number = 25) {
    this.width = width;
    this.height = height;
    this.layerManager = new LayerManager(width, height);
    this.layerManager.init();
  }

  getCell(layerId: string, x: number, y: number): LayerCell {
    return this.layerManager.getLayerById(layerId)?.getCell(x, y) ?? null;
  }

  setCell(layerId: string, x: number, y: number, cell: LayerCell): void {
    this.layerManager.getLayerById(layerId)?.setCell(x, y, cell);
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }

  setCellOnActive(x: number, y: number, cell: LayerCell): void {
    const layer = this.layerManager.getActiveLayer();
    if (layer && !layer.locked) {
      layer.setCell(x, y, cell);
      eventBus.emit(Events.DOCUMENT_CHANGED, null);
      eventBus.emit(Events.RENDER_REQUEST, null);
    }
  }

  getActiveCell(x: number, y: number): LayerCell {
    return this.layerManager.getActiveLayer()?.getCell(x, y) ?? null;
  }

  toData(): DocumentData {
    return {
      width: this.width,
      height: this.height,
      layers: this.layerManager.getLayers().map(l => l.toData()),
      activeLayerId: this.layerManager.getActiveLayerId(),
    };
  }

  resize(newWidth: number, newHeight: number): void {
    const width = Math.max(1, Math.floor(newWidth));
    const height = Math.max(1, Math.floor(newHeight));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.layerManager.resize(width, height);
    eventBus.emit(Events.DOCUMENT_RESIZED, { width, height });
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
