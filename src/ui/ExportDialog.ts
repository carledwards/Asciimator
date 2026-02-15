import { Document } from '../document/Document';
import { CompositeBuffer } from '../rendering/CompositeBuffer';
import { exportPlainText, ExportRegion } from '../io/ExportPlainText';
import { exportTypeScript } from '../io/ExportTypeScript';
import { exportJSON } from '../io/ExportJSON';
import { exportSVG } from '../io/ExportSVG';
import { exportPNG } from '../io/ExportPNG';
import { exportPython } from '../io/ExportPython';
import { getPaletteColor } from '../core/DosColors';

type ExportFormat = 'ansi' | 'typescript' | 'python' | 'json' | 'svg' | 'png';
type DragHandle = 'none' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move';

const SOURCE_CHAR_W = 8;
const SOURCE_CHAR_H = 12;
const DRAG_HIT_RADIUS = 8;

export class ExportDialog {
  private overlay: HTMLElement | null = null;
  private previewObjectUrl: string | null = null;

  constructor(
    private doc: Document,
    private compositeBuffer: CompositeBuffer,
  ) {}

  show(initialRegion?: ExportRegion): void {
    if (this.overlay) return;

    let currentRegion: ExportRegion = initialRegion ?? {
      x1: 0, y1: 0,
      x2: this.doc.width - 1,
      y2: this.doc.height - 1,
    };

    let format: ExportFormat = 'svg';
    let includeOption = true;
    let previewTextValue = '';
    let previewBlob: Blob | null = null;
    let updateSeq = 0;
    let dragHandle: DragHandle = 'none';
    let dragStartCell: { x: number; y: number } | null = null;
    let dragStartRegion: ExportRegion | null = null;

    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'export-dialog-overlay';

    // Dialog
    const dialog = document.createElement('div');
    dialog.className = 'export-dialog';

    // Title
    const title = document.createElement('h3');
    title.className = 'export-dialog-title';
    title.textContent = 'Export Preview';
    dialog.appendChild(title);

    // Format selector
    const formatRow = document.createElement('div');
    formatRow.className = 'export-dialog-row';
    const formatLabel = document.createElement('label');
    formatLabel.textContent = 'Format:';
    formatLabel.className = 'export-dialog-label';
    formatRow.appendChild(formatLabel);

    const formatSelect = document.createElement('select');
    formatSelect.className = 'export-dialog-select';
    for (const [value, text] of [
      ['svg', 'SVG'],
      ['png', 'PNG'],
      ['ansi', 'ANSI'],
      ['typescript', 'TypeScript'],
      ['python', 'Python'],
      ['json', 'JSON'],
    ] as const) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      formatSelect.appendChild(opt);
    }
    formatSelect.value = 'svg';
    formatRow.appendChild(formatSelect);

    // Color checkbox row
    const colorRow = document.createElement('div');
    colorRow.className = 'export-dialog-row export-dialog-checkbox';
    const colorCheckbox = document.createElement('input');
    colorCheckbox.type = 'checkbox';
    colorCheckbox.id = 'export-include-colors';
    colorCheckbox.checked = true;
    const colorLabel = document.createElement('label');
    colorLabel.htmlFor = 'export-include-colors';
    colorLabel.textContent = 'Include cell backgrounds';
    colorRow.appendChild(colorCheckbox);
    colorRow.appendChild(colorLabel);

    // Region inputs
    const regionRow = document.createElement('div');
    regionRow.className = 'export-dialog-row export-dialog-region';

    const inputs: Record<string, HTMLInputElement> = {};
    for (const [key, label, val] of [
      ['x1', 'Start Col', currentRegion.x1],
      ['y1', 'Start Row', currentRegion.y1],
      ['x2', 'End Col', currentRegion.x2],
      ['y2', 'End Row', currentRegion.y2],
    ] as const) {
      const group = document.createElement('div');
      group.className = 'export-dialog-input-group';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      lbl.className = 'export-dialog-input-label';
      group.appendChild(lbl);
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'export-dialog-input';
      inp.value = String(val);
      inp.min = '0';
      inp.max = key.startsWith('x') ? String(this.doc.width - 1) : String(this.doc.height - 1);
      inputs[key] = inp;
      group.appendChild(inp);
      regionRow.appendChild(group);
    }

    // Preview (text or image)
    const previewText = document.createElement('textarea');
    previewText.className = 'export-dialog-preview';
    previewText.readOnly = true;
    previewText.spellcheck = false;

    const previewImageWrap = document.createElement('div');
    previewImageWrap.className = 'export-dialog-preview export-dialog-preview-image-wrap';
    const previewImage = document.createElement('img');
    previewImage.className = 'export-dialog-preview-image';
    previewImage.alt = 'Export preview';
    previewImageWrap.appendChild(previewImage);

    // Main content layout: controls + source (left) and output (right)
    const content = document.createElement('div');
    content.className = 'export-dialog-content';
    const controlsPanel = document.createElement('div');
    controlsPanel.className = 'export-dialog-controls';
    const previewPanel = document.createElement('div');
    previewPanel.className = 'export-dialog-preview-pane';
    const sourcePanel = document.createElement('div');
    sourcePanel.className = 'export-dialog-output-panel export-dialog-source-panel';
    const outputPanel = document.createElement('div');
    outputPanel.className = 'export-dialog-output-panel';

    const sourceTitle = document.createElement('div');
    sourceTitle.className = 'export-dialog-panel-title';
    sourceTitle.textContent = 'Source';
    const outputTitle = document.createElement('div');
    outputTitle.className = 'export-dialog-panel-title';
    outputTitle.textContent = 'Output';

    const sourceWrap = document.createElement('div');
    sourceWrap.className = 'export-dialog-preview export-dialog-preview-image-wrap';
    sourceWrap.style.display = 'flex';
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.className = 'export-dialog-preview-image export-dialog-source-canvas';
    sourceWrap.appendChild(sourceCanvas);

    controlsPanel.appendChild(formatRow);
    controlsPanel.appendChild(colorRow);
    controlsPanel.appendChild(regionRow);
    sourcePanel.appendChild(sourceTitle);
    sourcePanel.appendChild(sourceWrap);
    controlsPanel.appendChild(sourcePanel);
    outputPanel.appendChild(outputTitle);
    outputPanel.appendChild(previewText);
    outputPanel.appendChild(previewImageWrap);
    previewPanel.appendChild(outputPanel);

    content.appendChild(controlsPanel);
    content.appendChild(previewPanel);
    dialog.appendChild(content);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'export-dialog-buttons';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'export-dialog-btn export-dialog-btn-primary';
    copyBtn.textContent = 'Copy to Clipboard';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'export-dialog-btn export-dialog-btn-primary';
    downloadBtn.textContent = 'Download';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'export-dialog-btn';
    cancelBtn.textContent = 'Cancel';

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(downloadBtn);
    btnRow.appendChild(cancelBtn);
    dialog.appendChild(btnRow);

    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);

    const normalizeRegion = (raw: ExportRegion): ExportRegion => ({
      x1: Math.max(0, Math.min(Math.min(raw.x1, raw.x2), this.doc.width - 1)),
      y1: Math.max(0, Math.min(Math.min(raw.y1, raw.y2), this.doc.height - 1)),
      x2: Math.max(0, Math.min(Math.max(raw.x1, raw.x2), this.doc.width - 1)),
      y2: Math.max(0, Math.min(Math.max(raw.y1, raw.y2), this.doc.height - 1)),
    });

    const setInputsFromRegion = (r: ExportRegion) => {
      inputs.x1.value = String(r.x1);
      inputs.y1.value = String(r.y1);
      inputs.x2.value = String(r.x2);
      inputs.y2.value = String(r.y2);
    };

    const getRegionFromInputs = (): ExportRegion => {
      const rawX1 = parseInt(inputs.x1.value, 10);
      const rawY1 = parseInt(inputs.y1.value, 10);
      const rawX2 = parseInt(inputs.x2.value, 10);
      const rawY2 = parseInt(inputs.y2.value, 10);
      return normalizeRegion({
        x1: Number.isFinite(rawX1) ? rawX1 : currentRegion.x1,
        y1: Number.isFinite(rawY1) ? rawY1 : currentRegion.y1,
        x2: Number.isFinite(rawX2) ? rawX2 : currentRegion.x2,
        y2: Number.isFinite(rawY2) ? rawY2 : currentRegion.y2,
      });
    };

    const getCanvasCoords = (evt: PointerEvent) => {
      const rect = sourceCanvas.getBoundingClientRect();
      const sx = sourceCanvas.width / Math.max(1, rect.width);
      const sy = sourceCanvas.height / Math.max(1, rect.height);
      const x = (evt.clientX - rect.left) * sx;
      const y = (evt.clientY - rect.top) * sy;
      return { x, y };
    };

    const getCellCoords = (evt: PointerEvent) => {
      const { x, y } = getCanvasCoords(evt);
      return {
        x: Math.max(0, Math.min(this.doc.width - 1, Math.floor(x / SOURCE_CHAR_W))),
        y: Math.max(0, Math.min(this.doc.height - 1, Math.floor(y / SOURCE_CHAR_H))),
      };
    };

    const getHandleAtPointer = (evt: PointerEvent): DragHandle => {
      const { x, y } = getCanvasCoords(evt);
      const rx = currentRegion.x1 * SOURCE_CHAR_W;
      const ry = currentRegion.y1 * SOURCE_CHAR_H;
      const rw = (currentRegion.x2 - currentRegion.x1 + 1) * SOURCE_CHAR_W;
      const rh = (currentRegion.y2 - currentRegion.y1 + 1) * SOURCE_CHAR_H;
      const left = rx;
      const right = rx + rw;
      const top = ry;
      const bottom = ry + rh;

      const nearLeft = Math.abs(x - left) <= DRAG_HIT_RADIUS;
      const nearRight = Math.abs(x - right) <= DRAG_HIT_RADIUS;
      const nearTop = Math.abs(y - top) <= DRAG_HIT_RADIUS;
      const nearBottom = Math.abs(y - bottom) <= DRAG_HIT_RADIUS;
      const withinX = x >= left && x <= right;
      const withinY = y >= top && y <= bottom;

      if (nearLeft && nearTop) return 'nw';
      if (nearRight && nearTop) return 'ne';
      if (nearLeft && nearBottom) return 'sw';
      if (nearRight && nearBottom) return 'se';
      if (nearTop && withinX) return 'n';
      if (nearBottom && withinX) return 's';
      if (nearLeft && withinY) return 'w';
      if (nearRight && withinY) return 'e';
      if (withinX && withinY) return 'move';
      return 'none';
    };

    const cursorForHandle = (handle: DragHandle): string => {
      if (handle === 'n' || handle === 's') return 'ns-resize';
      if (handle === 'e' || handle === 'w') return 'ew-resize';
      if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
      if (handle === 'nw' || handle === 'se') return 'nwse-resize';
      if (handle === 'move') return 'move';
      return 'default';
    };

    const setPreviewMode = (imageMode: boolean) => {
      previewText.style.display = imageMode ? 'none' : 'block';
      previewImageWrap.style.display = imageMode ? 'flex' : 'none';
      copyBtn.disabled = format === 'png';
      copyBtn.style.opacity = copyBtn.disabled ? '0.6' : '1';
      copyBtn.style.cursor = copyBtn.disabled ? 'default' : 'pointer';
    };

    const renderSourcePreview = (r: ExportRegion) => {
      const cells = this.compositeBuffer.flatten();
      const transparencyMap = this.compositeBuffer.getTransparencyMap();
      sourceCanvas.width = this.doc.width * SOURCE_CHAR_W;
      sourceCanvas.height = this.doc.height * SOURCE_CHAR_H;
      const ctx = sourceCanvas.getContext('2d');
      if (!ctx) return;

      // Keep transparent cells transparent so checkerboard shows through.
      ctx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      ctx.font = `bold ${Math.floor(SOURCE_CHAR_H * 0.8)}px "Courier New", "Consolas", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const textY = Math.round(SOURCE_CHAR_H * 0.06);

      for (let y = 0; y < this.doc.height; y++) {
        const row = cells[y];
        const tRow = transparencyMap[y];
        for (let x = 0; x < this.doc.width; x++) {
          const cell = row[x];
          const px = x * SOURCE_CHAR_W;
          const py = y * SOURCE_CHAR_H;
          if (tRow && !tRow[x]) {
            ctx.fillStyle = getPaletteColor(cell.attributes.background);
            ctx.fillRect(px, py, SOURCE_CHAR_W, SOURCE_CHAR_H);
          }
          const ch = cell.char || ' ';
          if (ch !== ' ') {
            ctx.fillStyle = getPaletteColor(cell.attributes.foreground);
            ctx.fillText(ch, px, py + textY);
          }
        }
      }

      const rx = r.x1 * SOURCE_CHAR_W;
      const ry = r.y1 * SOURCE_CHAR_H;
      const rw = (r.x2 - r.x1 + 1) * SOURCE_CHAR_W;
      const rh = (r.y2 - r.y1 + 1) * SOURCE_CHAR_H;

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, sourceCanvas.width, ry);
      ctx.fillRect(0, ry + rh, sourceCanvas.width, sourceCanvas.height - ry - rh);
      ctx.fillRect(0, ry, rx, rh);
      ctx.fillRect(rx + rw, ry, sourceCanvas.width - rx - rw, rh);

      ctx.strokeStyle = 'rgba(0,220,255,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(rx + 1, ry + 1, Math.max(1, rw - 2), Math.max(1, rh - 2));
      ctx.setLineDash([]);

      const handleSize = 6;
      const hx = [rx, rx + rw / 2, rx + rw];
      const hy = [ry, ry + rh / 2, ry + rh];
      ctx.fillStyle = 'rgba(0,220,255,1)';
      for (const x of hx) {
        for (const y of hy) {
          if (x === rx + rw / 2 && y === ry + rh / 2) continue;
          ctx.fillRect(Math.round(x - handleSize / 2), Math.round(y - handleSize / 2), handleSize, handleSize);
        }
      }
    };

    // Update preview
    const updatePreview = async () => {
      const seq = ++updateSeq;
      currentRegion = getRegionFromInputs();
      setInputsFromRegion(currentRegion);
      format = formatSelect.value as ExportFormat;
      includeOption = colorCheckbox.checked;
      previewBlob = null;
      this.clearPreviewObjectUrl();
      renderSourcePreview(currentRegion);

      if (format === 'ansi') {
        previewTextValue = exportPlainText(this.compositeBuffer, currentRegion, includeOption);
        previewText.value = previewTextValue;
        setPreviewMode(false);
      } else if (format === 'typescript') {
        previewTextValue = exportTypeScript(this.compositeBuffer, 'asciiArt', currentRegion, includeOption);
        previewText.value = previewTextValue;
        setPreviewMode(false);
      } else if (format === 'python') {
        previewTextValue = exportPython(this.compositeBuffer, 'ascii_art', currentRegion, includeOption);
        previewText.value = previewTextValue;
        setPreviewMode(false);
      } else if (format === 'svg') {
        previewTextValue = exportSVG(this.compositeBuffer, currentRegion, includeOption);
        previewBlob = new Blob([previewTextValue], { type: 'image/svg+xml' });
        this.previewObjectUrl = URL.createObjectURL(previewBlob);
        if (seq !== updateSeq) return;
        previewImage.src = this.previewObjectUrl;
        setPreviewMode(true);
      } else if (format === 'png') {
        previewBlob = await exportPNG(this.compositeBuffer, currentRegion, includeOption);
        if (seq !== updateSeq) return;
        this.previewObjectUrl = URL.createObjectURL(previewBlob);
        previewImage.src = this.previewObjectUrl;
        previewTextValue = '';
        setPreviewMode(true);
      } else {
        previewTextValue = exportJSON(this.doc, currentRegion);
        previewText.value = previewTextValue;
        setPreviewMode(false);
      }
    };

    const applyDrag = (evt: PointerEvent) => {
      if (dragHandle === 'none' || !dragStartRegion || !dragStartCell) return;
      const cell = getCellCoords(evt);
      const dx = cell.x - dragStartCell.x;
      const dy = cell.y - dragStartCell.y;

      let next: ExportRegion = { ...dragStartRegion };
      if (dragHandle === 'move') {
        const maxDx = this.doc.width - 1 - dragStartRegion.x2;
        const minDx = -dragStartRegion.x1;
        const maxDy = this.doc.height - 1 - dragStartRegion.y2;
        const minDy = -dragStartRegion.y1;
        const clampedDx = Math.max(minDx, Math.min(maxDx, dx));
        const clampedDy = Math.max(minDy, Math.min(maxDy, dy));
        next = {
          x1: dragStartRegion.x1 + clampedDx,
          y1: dragStartRegion.y1 + clampedDy,
          x2: dragStartRegion.x2 + clampedDx,
          y2: dragStartRegion.y2 + clampedDy,
        };
      } else {
        if (dragHandle.includes('w')) next.x1 = Math.min(dragStartRegion.x2, dragStartRegion.x1 + dx);
        if (dragHandle.includes('e')) next.x2 = Math.max(dragStartRegion.x1, dragStartRegion.x2 + dx);
        if (dragHandle.includes('n')) next.y1 = Math.min(dragStartRegion.y2, dragStartRegion.y1 + dy);
        if (dragHandle.includes('s')) next.y2 = Math.max(dragStartRegion.y1, dragStartRegion.y2 + dy);
        if (dragHandle === 'n' || dragHandle === 's') {
          next.x1 = dragStartRegion.x1;
          next.x2 = dragStartRegion.x2;
        }
        if (dragHandle === 'e' || dragHandle === 'w') {
          next.y1 = dragStartRegion.y1;
          next.y2 = dragStartRegion.y2;
        }
      }

      currentRegion = normalizeRegion(next);
      setInputsFromRegion(currentRegion);
      void updatePreview();
    };

    // Helper to update checkbox state per format
    const updateColorCheckbox = (applyDefaults: boolean) => {
      format = formatSelect.value as ExportFormat;
      if (format === 'json') {
        colorCheckbox.checked = true;
        colorCheckbox.disabled = true;
        colorLabel.textContent = 'Include color information (always included for JSON)';
      } else if (format === 'svg' || format === 'png') {
        if (applyDefaults) colorCheckbox.checked = true;
        colorCheckbox.disabled = false;
        colorLabel.textContent = 'Include cell backgrounds';
      } else if (format === 'typescript' || format === 'python') {
        if (applyDefaults) colorCheckbox.checked = false;
        colorCheckbox.disabled = false;
        colorLabel.textContent = 'Include color arrays';
      } else {
        if (applyDefaults) colorCheckbox.checked = false;
        colorCheckbox.disabled = false;
        colorLabel.textContent = 'Include ANSI color codes';
      }
      includeOption = colorCheckbox.checked;
    };

    // Wire events
    formatSelect.addEventListener('change', () => {
      updateColorCheckbox(true);
      void updatePreview();
    });
    colorCheckbox.addEventListener('change', () => { void updatePreview(); });
    for (const inp of Object.values(inputs)) {
      inp.addEventListener('input', () => { void updatePreview(); });
    }

    sourceCanvas.addEventListener('pointerdown', (evt) => {
      const handle = getHandleAtPointer(evt);
      if (handle === 'none') return;
      dragHandle = handle;
      dragStartCell = getCellCoords(evt);
      dragStartRegion = { ...currentRegion };
      sourceCanvas.setPointerCapture(evt.pointerId);
      evt.preventDefault();
    });

    sourceCanvas.addEventListener('pointermove', (evt) => {
      if (dragHandle !== 'none') {
        applyDrag(evt);
        return;
      }
      sourceCanvas.style.cursor = cursorForHandle(getHandleAtPointer(evt));
    });

    const onPointerEnd = (evt: PointerEvent) => {
      if (dragHandle === 'none') return;
      applyDrag(evt);
      dragHandle = 'none';
      dragStartCell = null;
      dragStartRegion = null;
      sourceCanvas.style.cursor = cursorForHandle(getHandleAtPointer(evt));
      if (sourceCanvas.hasPointerCapture(evt.pointerId)) {
        sourceCanvas.releasePointerCapture(evt.pointerId);
      }
    };

    sourceCanvas.addEventListener('pointerup', onPointerEnd);
    sourceCanvas.addEventListener('pointercancel', onPointerEnd);

    copyBtn.addEventListener('click', () => {
      if (copyBtn.disabled) return;
      navigator.clipboard.writeText(previewTextValue).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 1500);
      });
    });

    downloadBtn.addEventListener('click', () => {
      const extensions: Record<ExportFormat, string> = {
        ansi: 'txt', typescript: 'ts', python: 'py', json: 'json', svg: 'svg', png: 'png',
      };
      const filename = `ascii-art.${extensions[format]}`;
      const blob = previewBlob ?? new Blob([previewTextValue], {
        type: format === 'svg' ? 'image/svg+xml' : 'text/plain',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });

    cancelBtn.addEventListener('click', () => this.close());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Escape to close
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);

    updateColorCheckbox(true);
    setInputsFromRegion(currentRegion);

    // First render
    void updatePreview();
  }

  private close(): void {
    this.clearPreviewObjectUrl();
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private clearPreviewObjectUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }
}
