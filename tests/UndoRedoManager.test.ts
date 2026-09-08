import { describe, it, expect } from 'vitest';
import { UndoRedoManager, Command } from '../src/state/UndoRedoManager';

class CounterCommand implements Command {
  constructor(private counter: { val: number }, private delta: number) {}
  execute() {
    this.counter.val += this.delta;
  }
  undo() {
    this.counter.val -= this.delta;
  }
}

describe('UndoRedoManager', () => {
  it('executes command, supports undo and redo', async () => {
    const manager = new UndoRedoManager();
    const state = { val: 10 };

    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);

    await manager.execute(new CounterCommand(state, 5));
    expect(state.val).toBe(15);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    await manager.undo();
    expect(state.val).toBe(10);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);

    await manager.redo();
    expect(state.val).toBe(15);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
  });

  it('prunes redo stack when a new command is executed', async () => {
    const manager = new UndoRedoManager();
    const state = { val: 0 };

    await manager.execute(new CounterCommand(state, 1));
    await manager.undo();
    expect(manager.canRedo()).toBe(true);

    await manager.execute(new CounterCommand(state, 10));
    expect(manager.canRedo()).toBe(false);
    expect(state.val).toBe(10);
  });
});
