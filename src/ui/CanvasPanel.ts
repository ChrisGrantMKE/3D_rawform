import type { SpatialCanvasData, SpatialPlaneType } from '../types/canvas';

export interface CanvasPanelCallbacks {
  onSelectCanvas: (canvasId: string) => void;
  onCreateCanvas: (name: string, planeType: SpatialPlaneType) => void;
  onCreateParallel?: (distance: number) => void;
  onCreateHinge?: (edge: 'top' | 'bottom' | 'left' | 'right', angleDeg: number) => void;
  onSnapToCanvas: (canvasId: string) => void;
}

/**
 * Floating panel for managing, adding, and selecting spatial canvases in 3D space.
 */
export class CanvasPanel {
  private readonly container: HTMLElement;
  private readonly rootElement: HTMLElement;
  private readonly callbacks: CanvasPanelCallbacks;
  private isVisible: boolean = false;
  private canvasListContainer!: HTMLElement;

  constructor(container: HTMLElement, callbacks: CanvasPanelCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'canvas-panel glass-panel floating-panel ui-interactive';
    this.rootElement.style.display = 'none';

    this.render();
    this.container.appendChild(this.rootElement);
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.rootElement.style.display = this.isVisible ? 'flex' : 'none';
  }

  public hide(): void {
    this.isVisible = false;
    this.rootElement.style.display = 'none';
  }

  public updateCanvases(canvases: SpatialCanvasData[], activeId: string): void {
    this.canvasListContainer.innerHTML = canvases
      .map(
        (c) => `
        <div class="canvas-item ${c.id === activeId ? 'active' : ''}" data-id="${c.id}">
          <span>${c.name}</span>
          <div class="canvas-item-controls">
            <button class="small-btn btn-snap-canvas" data-id="${c.id}" title="Snap view">👁️</button>
          </div>
        </div>
      `
      )
      .join('');

    this.bindListEvents();
  }

  public dispose(): void {
    this.rootElement.remove();
  }

  private render(): void {
    this.rootElement.innerHTML = `
      <div class="panel-header">
        <span>Spatial Canvases</span>
        <button id="close-canvas-panel" class="small-btn">✕</button>
      </div>
      <div class="canvas-list" id="canvas-items-container"></div>
      <div class="panel-section-title" style="margin-top: 8px;">Standard Planes</div>
      <div style="display: flex; gap: 6px;">
        <button id="add-xy-canvas" class="action-pill" style="flex: 1; justify-content: center; font-size: 11px; height: 32px;">+ XY Front</button>
        <button id="add-xz-canvas" class="action-pill" style="flex: 1; justify-content: center; font-size: 11px; height: 32px;">+ XZ Top</button>
        <button id="add-yz-canvas" class="action-pill" style="flex: 1; justify-content: center; font-size: 11px; height: 32px;">+ YZ Side</button>
      </div>
      <div class="panel-section-title" style="margin-top: 8px;">Canvas Projections</div>
      <div style="display: flex; gap: 6px;">
        <button id="add-parallel-canvas" class="action-pill" style="flex: 1; justify-content: center; font-size: 11px; height: 32px;">+ Parallel (+2m)</button>
        <button id="add-hinge-canvas" class="action-pill" style="flex: 1; justify-content: center; font-size: 11px; height: 32px;">+ Hinge Wall (90°)</button>
      </div>
    `;

    this.canvasListContainer = this.rootElement.querySelector('#canvas-items-container') as HTMLElement;
    this.bindEvents();
  }

  private bindEvents(): void {
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

    this.rootElement.querySelector('#add-parallel-canvas')?.addEventListener('click', () => {
      this.callbacks.onCreateParallel?.(2.0);
    });

    this.rootElement.querySelector('#add-hinge-canvas')?.addEventListener('click', () => {
      this.callbacks.onCreateHinge?.('right', 90);
    });
  }

  private bindListEvents(): void {
    const items = this.canvasListContainer.querySelectorAll('.canvas-item');
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('btn-snap-canvas')) {
          const id = target.dataset.id;
          if (id) this.callbacks.onSnapToCanvas(id);
          return;
        }

        const id = (item as HTMLElement).dataset.id;
        if (id) this.callbacks.onSelectCanvas(id);
      });
    });
  }
}
