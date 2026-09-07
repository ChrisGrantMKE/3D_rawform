/**
 * Floating touch-friendly toolbar providing primary tool and view actions.
 */
export class Toolbar {
    container;
    rootElement;
    callbacks;
    btnBrush;
    btnEraser;
    btnUndo;
    btnRedo;
    /**
     * Initializes and mounts the toolbar into the UI layer.
     *
     * @param container - UI layer container
     * @param callbacks - Toolbar action callbacks
     */
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks;
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'toolbar-container glass-panel ui-interactive';
        this.render();
        this.container.appendChild(this.rootElement);
    }
    /**
     * Updates the visual active state of tool buttons.
     *
     * @param activeTool - Currently selected tool
     */
    setActiveTool(activeTool) {
        this.btnBrush.classList.toggle('active', activeTool === 'brush');
        this.btnEraser.classList.toggle('active', activeTool === 'eraser');
    }
    /**
     * Updates undo and redo button disabled states.
     *
     * @param canUndo - Whether undo history exists
     * @param canRedo - Whether redo history exists
     */
    updateHistoryState(canUndo, canRedo) {
        this.btnUndo.disabled = !canUndo;
        this.btnRedo.disabled = !canRedo;
    }
    /**
     * Disposes of DOM elements.
     */
    dispose() {
        this.rootElement.remove();
    }
    render() {
        this.rootElement.innerHTML = `
      <div class="toolbar-group">
        <button id="tool-brush" class="tool-button active" title="Stylus Pen (Draw)">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
        <button id="tool-eraser" class="tool-button" title="Eraser">
          <svg viewBox="0 0 24 24"><path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.78-.78 2.05 0 2.83L5.03 20c.37.37.88.59 1.41.59h12.56c.55 0 1-.45 1-1s-.45-1-1-1h-6.17l6.83-6.83c.78-.78.78-2.05 0-2.83l-4.11-4.11c-.39-.39-.9-.59-1.41-.59zM6.44 18.59l-2.44-2.44 8.73-8.73 2.44 2.44-8.73 8.73z"/></svg>
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button id="btn-color" class="tool-button" title="Palette & Brush Width">
          <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.22 19.58 10.57 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
        </button>
        <button id="btn-canvases" class="tool-button" title="Spatial Canvases">
          <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h10v2H7zm0-3h10v2H7zm0 6h7v2H7z"/></svg>
        </button>
        <button id="btn-snap" class="tool-button" title="Snap View to Canvas">
          <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        </button>
      </div>
      <div class="toolbar-separator"></div>
      <div class="toolbar-group">
        <button id="btn-undo" class="tool-button" disabled title="Undo">
          <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
        </button>
        <button id="btn-redo" class="tool-button" disabled title="Redo">
          <svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
        </button>
      </div>
    `;
        this.btnBrush = this.rootElement.querySelector('#tool-brush');
        this.btnEraser = this.rootElement.querySelector('#tool-eraser');
        this.btnUndo = this.rootElement.querySelector('#btn-undo');
        this.btnRedo = this.rootElement.querySelector('#btn-redo');
        this.bindEvents();
    }
    bindEvents() {
        this.btnBrush.addEventListener('click', () => this.callbacks.onToolSelect('brush'));
        this.btnEraser.addEventListener('click', () => this.callbacks.onToolSelect('eraser'));
        this.rootElement.querySelector('#btn-color')?.addEventListener('click', () => {
            this.callbacks.onToggleColorPanel();
        });
        this.rootElement.querySelector('#btn-canvases')?.addEventListener('click', () => {
            this.callbacks.onToggleCanvasPanel();
        });
        this.rootElement.querySelector('#btn-snap')?.addEventListener('click', () => {
            this.callbacks.onSnapView();
        });
        this.btnUndo.addEventListener('click', () => this.callbacks.onUndo());
        this.btnRedo.addEventListener('click', () => this.callbacks.onRedo());
    }
}
