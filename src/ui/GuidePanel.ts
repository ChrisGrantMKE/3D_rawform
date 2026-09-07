import type { GuideType } from '../engine/GuideSurface';

export interface GuidePanelCallbacks {
  onSelectGuideType: (type: GuideType) => void;
  onDimensionsChanged: (radius: number, height: number) => void;
  onToggleGuideVisibility: (visible: boolean) => void;
  onSelectMirrorAxis: (axis: 'x' | 'y' | 'z' | null) => void;
  onImportImage: (file: File) => void;
  onImportModel: (file: File) => void;
}

/**
 * Floating panel for configuring 3D curved guide surfaces, live mirror symmetry, and reference assets.
 */
export class GuidePanel {
  private readonly container: HTMLElement;
  private readonly rootElement: HTMLElement;
  private readonly callbacks: GuidePanelCallbacks;
  private isVisible: boolean = false;
  private currentGuideType: GuideType = 'none';
  private currentMirrorAxis: 'x' | 'y' | 'z' | null = null;

  constructor(container: HTMLElement, callbacks: GuidePanelCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.rootElement = document.createElement('div');
    this.rootElement.className = 'guide-panel glass-panel floating-panel ui-interactive';
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

  public getGuideType(): GuideType {
    return this.currentGuideType;
  }

  public getMirrorAxis(): 'x' | 'y' | 'z' | null {
    return this.currentMirrorAxis;
  }

  public dispose(): void {
    this.rootElement.remove();
  }

  private render(): void {
    this.rootElement.innerHTML = `
      <div class="panel-header">
        <span>3D Guides & Symmetry</span>
        <button id="close-guide-panel" class="small-btn">✕</button>
      </div>

      <div class="panel-section-title">3D Curved Guide Surfaces</div>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px;">
        <button class="action-pill guide-type-btn active" data-type="none" style="justify-content: center; font-size: 11px;">Off</button>
        <button class="action-pill guide-type-btn" data-type="sphere" style="justify-content: center; font-size: 11px;">🌐 Sphere</button>
        <button class="action-pill guide-type-btn" data-type="cylinder" style="justify-content: center; font-size: 11px;">🥫 Cylinder</button>
        <button class="action-pill guide-type-btn" data-type="cone" style="justify-content: center; font-size: 11px;">📐 Cone</button>
        <button class="action-pill guide-type-btn" data-type="torus" style="justify-content: center; font-size: 11px;">🍩 Torus</button>
        <button class="action-pill guide-type-btn" data-type="plane" style="justify-content: center; font-size: 11px;">📄 Plane</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--color-text-secondary);">
          <span>Guide Radius</span>
          <span id="radius-val">3.0m</span>
        </div>
        <input type="range" id="guide-radius" min="1.0" max="8.0" step="0.2" value="3.0" />

        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--color-text-secondary);">
          <span>Guide Height</span>
          <span id="height-val">6.0m</span>
        </div>
        <input type="range" id="guide-height" min="1.0" max="12.0" step="0.5" value="6.0" />
      </div>

      <div class="panel-section-title">Live Mirror / Symmetry</div>
      <div style="display: flex; gap: 6px; margin-bottom: 12px;">
        <button class="action-pill mirror-axis-btn active" data-axis="none" style="flex: 1; justify-content: center; font-size: 11px;">Off</button>
        <button class="action-pill mirror-axis-btn" data-axis="x" style="flex: 1; justify-content: center; font-size: 11px;">X (L/R)</button>
        <button class="action-pill mirror-axis-btn" data-axis="y" style="flex: 1; justify-content: center; font-size: 11px;">Y (T/B)</button>
        <button class="action-pill mirror-axis-btn" data-axis="z" style="flex: 1; justify-content: center; font-size: 11px;">Z (F/B)</button>
      </div>

      <div class="panel-section-title">Reference Imports</div>
      <div style="display: flex; gap: 6px;">
        <button id="btn-import-img" class="action-pill" style="flex: 1; justify-content: center; font-size: 11px;">🖼️ Ref Image</button>
        <button id="btn-import-model" class="action-pill" style="flex: 1; justify-content: center; font-size: 11px;">🗿 Ref 3D Model</button>
      </div>
      <input type="file" id="input-file-img" accept="image/*" style="display: none;" />
      <input type="file" id="input-file-model" accept=".glb,.gltf" style="display: none;" />
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.rootElement.querySelector('#close-guide-panel')?.addEventListener('click', () => {
      this.hide();
    });

    const typeBtns = this.rootElement.querySelectorAll<HTMLButtonElement>('.guide-type-btn');
    typeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type') as GuideType;
        this.currentGuideType = type;
        typeBtns.forEach((b) => b.classList.toggle('active', b === btn));
        this.callbacks.onSelectGuideType(type);
      });
    });

    const radiusInput = this.rootElement.querySelector<HTMLInputElement>('#guide-radius');
    const heightInput = this.rootElement.querySelector<HTMLInputElement>('#guide-height');
    const radiusVal = this.rootElement.querySelector('#radius-val');
    const heightVal = this.rootElement.querySelector('#height-val');

    const updateDims = () => {
      const r = parseFloat(radiusInput?.value || '3.0');
      const h = parseFloat(heightInput?.value || '6.0');
      if (radiusVal) radiusVal.textContent = `${r.toFixed(1)}m`;
      if (heightVal) heightVal.textContent = `${h.toFixed(1)}m`;
      this.callbacks.onDimensionsChanged(r, h);
    };

    radiusInput?.addEventListener('input', updateDims);
    heightInput?.addEventListener('input', updateDims);

    const mirrorBtns = this.rootElement.querySelectorAll<HTMLButtonElement>('.mirror-axis-btn');
    mirrorBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const axisRaw = btn.getAttribute('data-axis');
        const axis = axisRaw === 'none' ? null : (axisRaw as 'x' | 'y' | 'z');
        this.currentMirrorAxis = axis;
        mirrorBtns.forEach((b) => b.classList.toggle('active', b === btn));
        this.callbacks.onSelectMirrorAxis(axis);
      });
    });

    const imgInput = this.rootElement.querySelector<HTMLInputElement>('#input-file-img');
    const modelInput = this.rootElement.querySelector<HTMLInputElement>('#input-file-model');

    this.rootElement.querySelector('#btn-import-img')?.addEventListener('click', () => {
      imgInput?.click();
    });

    this.rootElement.querySelector('#btn-import-model')?.addEventListener('click', () => {
      modelInput?.click();
    });

    imgInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        this.callbacks.onImportImage(files[0]);
        imgInput.value = '';
      }
    });

    modelInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        this.callbacks.onImportModel(files[0]);
        modelInput.value = '';
      }
    });
  }
}
