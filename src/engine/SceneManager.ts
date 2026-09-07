import {
  Scene,
  PerspectiveCamera,
  WebGPURenderer,
  AmbientLight,
  DirectionalLight,
  GridHelper,
  Color,
} from 'three/webgpu';
import { CameraController } from './CameraController';

/**
 * Manages the Three.js WebGPU scene, lighting, camera, and render loop.
 */
export class SceneManager {
  public readonly scene: Scene;
  public readonly camera: PerspectiveCamera;
  public readonly renderer: WebGPURenderer;
  public readonly cameraController: CameraController;

  private readonly container: HTMLElement;
  private readonly gridHelper: GridHelper;
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

    this.gridHelper = new GridHelper(20, 20, 0x21262d, 0x161b22);
    this.gridHelper.position.y = -2;
    this.scene.add(this.gridHelper);

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
   * Disposes of the renderer and listeners.
   */
  public dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
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

      this.renderer.render(this.scene, this.camera);
    });
  }
}
