import { Document } from './document/Document';
import { CompositeBuffer } from './rendering/CompositeBuffer';
import { CanvasRenderer } from './rendering/CanvasRenderer';
import { CursorRenderer } from './rendering/CursorRenderer';
import { MouseService } from './input/MouseService';
import { KeyboardService } from './input/KeyboardService';
import { InputManager } from './input/InputManager';
import { ToolManager } from './tools/ToolManager';
import { PencilTool } from './tools/PencilTool';
import { LineTool } from './tools/LineTool';
import { RectangleTool } from './tools/RectangleTool';
import { FilledRectangleTool } from './tools/FilledRectangleTool';
import { EllipseTool } from './tools/EllipseTool';
import { FillTool } from './tools/FillTool';
import { TextTool } from './tools/TextTool';
import { EraserTool } from './tools/EraserTool';
import { SelectionTool } from './tools/SelectionTool';
import { SmartLineTool } from './tools/SmartLineTool';
import { SmartBoxTool } from './tools/SmartBoxTool';
import { DropperTool } from './tools/DropperTool';
import { UndoRedoManager } from './state/UndoRedoManager';
import { Clipboard } from './state/Clipboard';
import { TabManager, TabSession } from './state/TabManager';
import { UIManager } from './ui/UIManager';
import { eventBus, Events } from './core/EventBus';

export class App {
  private doc!: Document;
  private compositeBuffer!: CompositeBuffer;
  private canvasRenderer!: CanvasRenderer;
  private cursorRenderer!: CursorRenderer;
  private mouseService!: MouseService;
  private keyboardService!: KeyboardService;
  private inputManager!: InputManager;
  private toolManager!: ToolManager;
  private undoManager!: UndoRedoManager;
  private clipboard!: Clipboard;
  private uiManager!: UIManager;
  private tabManager!: TabManager;
  private currentSessionId: string = '';

  constructor(private appElement: HTMLElement) {}

  init(): void {
    // Tab manager
    this.tabManager = new TabManager();

    // Create first tab (emits TAB_CHANGED but we haven't wired handler yet)
    const firstSession = this.tabManager.createTab();
    this.doc = firstSession.doc;
    this.currentSessionId = firstSession.id;

    // Rendering
    this.compositeBuffer = new CompositeBuffer(this.doc.layerManager, this.doc.width, this.doc.height);

    // Create a temporary container for the canvas (UIManager will move it)
    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);
    this.canvasRenderer = new CanvasRenderer(tempContainer, this.compositeBuffer);

    // Cursor
    this.cursorRenderer = new CursorRenderer(this.compositeBuffer, this.canvasRenderer);

    // Input
    this.mouseService = new MouseService(this.canvasRenderer);
    this.keyboardService = new KeyboardService();
    this.inputManager = new InputManager();

    // State
    this.undoManager = new UndoRedoManager();
    this.clipboard = new Clipboard(this.doc, this.undoManager);

    // Tools
    this.toolManager = new ToolManager();

    const pencil = new PencilTool(this.doc);
    pencil.setUndoManager(this.undoManager);
    this.toolManager.registerTool(pencil);

    const line = new LineTool(this.doc, this.canvasRenderer);
    line.setUndoManager(this.undoManager);
    this.toolManager.registerTool(line);

    const rect = new RectangleTool(this.doc, this.canvasRenderer);
    rect.setUndoManager(this.undoManager);
    this.toolManager.registerTool(rect);

    const filledRect = new FilledRectangleTool(this.doc, this.canvasRenderer);
    filledRect.setUndoManager(this.undoManager);
    this.toolManager.registerTool(filledRect);

    const circle = new EllipseTool(this.doc, this.canvasRenderer, 'circle', 'C', 'Circle', false);
    circle.setUndoManager(this.undoManager);
    this.toolManager.registerTool(circle);

    const filledCircle = new EllipseTool(this.doc, this.canvasRenderer, 'filled-circle', 'O', 'Filled Circle', true);
    filledCircle.setUndoManager(this.undoManager);
    this.toolManager.registerTool(filledCircle);

    const fill = new FillTool(this.doc);
    fill.setUndoManager(this.undoManager);
    this.toolManager.registerTool(fill);

    const dropper = new DropperTool(this.doc, this.compositeBuffer);
    this.toolManager.registerTool(dropper);

    const text = new TextTool(this.doc);
    text.setUndoManager(this.undoManager);
    this.toolManager.registerTool(text);

    const eraser = new EraserTool(this.doc);
    eraser.setUndoManager(this.undoManager);
    this.toolManager.registerTool(eraser);

    const selection = new SelectionTool(this.canvasRenderer, this.clipboard, this.doc, this.undoManager);
    this.toolManager.registerTool(selection);

    const smartLine = new SmartLineTool(this.doc, this.canvasRenderer);
    smartLine.setUndoManager(this.undoManager);
    this.toolManager.registerTool(smartLine);

    const smartBox = new SmartBoxTool(this.doc, this.canvasRenderer);
    smartBox.setUndoManager(this.undoManager);
    this.toolManager.registerTool(smartBox);

    // Wire input to tools
    this.inputManager.setToolManager(this.toolManager);

    // Set default tool
    this.toolManager.setActiveTool('pencil');

    // UI
    this.uiManager = new UIManager(
      this.appElement, this.doc, this.compositeBuffer,
      this.canvasRenderer, this.toolManager, this.undoManager, this.clipboard,
      selection,
      this.tabManager,
    );
    this.uiManager.init();

    // Clean up temp container
    tempContainer.remove();

    // Wire tab switching
    eventBus.on<TabSession>(Events.TAB_CHANGED, (session) => {
      this.onTabChanged(session);
    });
    eventBus.on<{ width: number; height: number }>(Events.DOCUMENT_RESIZED, () => {
      this.compositeBuffer.setLayerManager(this.doc.layerManager, this.doc.width, this.doc.height);
      this.canvasRenderer.refreshDimensions();
    });

    // Start rendering
    this.canvasRenderer.startRenderLoop();

    // Auto-save every 30 seconds
    setInterval(() => {
      try {
        const data = JSON.stringify(this.doc.toData());
        localStorage.setItem('asciimator-autosave', data);
      } catch { /* ignore */ }
    }, 30000);
  }

  private onTabChanged(session: TabSession): void {
    // Save current undo stacks to the OLD session before switching
    if (this.currentSessionId && this.currentSessionId !== session.id) {
      const oldSession = this.tabManager.getSessions().find(s => s.id === this.currentSessionId);
      if (oldSession) {
        const stacks = this.undoManager.getStacks();
        oldSession.undoStack = stacks.undoStack;
        oldSession.redoStack = stacks.redoStack;
      }
    }

    // Track new current session
    this.currentSessionId = session.id;

    // Update document reference
    this.doc = session.doc;

    // Restore undo stacks for new session
    this.undoManager.setStacks({
      undoStack: session.undoStack,
      redoStack: session.redoStack,
    });

    // Re-point composite buffer
    this.compositeBuffer.setLayerManager(this.doc.layerManager, this.doc.width, this.doc.height);

    // Re-point tools
    for (const tool of this.toolManager.getTools()) {
      tool.setDocument?.(this.doc);
    }

    // Re-point clipboard
    this.clipboard.setDocument(this.doc);

    // Re-point UI
    this.uiManager.getLayerPanel().setLayerManager(this.doc.layerManager);
    this.uiManager.getMenuBar().setDocument(this.doc);

    // Trigger re-render
    eventBus.emit(Events.DOCUMENT_CHANGED, null);
    eventBus.emit(Events.RENDER_REQUEST, null);
  }
}
