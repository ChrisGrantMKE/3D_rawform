/**
 * Command pattern undo/redo stack manager.
 */
export class UndoRedoManager {
    undoStack = [];
    redoStack = [];
    maxHistory = 50;
    onChangeCallbacks = [];
    /**
     * Executes a command and pushes it onto the undo stack.
     *
     * @param command - The action command to execute
     */
    async execute(command) {
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
    async undo() {
        const cmd = this.undoStack.pop();
        if (!cmd)
            return;
        await cmd.undo();
        this.redoStack.push(cmd);
        this.notifyChange();
    }
    /**
     * Re-applies the most recently reverted command.
     */
    async redo() {
        const cmd = this.redoStack.pop();
        if (!cmd)
            return;
        await cmd.execute();
        this.undoStack.push(cmd);
        this.notifyChange();
    }
    /**
     * Checks if undo action is available.
     */
    canUndo() {
        return this.undoStack.length > 0;
    }
    /**
     * Checks if redo action is available.
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
    /**
     * Registers a callback invoked whenever the stack state changes.
     */
    onChange(callback) {
        this.onChangeCallbacks.push(callback);
    }
    /**
     * Clears undo and redo histories.
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.notifyChange();
    }
    notifyChange() {
        for (const cb of this.onChangeCallbacks) {
            cb();
        }
    }
}
