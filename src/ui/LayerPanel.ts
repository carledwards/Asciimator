import { LayerManager } from '../document/LayerManager';
import { eventBus, Events } from '../core/EventBus';

export class LayerPanel {
  private element: HTMLElement;
  private draggedLayerId: string | null = null;
  private draggedVisualIndex: number = -1;

  setLayerManager(layerManager: LayerManager): void {
    this.layerManager = layerManager;
    this.render();
  }

  constructor(private container: HTMLElement, private layerManager: LayerManager) {
    this.element = document.createElement('div');
    this.element.className = 'layer-panel';
    container.appendChild(this.element);
    this.render();

    eventBus.on(Events.LAYER_CHANGED, () => this.render());
    eventBus.on(Events.ACTIVE_LAYER_CHANGED, () => this.render());
  }

  private render(): void {
    this.element.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'Layers';
    this.element.appendChild(header);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'layer-actions';

    const addBtn = document.createElement('button');
    addBtn.className = 'layer-action-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add layer';
    addBtn.addEventListener('click', () => this.layerManager.addLayer());
    actions.appendChild(addBtn);

    const dupBtn = document.createElement('button');
    dupBtn.className = 'layer-action-btn';
    dupBtn.textContent = '⧉';
    dupBtn.title = 'Duplicate layer';
    dupBtn.addEventListener('click', () => {
      this.layerManager.duplicateLayer(this.layerManager.getActiveLayerId());
    });
    actions.appendChild(dupBtn);

    const mergeBtn = document.createElement('button');
    mergeBtn.className = 'layer-action-btn';
    mergeBtn.textContent = '⤓';
    mergeBtn.title = 'Merge down';
    mergeBtn.addEventListener('click', () => {
      this.layerManager.mergeDown(this.layerManager.getActiveLayerId());
    });
    actions.appendChild(mergeBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'layer-action-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete layer';
    delBtn.addEventListener('click', () => {
      this.layerManager.removeLayer(this.layerManager.getActiveLayerId());
    });
    actions.appendChild(delBtn);

    this.element.appendChild(actions);

    // Layer list (top-to-bottom = render order reversed)
    const list = document.createElement('div');
    list.className = 'layer-list';
    const layers = [...this.layerManager.getLayers()].reverse();
    const activeId = this.layerManager.getActiveLayerId();

    for (let visualIndex = 0; visualIndex < layers.length; visualIndex++) {
      const layer = layers[visualIndex];
      const item = document.createElement('div');
      item.className = `layer-item ${layer.id === activeId ? 'active' : ''}`;
      item.draggable = true;
      item.dataset.layerId = layer.id;
      item.dataset.visualIndex = String(visualIndex);

      // Drag handle
      const handle = document.createElement('span');
      handle.className = 'layer-drag-handle';
      handle.textContent = '⠿';
      item.appendChild(handle);

      // Visibility toggle
      const visBtn = document.createElement('button');
      visBtn.className = 'layer-vis-btn';
      visBtn.textContent = layer.visible ? '👁' : '○';
      visBtn.title = layer.visible ? 'Hide' : 'Show';
      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.layerManager.toggleVisibility(layer.id);
      });
      item.appendChild(visBtn);

      // Lock toggle
      const lockBtn = document.createElement('button');
      lockBtn.className = 'layer-lock-btn';
      lockBtn.textContent = layer.locked ? '🔒' : '🔓';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.layerManager.toggleLock(layer.id);
      });
      item.appendChild(lockBtn);

      // Name
      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = layer.name;
      name.addEventListener('dblclick', () => {
        const newName = prompt('Rename layer:', layer.name);
        if (newName) this.layerManager.renameLayer(layer.id, newName);
      });
      item.appendChild(name);

      // Drag events
      item.addEventListener('dragstart', (e) => {
        this.draggedLayerId = layer.id;
        this.draggedVisualIndex = visualIndex;
        item.classList.add('dragging');
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', layer.id);
      });

      item.addEventListener('dragend', () => {
        this.draggedLayerId = null;
        this.draggedVisualIndex = -1;
        item.classList.remove('dragging');
        list.querySelectorAll('.layer-item').forEach(el => {
          el.classList.remove('drop-above', 'drop-below');
        });
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!this.draggedLayerId || this.draggedLayerId === layer.id) return;
        e.dataTransfer!.dropEffect = 'move';

        // Clear indicators on all other items
        list.querySelectorAll('.layer-item').forEach(el => {
          if (el !== item) el.classList.remove('drop-above', 'drop-below');
        });

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          item.classList.add('drop-above');
          item.classList.remove('drop-below');
        } else {
          item.classList.add('drop-below');
          item.classList.remove('drop-above');
        }
      });

      item.addEventListener('dragleave', (e) => {
        // Only remove if actually leaving the item (not entering a child)
        if (!item.contains(e.relatedTarget as Node)) {
          item.classList.remove('drop-above', 'drop-below');
        }
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        list.querySelectorAll('.layer-item').forEach(el => {
          el.classList.remove('drop-above', 'drop-below');
        });
        if (!this.draggedLayerId || this.draggedLayerId === layer.id) return;

        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dropAbove = e.clientY < midY;

        // Convert visual drop position to array index.
        // Visual list is reversed: visual index 0 = top = highest array index.
        // gap = insertion point in visual list (0=top, N=bottom)
        const tvi = visualIndex;
        const dvi = this.draggedVisualIndex;
        const N = layers.length;
        const gap = dropAbove ? tvi : tvi + 1;
        // Adjust gap for the removal of the dragged item
        const effectiveGap = dvi < gap ? gap - 1 : gap;
        const targetArrayIndex = Math.max(0, Math.min(N - 1, N - 1 - effectiveGap));

        this.layerManager.moveLayerToIndex(this.draggedLayerId, targetArrayIndex);
        this.draggedLayerId = null;
        this.draggedVisualIndex = -1;
      });

      // Select layer on click
      item.addEventListener('click', () => {
        this.layerManager.setActiveLayer(layer.id);
      });

      list.appendChild(item);
    }

    this.element.appendChild(list);
  }
}
