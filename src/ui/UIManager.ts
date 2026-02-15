import { Document } from '../document/Document';
import { CompositeBuffer } from '../rendering/CompositeBuffer';
import { CanvasRenderer } from '../rendering/CanvasRenderer';
import { ToolManager } from '../tools/ToolManager';
import { UndoRedoManager } from '../state/UndoRedoManager';
import { Clipboard } from '../state/Clipboard';
import { SelectionTool } from '../tools/SelectionTool';
import { TabManager } from '../state/TabManager';
import { Toolbar } from './Toolbar';
import { ColorPicker } from './ColorPicker';
import { CharacterPicker } from './CharacterPicker';
import { BoxStylePicker } from './BoxStylePicker';
import { LayerPanel } from './LayerPanel';
import { StatusBar } from './StatusBar';
import { MenuBar } from './MenuBar';
import { TabBar } from './TabBar';

export class UIManager {
  private menuBar!: MenuBar;
  private tabBar!: TabBar;
  private toolbar!: Toolbar;
  private layerPanel!: LayerPanel;
  private charPicker!: CharacterPicker;
  private boxStylePicker!: BoxStylePicker;
  private colorPicker!: ColorPicker;
  private statusBar!: StatusBar;

  constructor(
    private appElement: HTMLElement,
    private doc: Document,
    private compositeBuffer: CompositeBuffer,
    private canvasRenderer: CanvasRenderer,
    private toolManager: ToolManager,
    private undoManager: UndoRedoManager,
    private clipboard: Clipboard,
    private selectionTool: SelectionTool,
    private tabManager: TabManager,
  ) {}

  init(): void {
    // Menu bar
    const menuBarContainer = document.createElement('div');
    menuBarContainer.id = 'menu-bar-container';
    this.appElement.appendChild(menuBarContainer);
    this.menuBar = new MenuBar(
      menuBarContainer, this.doc, this.compositeBuffer,
      this.canvasRenderer, this.undoManager, this.clipboard,
      this.selectionTool, this.tabManager,
    );

    // Tab bar
    const tabBarContainer = document.createElement('div');
    tabBarContainer.id = 'tab-bar-container';
    this.appElement.appendChild(tabBarContainer);
    this.tabBar = new TabBar(tabBarContainer, this.tabManager);

    // Toolbar
    const toolbarContainer = document.createElement('div');
    toolbarContainer.id = 'toolbar-container';
    this.appElement.appendChild(toolbarContainer);
    this.toolbar = new Toolbar(toolbarContainer, this.toolManager);

    // Main area: left panel + canvas + right panel
    const mainArea = document.createElement('div');
    mainArea.id = 'main-area';
    this.appElement.appendChild(mainArea);

    // Left panel (layers)
    const leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel';
    mainArea.appendChild(leftPanel);
    this.layerPanel = new LayerPanel(leftPanel, this.doc.layerManager);

    // Canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'canvas-container';
    mainArea.appendChild(canvasContainer);
    canvasContainer.appendChild(this.canvasRenderer.getCanvas());

    // Right panel (char picker + color picker)
    const rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel';
    mainArea.appendChild(rightPanel);
    this.colorPicker = new ColorPicker(rightPanel);
    this.charPicker = new CharacterPicker(rightPanel);
    this.boxStylePicker = new BoxStylePicker(rightPanel);

    // Status bar
    const statusBarContainer = document.createElement('div');
    statusBarContainer.id = 'status-bar-container';
    this.appElement.appendChild(statusBarContainer);
    this.statusBar = new StatusBar(statusBarContainer);
  }

  getLayerPanel(): LayerPanel {
    return this.layerPanel;
  }

  getMenuBar(): MenuBar {
    return this.menuBar;
  }
}
