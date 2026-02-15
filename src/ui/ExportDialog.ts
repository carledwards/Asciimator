import { Document } from '../document/Document';
import { CompositeBuffer } from '../rendering/CompositeBuffer';
import { exportPlainText, ExportRegion } from '../io/ExportPlainText';
import { exportTypeScript } from '../io/ExportTypeScript';
import { exportJSON } from '../io/ExportJSON';

type ExportFormat = 'text' | 'typescript' | 'json';

export class ExportDialog {
  private overlay: HTMLElement | null = null;

  constructor(
    private doc: Document,
    private compositeBuffer: CompositeBuffer,
  ) {}

  show(initialRegion?: ExportRegion): void {
    if (this.overlay) return;

    const region: ExportRegion = initialRegion ?? {
      x1: 0, y1: 0,
      x2: this.doc.width - 1,
      y2: this.doc.height - 1,
    };

    let format: ExportFormat = 'text';
    let includeColors = false;

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
    for (const [value, text] of [['text', 'Text'], ['typescript', 'TypeScript'], ['json', 'JSON']] as const) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      formatSelect.appendChild(opt);
    }
    formatRow.appendChild(formatSelect);
    dialog.appendChild(formatRow);

    // Color checkbox row
    const colorRow = document.createElement('div');
    colorRow.className = 'export-dialog-row export-dialog-checkbox';
    const colorCheckbox = document.createElement('input');
    colorCheckbox.type = 'checkbox';
    colorCheckbox.id = 'export-include-colors';
    colorCheckbox.checked = false;
    const colorLabel = document.createElement('label');
    colorLabel.htmlFor = 'export-include-colors';
    colorLabel.textContent = 'Include ANSI color codes';
    colorRow.appendChild(colorCheckbox);
    colorRow.appendChild(colorLabel);
    dialog.appendChild(colorRow);

    // Helper to update checkbox state per format
    const updateColorCheckbox = () => {
      format = formatSelect.value as ExportFormat;
      if (format === 'json') {
        colorCheckbox.checked = true;
        colorCheckbox.disabled = true;
        colorLabel.textContent = 'Include color information (always included for JSON)';
      } else if (format === 'typescript') {
        colorCheckbox.disabled = false;
        colorLabel.textContent = 'Include color arrays';
      } else {
        colorCheckbox.disabled = false;
        colorLabel.textContent = 'Include ANSI color codes';
      }
      includeColors = colorCheckbox.checked;
    };

    // Region inputs
    const regionRow = document.createElement('div');
    regionRow.className = 'export-dialog-row export-dialog-region';

    const inputs: Record<string, HTMLInputElement> = {};
    for (const [key, label, val] of [
      ['x1', 'Start Col', region.x1],
      ['y1', 'Start Row', region.y1],
      ['x2', 'End Col', region.x2],
      ['y2', 'End Row', region.y2],
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
    dialog.appendChild(regionRow);

    // Preview textarea
    const preview = document.createElement('textarea');
    preview.className = 'export-dialog-preview';
    preview.readOnly = true;
    preview.spellcheck = false;
    dialog.appendChild(preview);

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

    // Update preview
    const updatePreview = () => {
      const r: ExportRegion = {
        x1: parseInt(inputs.x1.value) || 0,
        y1: parseInt(inputs.y1.value) || 0,
        x2: parseInt(inputs.x2.value) || 0,
        y2: parseInt(inputs.y2.value) || 0,
      };
      format = formatSelect.value as ExportFormat;
      includeColors = colorCheckbox.checked;

      if (format === 'text') {
        preview.value = exportPlainText(this.compositeBuffer, r, includeColors);
      } else if (format === 'typescript') {
        preview.value = exportTypeScript(this.compositeBuffer, 'asciiArt', r, includeColors);
      } else {
        preview.value = exportJSON(this.doc, r);
      }
    };

    updateColorCheckbox();
    updatePreview();

    // Wire events
    formatSelect.addEventListener('change', () => {
      updateColorCheckbox();
      updatePreview();
    });
    colorCheckbox.addEventListener('change', updatePreview);
    for (const inp of Object.values(inputs)) {
      inp.addEventListener('input', updatePreview);
    }

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(preview.value).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 1500);
      });
    });

    downloadBtn.addEventListener('click', () => {
      const extensions: Record<ExportFormat, string> = {
        text: 'txt', typescript: 'ts', json: 'json',
      };
      const filename = `ascii-art.${extensions[format]}`;
      const blob = new Blob([preview.value], { type: 'text/plain' });
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
  }

  private close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
