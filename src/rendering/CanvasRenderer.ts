import { Cell, Position, CellAttributes } from '../core/types';
import { DOS_PALETTE, getPaletteColor, isTransparent } from '../core/DosColors';
import { eventBus, Events } from '../core/EventBus';
import { CompositeBuffer } from './CompositeBuffer';

// Box-drawing characters rendered as canvas line segments for pixel-perfect connections.
// Each entry is an array of [x1, y1, x2, y2] in normalized [0,1] cell coordinates.
type LineSeg = [number, number, number, number];

const G = 0.15; // gap offset for double-line pairs
const CM = 0.5 - G; // center-minus
const CP = 0.5 + G; // center-plus

const BOX_CHAR_SEGMENTS: Record<string, LineSeg[]> = {
  // Single-line
  '─': [[0, .5, 1, .5]],
  '│': [[.5, 0, .5, 1]],
  '┌': [[.5, .5, 1, .5], [.5, .5, .5, 1]],
  '┐': [[0, .5, .5, .5], [.5, .5, .5, 1]],
  '└': [[.5, 0, .5, .5], [.5, .5, 1, .5]],
  '┘': [[.5, 0, .5, .5], [0, .5, .5, .5]],
  '├': [[.5, 0, .5, 1], [.5, .5, 1, .5]],
  '┤': [[.5, 0, .5, 1], [0, .5, .5, .5]],
  '┬': [[0, .5, 1, .5], [.5, .5, .5, 1]],
  '┴': [[0, .5, 1, .5], [.5, 0, .5, .5]],
  '┼': [[0, .5, 1, .5], [.5, 0, .5, 1]],

  // Double-line
  '═': [[0, CM, 1, CM], [0, CP, 1, CP]],
  '║': [[CM, 0, CM, 1], [CP, 0, CP, 1]],
  '╔': [[CM, CM, 1, CM], [CM, CM, CM, 1], [CP, CP, 1, CP], [CP, CP, CP, 1]],
  '╗': [[0, CM, CP, CM], [CP, CM, CP, 1], [0, CP, CM, CP], [CM, CP, CM, 1]],
  '╚': [[CM, 0, CM, CP], [CM, CP, 1, CP], [CP, 0, CP, CM], [CP, CM, 1, CM]],
  '╝': [[CP, 0, CP, CP], [0, CP, CP, CP], [CM, 0, CM, CM], [0, CM, CM, CM]],
  '╠': [[CM, 0, CM, 1], [CP, 0, CP, CM], [CP, CP, CP, 1], [CM, CM, 1, CM], [CM, CP, 1, CP]],
  '╣': [[CP, 0, CP, 1], [CM, 0, CM, CM], [CM, CP, CM, 1], [0, CM, CP, CM], [0, CP, CP, CP]],
  '╦': [[0, CM, 1, CM], [0, CP, CM, CP], [CP, CP, 1, CP], [CM, CM, CM, 1], [CP, CM, CP, 1]],
  '╩': [[0, CP, 1, CP], [0, CM, CM, CM], [CP, CM, 1, CM], [CM, 0, CM, CP], [CP, 0, CP, CP]],
  '╬': [
    [CM, 0, CM, CM], [CM, CP, CM, 1], [CP, 0, CP, CM], [CP, CP, CP, 1],
    [0, CM, CM, CM], [CP, CM, 1, CM], [0, CP, CM, CP], [CP, CP, 1, CP],
  ],
};

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private charWidth: number = 0;
  private charHeight: number = 0;
  private animationFrameId: number | null = null;
  private isDirty = true;
  private showGrid = false;
  private zoom = 1;

  // Cursor overlay
  private cursorPosition: Position | null = null;
  private cursorAttributes: CellAttributes | null = null;
  private cursorChar: string = '';

  // Selection overlay
  private selectionStart: Position | null = null;
  private selectionEnd: Position | null = null;

  // Tool preview overlay
  private previewCells: Map<string, Cell> = new Map();

  // Move guide lines
  private moveGuides = false;

  constructor(
    private container: HTMLElement,
    private compositeBuffer: CompositeBuffer,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ascii-canvas';
    this.canvas.style.cursor = 'none';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.calculateDimensions();

    eventBus.on(Events.RENDER_REQUEST, () => this.markDirty());
    eventBus.on(Events.ZOOM_CHANGED, (z: unknown) => {
      this.zoom = z as number;
      this.calculateDimensions();
      this.markDirty();
    });
    eventBus.on(Events.GRID_TOGGLED, (show: unknown) => {
      this.showGrid = show as boolean;
      this.markDirty();
    });
  }

  private calculateDimensions(): void {
    const CHAR_ASPECT_RATIO = 1.6;
    const baseCharWidth = 10 * this.zoom;
    this.charWidth = Math.floor(baseCharWidth);
    this.charHeight = Math.floor(this.charWidth * CHAR_ASPECT_RATIO);
    this.canvas.width = this.charWidth * this.compositeBuffer.getWidth();
    this.canvas.height = this.charHeight * this.compositeBuffer.getHeight();
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  refreshDimensions(): void {
    this.calculateDimensions();
    this.markDirty();
  }

  getCharDimensions(): { width: number; height: number } {
    return { width: this.charWidth, height: this.charHeight };
  }

  screenToGrid(clientX: number, clientY: number): Position {
    const rect = this.canvas.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const x = Math.floor(relX / this.charWidth);
    const y = Math.floor(relY / this.charHeight);
    return {
      x: Math.max(0, Math.min(x, this.compositeBuffer.getWidth() - 1)),
      y: Math.max(0, Math.min(y, this.compositeBuffer.getHeight() - 1)),
    };
  }

  setCursor(position: Position | null, char: string, attributes: CellAttributes | null): void {
    this.cursorPosition = position;
    this.cursorChar = char;
    this.cursorAttributes = attributes;
    this.markDirty();
  }

  setSelection(start: Position | null, end: Position | null): void {
    this.selectionStart = start;
    this.selectionEnd = end;
    this.markDirty();
  }

  setPreviewCells(cells: Map<string, Cell>): void {
    this.previewCells = cells;
    this.markDirty();
  }

  clearPreview(): void {
    this.previewCells.clear();
    this.markDirty();
  }

  setMoveGuides(show: boolean): void {
    this.moveGuides = show;
    this.markDirty();
  }

  markDirty(): void {
    this.isDirty = true;
  }

  startRenderLoop(): void {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      if (this.isDirty) {
        this.renderFrame();
        this.isDirty = false;
      }
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private renderFrame(): void {
    const buffer = this.compositeBuffer.flatten();
    const transparencyMap = this.compositeBuffer.getTransparencyMap();
    const w = this.compositeBuffer.getWidth();
    const h = this.compositeBuffer.getHeight();

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const fontSize = Math.floor(this.charHeight * 0.75);
    this.ctx.font = `bold ${fontSize}px "Courier New", "Consolas", monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const key = `${x},${y}`;
        const previewCell = this.previewCells.get(key);
        const cell = previewCell ?? buffer[y][x];
        const bgTransparent = previewCell
          ? isTransparent(previewCell.attributes.background)
          : transparencyMap[y][x];
        this.drawCell(x, y, cell, bgTransparent);
      }
    }

    // Draw grid
    if (this.showGrid) {
      this.drawGrid(w, h);
    }

    // Draw selection
    if (this.selectionStart && this.selectionEnd) {
      this.drawSelection();
      if (this.moveGuides) {
        this.drawMoveGuides();
      }
    }

    // Draw cursor overlay
    if (this.cursorPosition && this.cursorAttributes) {
      this.drawCursor();
    }
  }

  private drawCheckerboard(px: number, py: number): void {
    const halfW = this.charWidth / 2;
    const halfH = this.charHeight / 2;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        this.ctx.fillStyle = (row + col) % 2 === 0 ? '#cccccc' : '#999999';
        this.ctx.fillRect(px + col * halfW, py + row * halfH, halfW, halfH);
      }
    }
  }

  private drawCell(x: number, y: number, cell: Cell, bgTransparent: boolean): void {
    const px = x * this.charWidth;
    const py = y * this.charHeight;

    // Background
    if (bgTransparent) {
      this.drawCheckerboard(px, py);
    } else {
      this.ctx.fillStyle = getPaletteColor(cell.attributes.background);
      this.ctx.fillRect(px, py, this.charWidth, this.charHeight);
    }

    // Character
    if (cell.char && cell.char !== ' ' && cell.char.charCodeAt(0) > 31) {
      const segments = BOX_CHAR_SEGMENTS[cell.char];
      if (segments) {
        this.drawBoxSegments(px, py, segments, cell.attributes);
      } else {
        this.ctx.fillStyle = isTransparent(cell.attributes.foreground)
          ? '#888888'
          : getPaletteColor(cell.attributes.foreground);
        this.ctx.fillText(cell.char, px + this.charWidth / 2, py + this.charHeight / 2);
      }
    }
  }

  private drawBoxSegments(px: number, py: number, segments: LineSeg[], attrs: CellAttributes): void {
    this.ctx.strokeStyle = isTransparent(attrs.foreground)
      ? '#888888'
      : getPaletteColor(attrs.foreground);
    this.ctx.lineWidth = Math.max(1.5, this.charWidth * 0.15);
    this.ctx.lineCap = 'butt';
    for (const [x1, y1, x2, y2] of segments) {
      this.ctx.beginPath();
      this.ctx.moveTo(px + x1 * this.charWidth, py + y1 * this.charHeight);
      this.ctx.lineTo(px + x2 * this.charWidth, py + y2 * this.charHeight);
      this.ctx.stroke();
    }
  }

  private drawCursor(): void {
    if (!this.cursorPosition || !this.cursorAttributes) return;
    const px = this.cursorPosition.x * this.charWidth;
    const py = this.cursorPosition.y * this.charHeight;

    // Draw inverted background
    this.ctx.fillStyle = getPaletteColor(this.cursorAttributes.background);
    this.ctx.fillRect(px, py, this.charWidth, this.charHeight);

    // Draw inverted character
    if (this.cursorChar && this.cursorChar !== ' ') {
      this.ctx.fillStyle = getPaletteColor(this.cursorAttributes.foreground);
      this.ctx.fillText(this.cursorChar, px + this.charWidth / 2, py + this.charHeight / 2);
    }
  }

  private drawSelection(): void {
    if (!this.selectionStart || !this.selectionEnd) return;
    const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);

    const px = x1 * this.charWidth;
    const py = y1 * this.charHeight;
    const pw = (x2 - x1 + 1) * this.charWidth;
    const ph = (y2 - y1 + 1) * this.charHeight;

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(px, py, pw, ph);
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.fillRect(px, py, pw, ph);
  }

  private drawMoveGuides(): void {
    if (!this.selectionStart || !this.selectionEnd) return;

    const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);

    const px = x1 * this.charWidth;
    const py = y1 * this.charHeight;
    const pw = (x2 - x1 + 1) * this.charWidth;
    const ph = (y2 - y1 + 1) * this.charHeight;
    const midPx = px + pw / 2;
    const midPy = py + ph / 2;

    const docWidth = this.compositeBuffer.getWidth();
    const docHeight = this.compositeBuffer.getHeight();
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    const guideColor = 'rgba(0, 200, 255, 0.5)';
    this.ctx.strokeStyle = guideColor;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);

    // Top: vertical from canvas top to selection top
    if (y1 > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(midPx, 0);
      this.ctx.lineTo(midPx, py);
      this.ctx.stroke();
    }

    // Bottom: vertical from selection bottom to canvas bottom
    if (y2 < docHeight - 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(midPx, py + ph);
      this.ctx.lineTo(midPx, canvasH);
      this.ctx.stroke();
    }

    // Left: horizontal from canvas left to selection left
    if (x1 > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, midPy);
      this.ctx.lineTo(px, midPy);
      this.ctx.stroke();
    }

    // Right: horizontal from selection right to canvas right
    if (x2 < docWidth - 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(px + pw, midPy);
      this.ctx.lineTo(canvasW, midPy);
      this.ctx.stroke();
    }

    this.ctx.setLineDash([]);

    // Draw labels
    const topDist = y1;
    const bottomDist = docHeight - y2 - 1;
    const leftDist = x1;
    const rightDist = docWidth - x2 - 1;

    const labelFontSize = Math.max(9, Math.floor(this.charHeight * 0.45));
    this.ctx.font = `bold ${labelFontSize}px "Courier New", "Consolas", monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    if (y1 > 0) {
      this.drawGuideLabel(String(topDist), midPx, py / 2);
    }
    if (y2 < docHeight - 1) {
      this.drawGuideLabel(String(bottomDist), midPx, py + ph + (canvasH - py - ph) / 2);
    }
    if (x1 > 0) {
      this.drawGuideLabel(String(leftDist), px / 2, midPy);
    }
    if (x2 < docWidth - 1) {
      this.drawGuideLabel(String(rightDist), px + pw + (canvasW - px - pw) / 2, midPy);
    }
  }

  private drawGuideLabel(text: string, cx: number, cy: number): void {
    const metrics = this.ctx.measureText(text);
    const padX = 4;
    const padY = 2;
    const tw = metrics.width + padX * 2;
    const th = this.ctx.measureText('0').actualBoundingBoxAscent * 2 + padY * 2;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const radius = 3;
    const rx = cx - tw / 2;
    const ry = cy - th / 2;
    this.ctx.beginPath();
    this.ctx.roundRect(rx, ry, tw, th, radius);
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(0, 200, 255, 0.9)';
    this.ctx.fillText(text, cx, cy);
  }

  private drawGrid(w: number, h: number): void {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(x * this.charWidth, 0);
      this.ctx.lineTo(x * this.charWidth, h * this.charHeight);
      this.ctx.stroke();
    }
    for (let y = 0; y <= h; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y * this.charHeight);
      this.ctx.lineTo(w * this.charWidth, y * this.charHeight);
      this.ctx.stroke();
    }
  }

  getZoom(): number { return this.zoom; }
  getShowGrid(): boolean { return this.showGrid; }
}
