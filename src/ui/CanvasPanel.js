/**
 * Floating panel for managing, adding, and selecting spatial canvases in 3D space.
 */
export class CanvasPanel {
    container;
    rootElement;
    callbacks;
    isVisible = false;
    canvasListContainer;
    /**
     * Initializes the canvas management panel.
     */
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks;
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'canvas-panel glass-panel floating-panel ui-interactive';
        this.rootElement.style.display = 'none';
        this.render();
        this.container.appendChild(this.rootElement);
    }
    /**
     * Toggles panel visibility.
     */
    toggle() {
        this.isVisible = !this.isVisible;
        this.rootElement.style.display = this.isVisible ? 'flex' : 'none';
    }
    /**
     * Closes panel.
     */
    hide() {
        this.isVisible = false;
        this.rootElement.style.display = 'none';
    }
    /**
     * Updates list of spatial canvases rendered in the panel.
     */
    updateCanvases(canvases, activeId) {
        this.canvasListContainer.innerHTML = canvases
            .map((c) => `
        <div class="canvas-item ${c.id === activeId ? 'active' : ''}" data-id="${c.id}">
          <span>${c.name}</span>
          <div class="canvas-item-controls">
            <button class="small-btn btn-snap-canvas" data-id="${c.id}" title="Snap view">👁️</button>
          </div>
        </div>
      `)
            .join('');
        this.bindListEvents();
    }
    /**
     * Disposes the panel.
     */
    dispose() {
        this.rootElement.remove();
    }
    render() {
        this.rootElement.innerHTML = `
      <div class="panel-header">
        <span>Spatial Canvases</span>
        <button id="close-canvas-panel" class="small-btn">✕</button>
      </div>
      <div class="canvas-list" id="canvas-items-container"></div>
      <div style="display: flex; gap: 6px; margin-top: 8px;">
        <button id="add-xy-canvas" class="action-pill" style="flex: 1; justify-content: center;">+ Front (XY)</button>
        <button id="add-xz-canvas" class="action-pill" style="flex: 1; justify-content: center;">+ Top (XZ)</button>
        <button id="add-yz-canvas" class="action-pill" style="flex: 1; justify-content: center;">+ Side (YZ)</button>
      </div>
    `;
        this.canvasListContainer = this.rootElement.querySelector('#canvas-items-container');
        this.bindEvents();
    }
    bindEvents() {
        this.rootElement.querySelector('#close-canvas-panel')?.addEventListener('click', () => {
            this.hide();
        });
        this.rootElement.querySelector('#add-xy-canvas')?.addEventListener('click', () => {
            this.callbacks.onCreateCanvas('Front (XY)', 'XY');
        });
        this.rootElement.querySelector('#add-xz-canvas')?.addEventListener('click', () => {
            this.callbacks.onCreateCanvas('Ground (XZ)', 'XZ');
        });
        this.rootElement.querySelector('#add-yz-canvas')?.addEventListener('click', () => {
            this.callbacks.onCreateCanvas('Profile (YZ)', 'YZ');
        });
    }
    bindListEvents() {
        const items = this.canvasListContainer.querySelectorAll('.canvas-item');
        items.forEach((item) => {
            item.addEventListener('click', (e) => {
                const target = e.target;
                if (target.classList.contains('btn-snap-canvas')) {
                    const id = target.dataset.id;
                    if (id)
                        this.callbacks.onSnapToCanvas(id);
                    return;
                }
                const id = item.dataset.id;
                if (id)
                    this.callbacks.onSelectCanvas(id);
            });
        });
    }
}
