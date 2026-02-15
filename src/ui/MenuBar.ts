import { Document } from '../document/Document';
import { CompositeBuffer } from '../rendering/CompositeBuffer';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { UndoRedoManager } from '../state/UndoRedoManager';
import { Clipboard } from '../state/Clipboard';
import { exportJSON } from '../io/ExportJSON';
import { importPlainText } from '../io/ImportPlainText';
import { importTypeScript } from '../io/ImportTypeScript';
import { eventBus, Events } from '../core/EventBus';
import { SelectionTool } from '../tools/SelectionTool';
import { ExportDialog } from './ExportDialog';
import { ReplaceColorsDialog, ReplaceColorsResult } from './ReplaceColorsDialog';
import { CanvasSizeDialog } from './CanvasSizeDialog';
import { justifyHorizontal, justifyVertical } from '../tools/JustifyAction';
import { CellChangeCommand, CellChange } from '../state/Command';
import { TabManager } from '../state/TabManager';

interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  submenu?: MenuItem[];
}

interface MenuConfig {
  label: string;
  items: MenuItem[];
}

export class MenuBar {
  private element: HTMLElement;
  private openMenu: string | null = null;
  private exportDialog: ExportDialog;
  private replaceColorsDialog: ReplaceColorsDialog;
  private canvasSizeDialog: CanvasSizeDialog;

  constructor(
    private container: HTMLElement,
    private doc: Document,
    private compositeBuffer: CompositeBuffer,
    private canvasRenderer: CanvasRenderer,
    private undoManager: UndoRedoManager,
    private clipboard: Clipboard,
    private selectionTool: SelectionTool,
    private tabManager?: TabManager,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'menu-bar';
    container.appendChild(this.element);
    this.exportDialog = new ExportDialog(doc, compositeBuffer);
    this.replaceColorsDialog = new ReplaceColorsDialog();
    this.canvasSizeDialog = new CanvasSizeDialog();
    this.render();

    this.setupClickOutside();
  }

  setDocument(doc: Document): void {
    this.doc = doc;
    this.exportDialog = new ExportDialog(doc, this.compositeBuffer);
  }

  private setupClickOutside(): void {
    // Close menus on click outside
    document.addEventListener('click', (e) => {
      if (!this.element.contains(e.target as Node)) {
        this.openMenu = null;
        this.render();
      }
    });
  }

  private getMenus(): MenuConfig[] {
    return [
      {
        label: 'File',
        items: [
          { label: 'New', action: () => this.newDocument(), shortcut: 'Ctrl+N' },
          { label: 'Canvas Size...', action: () => this.openCanvasSizeDialog() },
          { label: 'New Tab', action: () => this.tabManager?.createTab() },
          { label: 'Close Tab', action: () => this.closeCurrentTab() },
          { label: 'Import Text...', action: () => this.importText() },
          { label: 'Import TypeScript...', action: () => this.importTS() },
          { label: 'Import JSON...', action: () => this.importJSON() },
          { label: 'Export...', action: () => this.openExportDialog() },
          { label: 'Save to Browser', action: () => this.saveToBrowser() },
          { label: 'Load from Browser', action: () => this.loadFromBrowser() },
        ],
      },
      {
        label: 'Edit',
        items: [
          { label: 'Undo', action: () => eventBus.emit(Events.UNDO, null), shortcut: 'Ctrl+Z' },
          { label: 'Redo', action: () => eventBus.emit(Events.REDO, null), shortcut: 'Ctrl+Shift+Z' },
          { label: 'Paste from Clipboard', action: () => this.clipboard.pasteFromSystem(0, 0) },
          { label: 'Replace Colors...', action: () => this.openReplaceColorsDialog() },
          {
            label: 'Justify',
            submenu: [
              { label: 'Left', action: () => this.justify('left') },
              { label: 'Center', action: () => this.justify('center') },
              { label: 'Right', action: () => this.justify('right') },
              { label: 'Top', action: () => this.justify('top') },
              { label: 'Bottom', action: () => this.justify('bottom') },
            ],
          },
        ],
      },
      {
        label: 'View',
        items: [
          { label: 'Toggle Grid', action: () => this.toggleGrid(), shortcut: 'G' },
          { label: 'Zoom In', action: () => this.setZoom(1), shortcut: '+' },
          { label: 'Zoom Out', action: () => this.setZoom(-1), shortcut: '-' },
          { label: 'Reset Zoom', action: () => eventBus.emit(Events.ZOOM_CHANGED, 1), shortcut: '0' },
        ],
      },
      {
        label: 'Help',
        items: [
          { label: 'Keyboard Shortcuts', action: () => this.showShortcuts() },
          { label: 'About', action: () => alert('Asciimator v1.0\nASCII Art Editor with DOS-style 16-color palette') },
        ],
      },
    ];
  }

  private render(): void {
    this.element.innerHTML = '';

    const title = document.createElement('span');
    title.className = 'menu-title';
    title.textContent = 'Asciimator';
    this.element.appendChild(title);

    for (const menu of this.getMenus()) {
      const menuEl = document.createElement('div');
      menuEl.className = 'menu-item';

      const label = document.createElement('button');
      label.className = `menu-label ${this.openMenu === menu.label ? 'open' : ''}`;
      label.textContent = menu.label;
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMenu = this.openMenu === menu.label ? null : menu.label;
        this.render();
      });
      menuEl.appendChild(label);

      if (this.openMenu === menu.label) {
        const dropdown = document.createElement('div');
        dropdown.className = 'menu-dropdown';
        this.renderMenuItems(dropdown, menu.items);
        menuEl.appendChild(dropdown);
      }

      this.element.appendChild(menuEl);
    }

    const spacer = document.createElement('div');
    spacer.className = 'menu-spacer';
    this.element.appendChild(spacer);

    const sourceLink = document.createElement('a');
    sourceLink.className = 'menu-source-link';
    sourceLink.href = 'https://github.com/carledwards/Asciimator';
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = 'GitHub';
    this.element.appendChild(sourceLink);
  }

  private renderMenuItems(container: HTMLElement, items: MenuItem[]): void {
    for (const item of items) {
      const entry = document.createElement('button');
      entry.className = 'menu-entry';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      entry.appendChild(labelSpan);

      if (item.submenu) {
        const arrow = document.createElement('span');
        arrow.className = 'menu-submenu-arrow';
        arrow.textContent = '\u25B6';
        entry.appendChild(arrow);

        const submenu = document.createElement('div');
        submenu.className = 'menu-dropdown menu-submenu';
        this.renderMenuItems(submenu, item.submenu);
        entry.style.position = 'relative';
        entry.appendChild(submenu);

        entry.addEventListener('mouseenter', () => {
          submenu.style.display = 'block';
        });
        entry.addEventListener('mouseleave', () => {
          submenu.style.display = 'none';
        });
      } else {
        if (item.shortcut) {
          const shortcut = document.createElement('span');
          shortcut.className = 'menu-shortcut';
          shortcut.textContent = item.shortcut;
          entry.appendChild(shortcut);
        }
        entry.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openMenu = null;
          this.render();
          item.action?.();
        });
      }

      container.appendChild(entry);
    }
  }

  private justify(alignment: 'left' | 'center' | 'right' | 'top' | 'bottom'): void {
    const sel = this.selectionTool.getSelection();
    if (!sel) {
      alert('No selection. Use the Selection tool to select a region first.');
      return;
    }
    const layerId = this.doc.layerManager.getActiveLayerId();
    const bounds = {
      x1: Math.min(sel.start.x, sel.end.x),
      y1: Math.min(sel.start.y, sel.end.y),
      x2: Math.max(sel.start.x, sel.end.x),
      y2: Math.max(sel.start.y, sel.end.y),
    };
    if (alignment === 'top' || alignment === 'bottom') {
      justifyVertical(this.doc, layerId, bounds, alignment, this.undoManager);
    } else {
      justifyHorizontal(this.doc, layerId, bounds, alignment, this.undoManager);
    }
  }

  private openReplaceColorsDialog(): void {
    this.replaceColorsDialog.show((result: ReplaceColorsResult) => {
      const layer = this.doc.layerManager.getActiveLayer();
      if (!layer) return;

      const sel = this.selectionTool.getSelection();
      const x1 = sel ? Math.min(sel.start.x, sel.end.x) : 0;
      const y1 = sel ? Math.min(sel.start.y, sel.end.y) : 0;
      const x2 = sel ? Math.max(sel.start.x, sel.end.x) : this.doc.width - 1;
      const y2 = sel ? Math.max(sel.start.y, sel.end.y) : this.doc.height - 1;

      const changes: CellChange[] = [];
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          const cell = layer.getCell(x, y);
          if (!cell) continue;
          const currentColor = result.attribute === 'fg'
            ? cell.attributes.foreground
            : cell.attributes.background;
          if (currentColor !== result.fromColor) continue;
          const newAttrs = result.attribute === 'fg'
            ? { ...cell.attributes, foreground: result.toColor }
            : { ...cell.attributes, background: result.toColor };
          changes.push({
            x, y,
            oldCell: cell,
            newCell: { char: cell.char, attributes: newAttrs },
          });
        }
      }

      if (changes.length > 0) {
        const cmd = new CellChangeCommand(this.doc, layer.id, changes, 'Replace colors');
        cmd.execute();
        this.undoManager.execute(cmd);
      }
    });
  }

  private openExportDialog(): void {
    const sel = this.selectionTool.getSelection();
    if (sel) {
      this.exportDialog.show({
        x1: Math.min(sel.start.x, sel.end.x),
        y1: Math.min(sel.start.y, sel.end.y),
        x2: Math.max(sel.start.x, sel.end.x),
        y2: Math.max(sel.start.y, sel.end.y),
      });
    } else {
      this.exportDialog.show();
    }
  }

  private newDocument(): void {
    if (confirm('Create new document? All unsaved changes will be lost.')) {
      // Clear all layers
      const layers = this.doc.layerManager.getLayers();
      for (const layer of layers) {
        layer.clear();
      }
      this.undoManager.clear();
      eventBus.emit(Events.DOCUMENT_CHANGED, null);
      eventBus.emit(Events.RENDER_REQUEST, null);
    }
  }

  private openCanvasSizeDialog(): void {
    this.canvasSizeDialog.show(this.doc.width, this.doc.height, ({ width, height }) => {
      this.doc.resize(width, height);
      this.undoManager.clear();
      eventBus.emit(Events.SELECTION_CHANGED, null);
    });
  }

  private importText(): void {
    this.openFileDialog('.txt', (text) => {
      importPlainText(text, this.doc, this.undoManager);
    });
  }

  private importTS(): void {
    this.openFileDialog('.ts,.js', (text) => {
      importTypeScript(text, this.doc, this.undoManager);
    });
  }

  private importJSON(): void {
    this.openFileDialog('.json', (text) => {
      try {
        const data = JSON.parse(text);
        if (typeof data.width === 'number' && typeof data.height === 'number') {
          this.doc.resize(data.width, data.height);
        }
        // Load layers from JSON
        if (data.layers && Array.isArray(data.layers)) {
          const layer = this.doc.layerManager.getActiveLayer();
          if (!layer) return;
          for (const layerData of data.layers) {
            if (layerData.cells) {
              for (let y = 0; y < Math.min(layerData.cells.length, this.doc.height); y++) {
                for (let x = 0; x < Math.min(layerData.cells[y].length, this.doc.width); x++) {
                  const cell = layerData.cells[y][x];
                  if (cell) layer.setCell(x, y, cell);
                }
              }
            }
          }
          eventBus.emit(Events.DOCUMENT_CHANGED, null);
          eventBus.emit(Events.RENDER_REQUEST, null);
        }
      } catch {
        alert('Failed to parse JSON file.');
      }
    });
  }

  private openFileDialog(accept: string, callback: (content: string) => void): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => callback(reader.result as string);
      reader.readAsText(file);
    });
    input.click();
  }

  private saveToBrowser(): void {
    const data = exportJSON(this.doc);
    localStorage.setItem('asciimator-save', data);
    alert('Saved to browser storage.');
  }

  private loadFromBrowser(): void {
    const data = localStorage.getItem('asciimator-save') ?? localStorage.getItem('asciimator-pro-save');
    if (!data) {
      alert('No saved data found.');
      return;
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed.layers && Array.isArray(parsed.layers) && parsed.layers.length > 0) {
        if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
          this.doc.resize(parsed.width, parsed.height);
        }
        this.doc.layerManager.loadLayers(parsed.layers, parsed.activeLayerId);
        this.undoManager.clear();
        eventBus.emit(Events.DOCUMENT_CHANGED, null);
        eventBus.emit(Events.RENDER_REQUEST, null);
      }
    } catch {
      alert('Failed to load saved data.');
    }
  }

  private closeCurrentTab(): void {
    if (!this.tabManager) return;
    const active = this.tabManager.getActiveSession();
    this.tabManager.closeTab(active.id);
  }

  private toggleGrid(): void {
    const current = this.canvasRenderer.getShowGrid();
    eventBus.emit(Events.GRID_TOGGLED, !current);
  }

  private setZoom(delta: number): void {
    const current = this.canvasRenderer.getZoom();
    const newZoom = Math.max(0.5, Math.min(3, current + delta * 0.25));
    eventBus.emit(Events.ZOOM_CHANGED, newZoom);
  }

  private showShortcuts(): void {
    const shortcuts = [
      'P - Pencil tool',
      'L - Line tool',
      'R - Rectangle tool (hold Shift for filled)',
      'F - Fill tool',
      'T - Text tool (click to place cursor, type to enter text, Esc to finish)',
      'E - Eraser tool',
      'S - Selection tool',
      'Ctrl/Cmd+Z - Undo',
      'Ctrl/Cmd+Shift+Z - Redo',
      'Ctrl/Cmd+C - Copy selection',
      'Ctrl/Cmd+X - Cut selection (copy + erase)',
      'Ctrl/Cmd+V - Paste',
      'Delete/Backspace - Delete selection contents',
      'Drag inside selection - Move selection',
      'G - Toggle grid',
      '+ / - - Zoom in/out',
    ];
    alert('Keyboard Shortcuts:\n\n' + shortcuts.join('\n'));
  }
}
