import {
  Scene,
  PerspectiveCamera,
  WebGPURenderer,
  AmbientLight,
  DirectionalLight,
  Color,
} from 'three/webgpu';
import { CameraController } from './CameraController';
import { PostProcessPipeline, type PostFxMode } from './PostProcessPipeline';
import { AtmosphereEnvironment } from './AtmosphereEnvironment';

export type BackgroundStyle = 'dark' | 'studio' | 'light' | 'transparent';
export type { PostFxMode };

/**
 * Manages the Three.js WebGPU scene, lighting, camera, and render loop.
 */
export class SceneManager {
  public readonly scene: Scene;
  public readonly camera: PerspectiveCamera;
  public readonly renderer: WebGPURenderer;
  public readonly cameraController: CameraController;
  public readonly postProcess: PostProcessPipeline;
  public readonly atmosphere: AtmosphereEnvironment;

  private readonly container: HTMLElement;
  private lastFrameTime: number = performance.now();
  private updateCallbacks: Array<(deltaTime: number) => void> = [];

  /**
   * Initializes the 3D scene, WebGPU renderer, and lights inside the given container.
   *
   * @param container - HTML container element to mount the canvas
   */
  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new Scene();
    this.scene.background = new Color(0x0a0c10);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 4, 12);

    this.cameraController = new CameraController(this.camera);

    this.renderer = new WebGPURenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.container.appendChild(this.renderer.domElement);

    this.postProcess = new PostProcessPipeline(this.renderer, this.scene, this.camera);

    this.atmosphere = new AtmosphereEnvironment();
    this.scene.add(this.atmosphere.getObject());

    this.setupLighting();
    this.setupResizeListener();
  }

  /**
   * Initializes WebGPU backend asynchronously and kicks off the render loop.
   */
  public async init(): Promise<void> {
    await this.renderer.init();
    this.startLoop();
  }

  /**
   * Adds a per-frame update callback to the render loop.
   *
   * @param callback - Function invoked every frame with deltaTime in seconds
   */
  public onUpdate(callback: (deltaTime: number) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Handles container resize and updates camera aspect ratio.
   */
  public handleResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Performs an immediate synchronous render pass.
   */
  public render(): void {
    this.postProcess.render();
  }

  /**
   * Sets the active post-processing effect mode.
   *
   * @param mode - 'none' | 'dof' | 'toon' | 'all'
   */
  public setPostFxMode(mode: PostFxMode): void {
    this.postProcess.setMode(mode);
  }

  /**
   * Disposes of the renderer and listeners.
   */
  public dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.postProcess.dispose();
    this.atmosphere.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }

  /**
   * Sets the 3D scene background style.
   *
   * @param style - 'dark', 'studio', 'light', or 'transparent'
   */
  public setBackgroundStyle(style: BackgroundStyle): void {
    switch (style) {
      case 'dark':
        this.scene.background = new Color(0x0a0c10);
        this.atmosphere.setVisible(true);
        break;
      case 'studio':
        this.scene.background = new Color(0x181e28);
        this.atmosphere.setVisible(true);
        break;
      case 'light':
        this.scene.background = new Color(0xf1f5f9);
        this.atmosphere.setVisible(false);
        break;
      case 'transparent':
        this.scene.background = null;
        this.atmosphere.setVisible(false);
        break;
    }
  }

  /**
   * Sets up environment lighting.
   */
  private setupLighting(): void {
    const ambientLight = new AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight = new DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    this.scene.add(dirLight);
  }

  /**
   * Configures window resize event handling.
   */
  private setupResizeListener(): void {
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Starts the Three.js animation loop.
   */
  private startLoop(): void {
    this.renderer.setAnimationLoop(() => {
      const now = performance.now();
      const deltaTime = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      this.cameraController.update(deltaTime);

      for (const cb of this.updateCallbacks) {
        cb(deltaTime);
      }

      this.postProcess.render();
    });
  }
}
