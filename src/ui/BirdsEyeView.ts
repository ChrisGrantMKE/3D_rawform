export interface MinimapCanvasItem {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  angle: number; // yaw in radians
  isActive: boolean;
}

export interface MinimapCameraState {
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  angle: number;
  fov: number;
}

export interface BirdsEyeViewCallbacks {
  onNavigateTo?: (worldX: number, worldZ: number) => void;
  onSelectCanvas?: (id: string) => void;
  onClose?: () => void;
}

/**
 * Top-down 2D radar minimap providing bird's-eye spatial orientation of canvases and camera.
 * Pure DOM + HTML5 2D Canvas component with zero Three.js dependencies.
 */
export class BirdsEyeView {
  private readonly container: HTMLElement;
  private readonly rootElement: HTMLElement;
  private readonly canvasElement: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: BirdsEyeViewCallbacks;

  private isVisible: boolean = true;
  private viewScale: number = 7.0; // pixels per world unit
  private width: number = 200;
  private height: number = 200;

  private canvases: MinimapCanvasItem[] = [];
  private cameraState: MinimapCameraState | null = null;

  constructor(parent: HTMLElement, callbacks: BirdsEyeViewCallbacks = {}) {
    this.container = parent;
    this.callbacks = callbacks;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'birds-eye-panel glass-panel ui-interactive';
    this.rootElement.innerHTML = `
      <div class="minimap-header">
        <span class="minimap-title">🧭 Bird's Eye</span>
        <div class="minimap-actions">
          <button id="btn-minimap-zoom-in" class="mini-icon-btn" title="Zoom In">+</button>
          <button id="btn-minimap-zoom-out" class="mini-icon-btn" title="Zoom Out">−</button>
          <button id="btn-minimap-close" class="mini-icon-btn" title="Close Minimap">✕</button>
        </div>
      </div>
      <canvas id="birds-eye-canvas" width="${this.width}" height="${this.height}"></canvas>
    `;

    this.canvasElement = this.rootElement.querySelector('#birds-eye-canvas') as HTMLCanvasElement;
    this.ctx = this.canvasElement.getContext('2d')!;

    this.setupListeners();
    this.container.appendChild(this.rootElement);
    this.draw();
  }

  /**
   * Toggles minimap visibility.
   */
  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.rootElement.style.display = this.isVisible ? 'flex' : 'none';
    if (this.isVisible) this.draw();
  }

  /**
   * Sets visibility explicitly.
   */
  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.rootElement.style.display = this.isVisible ? 'flex' : 'none';
    if (this.isVisible) this.draw();
  }

  /**
   * Checks if minimap is visible.
   */
  public getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Updates state with current canvas list and camera.
   */
  public update(canvases: MinimapCanvasItem[], camera: MinimapCameraState): void {
    this.canvases = canvases;
    this.cameraState = camera;
    if (this.isVisible) {
      this.draw();
    }
  }

  private setupListeners(): void {
    this.rootElement.querySelector('#btn-minimap-close')?.addEventListener('click', () => {
      this.setVisible(false);
      this.callbacks.onClose?.();
    });

    this.rootElement.querySelector('#btn-minimap-zoom-in')?.addEventListener('click', () => {
      this.viewScale = Math.min(25, this.viewScale * 1.3);
      this.draw();
    });

    this.rootElement.querySelector('#btn-minimap-zoom-out')?.addEventListener('click', () => {
      this.viewScale = Math.max(2, this.viewScale / 1.3);
      this.draw();
    });

    this.canvasElement.addEventListener('pointerdown', (e) => {
      const rect = this.canvasElement.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const worldX = (px - centerX) / this.viewScale;
      const worldZ = (py - centerY) / this.viewScale;

      this.callbacks.onNavigateTo?.(worldX, worldZ);
    });
  }

  /**
   * Redraws the 2D minimap scene.
   */
  public draw(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // 1. Radar background circle & grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Grid circles
    for (let r = 25; r < w / 2; r += 25) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // 2. Render spatial canvases
    for (const canvas of this.canvases) {
      const x = cx + canvas.x * this.viewScale;
      const z = cy + canvas.z * this.viewScale;
      const halfW = (canvas.width * this.viewScale) / 2;

      ctx.save();
      ctx.translate(x, z);
      ctx.rotate(canvas.angle);

      ctx.strokeStyle = canvas.isActive ? '#818cf8' : '#64748b';
      ctx.lineWidth = canvas.isActive ? 2.5 : 1.5;

      // Plane line in XZ
      ctx.beginPath();
      ctx.moveTo(-halfW, 0);
      ctx.lineTo(halfW, 0);
      ctx.stroke();

      // Normal indicator tick
      ctx.strokeStyle = canvas.isActive ? '#a5b4fc' : '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -6);
      ctx.stroke();

      ctx.restore();
    }

    // 3. Render camera position & frustum
    if (this.cameraState) {
      const camX = cx + this.cameraState.x * this.viewScale;
      const camZ = cy + this.cameraState.z * this.viewScale;
      const targetX = cx + this.cameraState.targetX * this.viewScale;
      const targetZ = cy + this.cameraState.targetZ * this.viewScale;

      // Frustum cone
      const coneLength = 36;
      const halfFovRad = ((this.cameraState.fov / 2) * Math.PI) / 180;
      const forwardAngle = Math.atan2(targetZ - camZ, targetX - camX);

      ctx.save();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(camX, camZ);
      ctx.lineTo(
        camX + Math.cos(forwardAngle - halfFovRad) * coneLength,
        camZ + Math.sin(forwardAngle - halfFovRad) * coneLength
      );
      ctx.lineTo(
        camX + Math.cos(forwardAngle + halfFovRad) * coneLength,
        camZ + Math.sin(forwardAngle + halfFovRad) * coneLength
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Camera dot
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(camX, camZ, 4, 0, Math.PI * 2);
      ctx.fill();

      // Target focal point
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(targetX, targetZ, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Disposes the minimap DOM.
   */
  public dispose(): void {
    if (this.rootElement.parentElement) {
      this.rootElement.parentElement.removeChild(this.rootElement);
    }
  }
}
