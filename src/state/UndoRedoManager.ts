import { Command } from './Command';
import { eventBus, Events } from '../core/EventBus';

export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 10;

  constructor() {
    eventBus.on(Events.UNDO, () => this.undo());
    eventBus.on(Events.REDO, () => this.redo());
  }

  execute(command: Command): void {
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.execute();
    this.undoStack.push(command);
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  clear(): void { this.undoStack = []; this.redoStack = []; }

  getStacks(): { undoStack: Command[]; redoStack: Command[] } {
    return { undoStack: this.undoStack, redoStack: this.redoStack };
  }

  setStacks(stacks: { undoStack: Command[]; redoStack: Command[] }): void {
    this.undoStack = stacks.undoStack;
    this.redoStack = stacks.redoStack;
  }
}
