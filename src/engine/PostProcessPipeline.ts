import { Scene, PerspectiveCamera, WebGPURenderer, RenderPipeline, Node, OperatorNode } from 'three/webgpu';
import { pass, toonOutlinePass } from 'three/tsl';
import { dof } from 'three/examples/jsm/tsl/display/DepthOfFieldNode.js';

export type PostFxMode = 'none' | 'dof' | 'toon' | 'all';

/**
 * WebGPU post-processing pipeline providing Depth of Field (LR-04) and Toon / Cel-Shading (LR-05).
 */
export class PostProcessPipeline {
  private readonly renderer: WebGPURenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly pipeline: RenderPipeline;

  private currentMode: PostFxMode = 'none';
  private focusDistance: number = 8.0;
  private focalLength: number = 35.0;
  private bokehScale: number = 2.0;

  /**
   * Initializes the post-processing pipeline for the scene and camera.
   *
   * @param renderer - WebGPURenderer instance
   * @param scene - Three.js Scene
   * @param camera - PerspectiveCamera
   */
  constructor(renderer: WebGPURenderer, scene: Scene, camera: PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.pipeline = new RenderPipeline(renderer);
    this.rebuildPipeline();
  }

  /**
   * Sets the active post-processing effect mode.
   *
   * @param mode - 'none' | 'dof' | 'toon' | 'all'
   */
  public setMode(mode: PostFxMode): void {
    this.currentMode = mode;
    this.rebuildPipeline();
  }

  /**
   * Returns currently active post-processing mode.
   */
  public getMode(): PostFxMode {
    return this.currentMode;
  }

  /**
   * Configures Depth of Field focal parameters.
   *
   * @param focusDistance - Focus distance along camera sightline in world units
   * @param focalLength - Focal length in mm / world units
   * @param bokehScale - Blur / bokeh circle scale
   */
  public setDofParams(focusDistance: number, focalLength: number = 35.0, bokehScale: number = 2.0): void {
    this.focusDistance = focusDistance;
    this.focalLength = focalLength;
    this.bokehScale = bokehScale;
    if (this.currentMode === 'dof' || this.currentMode === 'all') {
      this.rebuildPipeline();
    }
  }

  /**
   * Executes render pass using active pipeline or standard fallback.
   */
  public render(): void {
    if (this.currentMode === 'none') {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.pipeline.render();
    }
  }

  /**
   * Reconstructs the TSL node graph when effect mode or parameters change.
   */
  private rebuildPipeline(): void {
    if (this.currentMode === 'none') {
      return;
    }

    const scenePass = pass(this.scene, this.camera);
    const colorTexture = scenePass.getTextureNode();
    const viewZ = scenePass.getViewZNode();

    let output: Node = colorTexture;

    if (this.currentMode === 'dof') {
      output = dof(colorTexture, viewZ, this.focusDistance, this.focalLength, this.bokehScale) as unknown as Node;
    } else if (this.currentMode === 'toon') {
      const outline = toonOutlinePass(this.scene, this.camera, undefined, 0.004, 1.0);
      output = new OperatorNode('+', colorTexture, outline as unknown as Node);
    } else if (this.currentMode === 'all') {
      const dofNode = dof(colorTexture, viewZ, this.focusDistance, this.focalLength, this.bokehScale);
      const outline = toonOutlinePass(this.scene, this.camera, undefined, 0.004, 1.0);
      output = new OperatorNode('+', dofNode as unknown as Node, outline as unknown as Node);
    }

    this.pipeline.outputNode = output;
  }

  /**
   * Cleans up pipeline resources.
   */
  public dispose(): void {
    this.pipeline.dispose();
  }
}
