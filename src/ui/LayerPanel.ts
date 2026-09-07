import type { LayerData } from '../types/layer';

export interface LayerPanelCallbacks {
  onAddLayer: (name: string) => void;
  onSelectLayer: (layerId: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onLayerOpacityChange: (layerId: string, opacity: number) => void;
  onDeleteLayer: (layerId: string) => void;
}

/**
 * Floating panel for per-canvas layer stack management.
 */
export class LayerPanel {
  private readonly container: HTMLElement;
  private readonly rootElement: HTMLElement;
  private readonly callbacks: LayerPanelCallbacks;

  private isVisible: boolean = false;
  private layerListContainer!: HTMLElement;

  constructor(container: HTMLElement, callbacks: LayerPanelCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'layer-panel glass-panel floating-panel ui-interactive';
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

  public updateLayers(layers: LayerData[], activeLayerId: string): void {
    this.layerListContainer.innerHTML = layers
      .map(
        (l) => `
        <div class="layer-item ${l.id === activeLayerId ? 'active' : ''}" data-id="${l.id}">
          <div class="layer-title-row">
            <span class="layer-name">${l.name}</span>
            <div class="layer-controls">
              <button class="small-btn btn-vis" data-id="${l.id}" title="Toggle visibility">
                ${l.isVisible ? '👁️' : '🕶️'}
              </button>
              <button class="small-btn btn-lock" data-id="${l.id}" title="Toggle lock">
                ${l.isLocked ? '🔒' : '🔓'}
              </button>
              <button class="small-btn btn-del" data-id="${l.id}" title="Delete layer">✕</button>
            </div>
          </div>
          <div class="layer-opacity-row">
            <input class="custom-range slider-layer-op" data-id="${l.id}" type="range" min="0.1" max="1.0" step="0.05" value="${l.opacity}" />
          </div>
        </div>
      `
      )
      .join('');

    this.bindLayerEvents();
  }

  public dispose(): void {
    this.rootElement.remove();
  }

  private render(): void {
    this.rootElement.innerHTML = `
      <div class="panel-header">
        <span>Canvas Layers</span>
        <button id="close-layer-panel" class="small-btn">✕</button>
      </div>
      <div class="layer-list" id="layers-container"></div>
      <button id="btn-add-layer" class="action-pill" style="margin-top: 8px; justify-content: center;">+ New Layer</button>
    `;

    this.layerListContainer = this.rootElement.querySelector('#layers-container') as HTMLElement;
    this.bindControls();
  }

  private bindControls(): void {
    this.rootElement.querySelector('#close-layer-panel')?.addEventListener('click', () => {
      this.hide();
    });

    this.rootElement.querySelector('#btn-add-layer')?.addEventListener('click', () => {
      this.callbacks.onAddLayer(`Layer ${Date.now().toString().slice(-3)}`);
    });
  }

  private bindLayerEvents(): void {
    const items = this.layerListContainer.querySelectorAll('.layer-item');
    items.forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const id = (item as HTMLElement).dataset.id;
        if (!id) return;

        if (target.classList.contains('btn-vis')) {
          e.stopPropagation();
          this.callbacks.onToggleVisibility(id);
        } else if (target.classList.contains('btn-lock')) {
          e.stopPropagation();
          this.callbacks.onToggleLock(id);
        } else if (target.classList.contains('btn-del')) {
          e.stopPropagation();
          this.callbacks.onDeleteLayer(id);
        } else if (!target.classList.contains('slider-layer-op')) {
          this.callbacks.onSelectLayer(id);
        }
      });
    });

    const sliders = this.layerListContainer.querySelectorAll('.slider-layer-op');
    sliders.forEach((s) => {
      s.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const id = target.dataset.id;
        if (id) {
          this.callbacks.onLayerOpacityChange(id, parseFloat(target.value));
        }
      });
    });
  }
}
