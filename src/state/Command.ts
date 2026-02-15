import { Cell, LayerCell } from '../core/types';
import { Document } from '../document/Document';
import { eventBus, Events } from '../core/EventBus';

export interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

export interface CellChange {
  x: number;
  y: number;
  oldCell: LayerCell;
  newCell: LayerCell;
}

export class CellChangeCommand implements Command {
  description: string;

  constructor(
    private doc: Document,
    private layerId: string,
    private changes: CellChange[],
    description?: string,
  ) {
    this.description = description ?? `Draw ${changes.length} cell(s)`;
  }

  execute(): void {
    const layer = this.doc.layerManager.getLayerById(this.layerId);
    if (!layer) return;
    for (const change of this.changes) {
      layer.forceSetCell(change.x, change.y, change.newCell);
    }
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }

  undo(): void {
    const layer = this.doc.layerManager.getLayerById(this.layerId);
    if (!layer) return;
    for (const change of this.changes) {
      layer.forceSetCell(change.x, change.y, change.oldCell);
    }
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
