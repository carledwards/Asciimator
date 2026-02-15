import { DOS_PALETTE, DOS_COLOR_NAMES, TRANSPARENT_COLOR } from '../core/DosColors';

export interface ReplaceColorsResult {
  attribute: 'fg' | 'bg';
  fromColor: number;
  toColor: number;
}

export class ReplaceColorsDialog {
  private overlay: HTMLElement | null = null;

  show(onReplace: (result: ReplaceColorsResult) => void): void {
    if (this.overlay) return;

    let attribute: 'fg' | 'bg' = 'bg';
    let fromColor = -2; // unset sentinel
    let toColor = -2;

    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'export-dialog-overlay';

    // Dialog
    const dialog = document.createElement('div');
    dialog.className = 'export-dialog';
    dialog.style.width = '380px';

    // Title
    const title = document.createElement('h3');
    title.className = 'export-dialog-title';
    title.textContent = 'Replace Colors';
    dialog.appendChild(title);

    // Attribute toggle (FG / BG radio buttons)
    const attrRow = document.createElement('div');
    attrRow.className = 'export-dialog-row';
    const attrLabel = document.createElement('span');
    attrLabel.className = 'export-dialog-label';
    attrLabel.textContent = 'Attribute:';
    attrRow.appendChild(attrLabel);

    for (const val of ['bg', 'fg'] as const) {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '4px';
      label.style.cursor = 'pointer';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'replace-attr';
      radio.value = val;
      radio.checked = val === attribute;
      radio.style.accentColor = 'var(--accent)';
      radio.addEventListener('change', () => { attribute = val as 'fg' | 'bg'; });
      label.appendChild(radio);
      label.appendChild(document.createTextNode(val === 'fg' ? 'Foreground' : 'Background'));
      attrRow.appendChild(label);
    }
    dialog.appendChild(attrRow);

    // Helper to build a palette grid
    const buildPalette = (labelText: string, onPick: (color: number) => void): { container: HTMLElement; getSelected: () => HTMLElement | null } => {
      const section = document.createElement('div');
      section.style.marginBottom = '12px';

      const lbl = document.createElement('div');
      lbl.className = 'color-label';
      lbl.textContent = labelText;
      section.appendChild(lbl);

      const grid = document.createElement('div');
      grid.className = 'replace-colors-palette';

      let selectedEl: HTMLElement | null = null;

      for (let i = 0; i < 16; i++) {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = DOS_PALETTE[i];
        swatch.title = DOS_COLOR_NAMES[i];
        swatch.addEventListener('click', () => {
          if (selectedEl) selectedEl.classList.remove('replace-colors-selected');
          swatch.classList.add('replace-colors-selected');
          selectedEl = swatch;
          onPick(i);
        });
        grid.appendChild(swatch);
      }

      // Transparent swatch
      const transSwatch = document.createElement('div');
      transSwatch.className = 'color-swatch color-swatch-transparent';
      transSwatch.title = 'Transparent';
      transSwatch.addEventListener('click', () => {
        if (selectedEl) selectedEl.classList.remove('replace-colors-selected');
        transSwatch.classList.add('replace-colors-selected');
        selectedEl = transSwatch;
        onPick(TRANSPARENT_COLOR);
      });
      grid.appendChild(transSwatch);

      section.appendChild(grid);
      return { container: section, getSelected: () => selectedEl };
    };

    const fromPalette = buildPalette('From color', (c) => { fromColor = c; });
    dialog.appendChild(fromPalette.container);

    const toPalette = buildPalette('To color', (c) => { toColor = c; });
    dialog.appendChild(toPalette.container);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'export-dialog-buttons';

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'export-dialog-btn export-dialog-btn-primary';
    replaceBtn.textContent = 'Replace';
    replaceBtn.addEventListener('click', () => {
      if (fromColor === -2 || toColor === -2) {
        alert('Please select both a "From" and "To" color.');
        return;
      }
      this.close();
      onReplace({ attribute, fromColor, toColor });
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'export-dialog-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.close());

    btnRow.appendChild(replaceBtn);
    btnRow.appendChild(cancelBtn);
    dialog.appendChild(btnRow);

    this.overlay.appendChild(dialog);
    document.body.appendChild(this.overlay);

    // Close on overlay click
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
