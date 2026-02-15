export interface CanvasSizeResult {
  width: number;
  height: number;
}

export class CanvasSizeDialog {
  private overlay: HTMLElement | null = null;

  show(
    currentWidth: number,
    currentHeight: number,
    onApply: (result: CanvasSizeResult) => void,
  ): void {
    if (this.overlay) return;

    let width = currentWidth;
    let height = currentHeight;

    this.overlay = document.createElement('div');
    this.overlay.className = 'export-dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'export-dialog';
    dialog.style.width = '360px';
    dialog.style.maxHeight = 'none';
    dialog.style.flex = '0 0 auto';

    const title = document.createElement('h3');
    title.className = 'export-dialog-title';
    title.textContent = 'Canvas Size';
    dialog.appendChild(title);

    const sizeRow = document.createElement('div');
    sizeRow.className = 'export-dialog-row export-dialog-region';

    const widthGroup = document.createElement('div');
    widthGroup.className = 'export-dialog-input-group';
    const widthLabel = document.createElement('label');
    widthLabel.className = 'export-dialog-input-label';
    widthLabel.textContent = 'Width (chars)';
    const widthInput = document.createElement('input');
    widthInput.className = 'export-dialog-input';
    widthInput.type = 'number';
    widthInput.min = '1';
    widthInput.max = '1000';
    widthInput.value = String(width);
    widthGroup.appendChild(widthLabel);
    widthGroup.appendChild(widthInput);

    const heightGroup = document.createElement('div');
    heightGroup.className = 'export-dialog-input-group';
    const heightLabel = document.createElement('label');
    heightLabel.className = 'export-dialog-input-label';
    heightLabel.textContent = 'Height (chars)';
    const heightInput = document.createElement('input');
    heightInput.className = 'export-dialog-input';
    heightInput.type = 'number';
    heightInput.min = '1';
    heightInput.max = '1000';
    heightInput.value = String(height);
    heightGroup.appendChild(heightLabel);
    heightGroup.appendChild(heightInput);

    sizeRow.appendChild(widthGroup);
    sizeRow.appendChild(heightGroup);
    dialog.appendChild(sizeRow);

    const presetsLabel = document.createElement('div');
    presetsLabel.className = 'export-dialog-input-label';
    presetsLabel.textContent = 'Presets';
    dialog.appendChild(presetsLabel);

    const presets = document.createElement('div');
    presets.className = 'canvas-size-presets';
    const presetValues: Array<{ label: string; width: number; height: number }> = [
      { label: '80 x 25', width: 80, height: 25 },
      { label: '100 x 30', width: 100, height: 30 },
      { label: '120 x 40', width: 120, height: 40 },
    ];

    for (const preset of presetValues) {
      const button = document.createElement('button');
      button.className = 'export-dialog-btn';
      button.type = 'button';
      button.textContent = preset.label;
      button.addEventListener('click', () => {
        width = preset.width;
        height = preset.height;
        widthInput.value = String(width);
        heightInput.value = String(height);
      });
      presets.appendChild(button);
    }
    dialog.appendChild(presets);

    const info = document.createElement('p');
    info.className = 'canvas-size-note';
    info.textContent = 'Shrinking crops content outside bounds. Expanding preserves existing content.';
    dialog.appendChild(info);

    const buttons = document.createElement('div');
    buttons.className = 'export-dialog-buttons';

    const applyButton = document.createElement('button');
    applyButton.className = 'export-dialog-btn export-dialog-btn-primary';
    applyButton.textContent = 'Apply';
    applyButton.addEventListener('click', () => {
      const newWidth = Math.floor(Number(widthInput.value));
      const newHeight = Math.floor(Number(heightInput.value));
      if (!Number.isFinite(newWidth) || !Number.isFinite(newHeight) || newWidth < 1 || newHeight < 1) {
        alert('Width and height must be whole numbers >= 1.');
        return;
      }
      this.close();
      onApply({ width: newWidth, height: newHeight });
    });

    const cancelButton = document.createElement('button');
    cancelButton.className = 'export-dialog-btn';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => this.close());

    buttons.appendChild(applyButton);
    buttons.appendChild(cancelButton);
    dialog.appendChild(buttons);

    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', onKey);
      }
    };
    document.addEventListener('keydown', onKey);

    widthInput.focus();
    widthInput.select();
  }

  private close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}
