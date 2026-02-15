import { Cell, CellAttributes } from '../core/types';
import { LayerManager } from '../document/LayerManager';
import { isTransparent } from '../core/DosColors';

const DEFAULT_CELL: Cell = {
  char: ' ',
  attributes: { foreground: 7, background: 0 },
};

export class CompositeBuffer {
  private buffer: Cell[][] = [];
  private transparencyMap: boolean[][] = [];
  private width: number;
  private height: number;

  constructor(private layerManager: LayerManager, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buffer = this.createEmptyBuffer();
    this.transparencyMap = this.createTransparencyMap();
  }

  private createEmptyBuffer(): Cell[][] {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => ({ ...DEFAULT_CELL, attributes: { ...DEFAULT_CELL.attributes } }))
    );
  }

  private createTransparencyMap(): boolean[][] {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => true)
    );
  }

  flatten(): Cell[][] {
    this.buffer = this.createEmptyBuffer();
    this.transparencyMap = this.createTransparencyMap();
    const layers = this.layerManager.getLayers();

    // Bottom-to-top compositing with per-attribute merge
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const cell = layer.getCell(x, y);
          if (!cell) continue;

          const current = this.buffer[y][x];
          const newFg = isTransparent(cell.attributes.foreground)
            ? current.attributes.foreground
            : cell.attributes.foreground;
          const newBg = isTransparent(cell.attributes.background)
            ? current.attributes.background
            : cell.attributes.background;

          // Track whether any layer provided a non-transparent background
          if (!isTransparent(cell.attributes.background)) {
            this.transparencyMap[y][x] = false;
          }

          this.buffer[y][x] = {
            char: cell.char,
            attributes: { foreground: newFg, background: newBg },
          };
        }
      }
    }

    return this.buffer;
  }

  getTransparencyMap(): boolean[][] {
    return this.transparencyMap;
  }

  getCell(x: number, y: number): Cell {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return { ...DEFAULT_CELL, attributes: { ...DEFAULT_CELL.attributes } };
    }
    return this.buffer[y][x];
  }

  setLayerManager(layerManager: LayerManager, width: number, height: number): void {
    this.layerManager = layerManager;
    this.width = width;
    this.height = height;
    this.buffer = this.createEmptyBuffer();
    this.transparencyMap = this.createTransparencyMap();
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
}
