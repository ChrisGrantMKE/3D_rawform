import type { BrushProfile } from '../types/stroke';

export interface BrushEditorCallbacks {
  onProfileUpdate: (profile: BrushProfile) => void;
}

/**
 * Floating panel for editing custom brush profiles (tension, pressure sensitivity, width ratios).
 */
export class BrushEditorPanel {
  private readonly container: HTMLElement;
  private readonly rootElement: HTMLElement;
  private readonly callbacks: BrushEditorCallbacks;

  private isVisible: boolean = false;
  private currentProfile: BrushProfile;

  constructor(container: HTMLElement, initialProfile: BrushProfile, callbacks: BrushEditorCallbacks) {
    this.container = container;
    this.currentProfile = { ...initialProfile };
    this.callbacks = callbacks;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'floating-panel brush-editor-panel glass-panel ui-interactive';
    this.rootElement.style.display = 'none';
    this.rootElement.style.top = '70px';
    this.rootElement.style.right = '280px';
    this.rootElement.style.width = '260px';

    this.render();
    this.container.appendChild(this.rootElement);
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.rootElement.style.display = this.isVisible ? 'flex' : 'none';
  }

  public updateProfile(profile: BrushProfile): void {
    this.currentProfile = { ...profile };
    this.syncUI();
  }

  private render(): void {
    this.rootElement.innerHTML = `
      <div class="panel-header">
        <h3 class="panel-title">Brush Editor</h3>
        <button id="btn-close-brush-editor" class="small-btn">✕</button>
      </div>
      <div class="panel-content">
        <div class="control-group">
          <label>Min Width Ratio: <span id="lbl-min-width">${this.currentProfile.minWidthRatio.toFixed(2)}</span></label>
          <input id="slider-min-width" type="range" min="0" max="1" step="0.05" value="${this.currentProfile.minWidthRatio}">
        </div>
        <div class="control-group">
          <label>Max Width Ratio: <span id="lbl-max-width">${this.currentProfile.maxWidthRatio.toFixed(2)}</span></label>
          <input id="slider-max-width" type="range" min="1" max="5" step="0.1" value="${this.currentProfile.maxWidthRatio}">
        </div>
        <div class="control-group">
          <label>Pressure Sensitivity: <span id="lbl-pressure">${this.currentProfile.pressureSensitivity.toFixed(2)}</span></label>
          <input id="slider-pressure" type="range" min="0" max="2" step="0.1" value="${this.currentProfile.pressureSensitivity}">
        </div>
        <div class="control-group">
          <label>Smoothing Tension: <span id="lbl-tension">${this.currentProfile.smoothingTension.toFixed(2)}</span></label>
          <input id="slider-tension" type="range" min="0" max="1" step="0.05" value="${this.currentProfile.smoothingTension}">
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.rootElement.querySelector('#btn-close-brush-editor')?.addEventListener('click', () => {
      this.toggle();
    });

    const bindSlider = (id: string, labelId: string, key: keyof BrushProfile) => {
      const slider = this.rootElement.querySelector(`#${id}`) as HTMLInputElement;
      const label = this.rootElement.querySelector(`#${labelId}`) as HTMLElement;
      slider.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        label.textContent = val.toFixed(2);
        (this.currentProfile as any)[key] = val;
        this.callbacks.onProfileUpdate(this.currentProfile);
      });
    };

    bindSlider('slider-min-width', 'lbl-min-width', 'minWidthRatio');
    bindSlider('slider-max-width', 'lbl-max-width', 'maxWidthRatio');
    bindSlider('slider-pressure', 'lbl-pressure', 'pressureSensitivity');
    bindSlider('slider-tension', 'lbl-tension', 'smoothingTension');
  }

  private syncUI(): void {
    if (!this.rootElement) return;
    
    const updateSlider = (id: string, labelId: string, val: number) => {
      const slider = this.rootElement.querySelector(`#${id}`) as HTMLInputElement;
      const label = this.rootElement.querySelector(`#${labelId}`) as HTMLElement;
      if (slider && label) {
        slider.value = val.toString();
        label.textContent = val.toFixed(2);
      }
    };

    updateSlider('slider-min-width', 'lbl-min-width', this.currentProfile.minWidthRatio);
    updateSlider('slider-max-width', 'lbl-max-width', this.currentProfile.maxWidthRatio);
    updateSlider('slider-pressure', 'lbl-pressure', this.currentProfile.pressureSensitivity);
    updateSlider('slider-tension', 'lbl-tension', this.currentProfile.smoothingTension);
  }
}
