export interface ColorPickerCallbacks {
  onColorSelect: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
  onProfileSelect?: (profile: 'ink' | 'marker' | 'pencil') => void;
}

/**
 * Floating panel for selecting stroke colors, base width, and opacity.
 */
export class ColorPicker {
  private readonly container: HTMLElement;
  private readonly rootElement: HTMLElement;
  private readonly callbacks: ColorPickerCallbacks;
  private isVisible: boolean = false;

  private readonly presetColors: string[] = [
    '#ffffff', '#f87171', '#fb923c', '#facc15',
    '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8',
    '#c084fc', '#f472b6', '#94a3b8', '#334155',
    '#0f172a', '#e2e8f0',
  ];

  constructor(container: HTMLElement, callbacks: ColorPickerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'color-panel glass-panel floating-panel ui-interactive';
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

  public dispose(): void {
    this.rootElement.remove();
  }

  private render(): void {
    this.rootElement.innerHTML = `
      <div class="panel-header">
        <span>Brush & Palette</span>
        <button id="close-color-panel" class="small-btn">✕</button>
      </div>
      <div>
        <div class="panel-section-title">Brush Profile</div>
        <div style="display: flex; gap: 6px; margin-bottom: 10px;">
          <button class="action-pill btn-profile active" data-profile="ink" style="flex: 1; justify-content: center; height: 32px; font-size: 11px;">🖋️ Ink</button>
          <button class="action-pill btn-profile" data-profile="marker" style="flex: 1; justify-content: center; height: 32px; font-size: 11px;">🖍️ Marker</button>
          <button class="action-pill btn-profile" data-profile="pencil" style="flex: 1; justify-content: center; height: 32px; font-size: 11px;">✏️ Pencil</button>
        </div>
      </div>
      <div>
        <div class="panel-section-title">Color Swatches</div>
        <div class="swatch-grid">
          ${this.presetColors
            .map(
              (c) =>
                `<div class="color-swatch" data-color="${c}" style="background-color: ${c};"></div>`
            )
            .join('')}
        </div>
      </div>
      <div class="slider-group">
        <div class="slider-label">
          <span>Width</span>
          <span id="width-value">0.15</span>
        </div>
        <input id="slider-width" class="custom-range" type="range" min="0.03" max="0.5" step="0.01" value="0.15" />
      </div>
      <div class="slider-group">
        <div class="slider-label">
          <span>Opacity</span>
          <span id="opacity-value">100%</span>
        </div>
        <input id="slider-opacity" class="custom-range" type="range" min="0.1" max="1.0" step="0.05" value="1.0" />
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.rootElement.querySelector('#close-color-panel')?.addEventListener('click', () => {
      this.hide();
    });

    const profileBtns = this.rootElement.querySelectorAll('.btn-profile');
    profileBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        profileBtns.forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const prof = (target.dataset.profile || 'ink') as 'ink' | 'marker' | 'pencil';
        this.callbacks.onProfileSelect?.(prof);
      });
    });

    const swatches = this.rootElement.querySelectorAll('.color-swatch');
    swatches.forEach((el) => {
      el.addEventListener('click', (e) => {
        swatches.forEach((s) => s.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        const color = target.dataset.color || '#818cf8';
        this.callbacks.onColorSelect(color);
      });
    });

    const sliderWidth = this.rootElement.querySelector('#slider-width') as HTMLInputElement;
    const widthVal = this.rootElement.querySelector('#width-value') as HTMLElement;
    sliderWidth.addEventListener('input', () => {
      const val = parseFloat(sliderWidth.value);
      widthVal.textContent = val.toFixed(2);
      this.callbacks.onWidthChange(val);
    });

    const sliderOpacity = this.rootElement.querySelector('#slider-opacity') as HTMLInputElement;
    const opacityVal = this.rootElement.querySelector('#opacity-value') as HTMLElement;
    sliderOpacity.addEventListener('input', () => {
      const val = parseFloat(sliderOpacity.value);
      opacityVal.textContent = `${Math.round(val * 100)}%`;
      this.callbacks.onOpacityChange(val);
    });
  }
}
