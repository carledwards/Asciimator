import { LayerManager } from '../document/LayerManager';
import { eventBus, Events } from '../core/EventBus';

export class LayerPanel {
  private element: HTMLElement;

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

    for (const layer of layers) {
      const item = document.createElement('div');
      item.className = `layer-item ${layer.id === activeId ? 'active' : ''}`;

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

      // Move buttons
      const moveUp = document.createElement('button');
      moveUp.className = 'layer-move-btn';
      moveUp.textContent = '▲';
      moveUp.title = 'Move up';
      moveUp.addEventListener('click', (e) => {
        e.stopPropagation();
        this.layerManager.moveLayer(layer.id, 'up');
      });
      item.appendChild(moveUp);

      const moveDown = document.createElement('button');
      moveDown.className = 'layer-move-btn';
      moveDown.textContent = '▼';
      moveDown.title = 'Move down';
      moveDown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.layerManager.moveLayer(layer.id, 'down');
      });
      item.appendChild(moveDown);

      // Select layer on click
      item.addEventListener('click', () => {
        this.layerManager.setActiveLayer(layer.id);
      });

      list.appendChild(item);
    }

    this.element.appendChild(list);
  }
}
