/**
 * Interface representing an undoable/redoable command.
 */
export interface Command {
  execute(): void | Promise<void>;
  undo(): void | Promise<void>;
}

/**
 * Command pattern undo/redo stack manager.
 */
export class UndoRedoManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxHistory: number = 50;
  private onChangeCallbacks: Array<() => void> = [];

  /**
   * Executes a command and pushes it onto the undo stack.
   *
   * @param command - The action command to execute
   */
  public async execute(command: Command): Promise<void> {
    await command.execute();
    this.undoStack.push(command);
    this.redoStack = [];

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notifyChange();
  }

  /**
   * Reverts the most recent command.
   */
  public async undo(): Promise<void> {
    const cmd = this.undoStack.pop();
    if (!cmd) return;

    await cmd.undo();
    this.redoStack.push(cmd);
    this.notifyChange();
  }

  /**
   * Re-applies the most recently reverted command.
   */
  public async redo(): Promise<void> {
    const cmd = this.redoStack.pop();
    if (!cmd) return;

    await cmd.execute();
    this.undoStack.push(cmd);
    this.notifyChange();
  }

  /**
   * Checks if undo action is available.
   */
  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Checks if redo action is available.
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Registers a callback invoked whenever the stack state changes.
   */
  public onChange(callback: () => void): void {
    this.onChangeCallbacks.push(callback);
  }

  /**
   * Clears undo and redo histories.
   */
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  private notifyChange(): void {
    for (const cb of this.onChangeCallbacks) {
      cb();
    }
  }
}
