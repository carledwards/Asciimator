import { LayerCell, LayerData, Cell } from '../core/types';

let nextId = 1;

export class Layer {
  readonly id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  cells: LayerCell[][];
  private width: number;
  private height: number;

  constructor(width: number, height: number, name?: string) {
    this.id = `layer_${nextId++}`;
    this.name = name ?? 'Layer';
    this.visible = true;
    this.locked = false;
    this.width = width;
    this.height = height;
    this.cells = this.createEmptyGrid(width, height);
  }

  private createEmptyGrid(w: number, h: number): LayerCell[][] {
    return Array.from({ length: h }, () => Array.from({ length: w }, () => null));
  }

  getCell(x: number, y: number): LayerCell {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.cells[y][x];
  }

  setCell(x: number, y: number, cell: LayerCell): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (this.locked) return;
    this.cells[y][x] = cell;
  }

  /** Bypasses lock check - used for undo/redo operations */
  forceSetCell(x: number, y: number, cell: LayerCell): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.cells[y][x] = cell;
  }

  clear(): void {
    if (this.locked) return;
    this.cells = this.createEmptyGrid(this.width, this.height);
  }

  resize(newWidth: number, newHeight: number): void {
    const newCells = this.createEmptyGrid(newWidth, newHeight);
    const copyW = Math.min(this.width, newWidth);
    const copyH = Math.min(this.height, newHeight);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        newCells[y][x] = this.cells[y][x];
      }
    }
    this.cells = newCells;
    this.width = newWidth;
    this.height = newHeight;
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }

  toData(): LayerData {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      locked: this.locked,
      cells: this.cells.map(row => row.map(cell => cell ? { ...cell, attributes: { ...cell.attributes } } : null)),
    };
  }

  static fromData(data: LayerData): Layer {
    const layer = new Layer(data.cells[0]?.length ?? 80, data.cells.length);
    (layer as { id: string }).id = data.id;
    layer.name = data.name;
    layer.visible = data.visible;
    layer.locked = data.locked;
    layer.cells = data.cells.map(row => row.map(cell => cell ? { ...cell, attributes: { ...cell.attributes } } : null));
    return layer;
  }

  clone(): Layer {
    const layer = new Layer(this.width, this.height, this.name);
    layer.visible = this.visible;
    layer.locked = this.locked;
    layer.cells = this.cells.map(row => row.map(cell => cell ? { ...cell, attributes: { ...cell.attributes } } : null));
    return layer;
  }
}
