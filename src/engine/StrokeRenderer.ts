import { Group, Scene, Object3D } from 'three/webgpu';
import { MeshLine } from 'makio-meshline';
import type { StrokeData, StrokePoint } from '../types/stroke';

/**
 * Renders spatial 3D ribbon strokes using WebGPU-native Makio MeshLine.
 */
export class StrokeRenderer {
  private readonly scene: Scene;
  private readonly strokeGroup: Group;
  private readonly strokeMeshMap: Map<string, MeshLine>;
  private activeMeshLine: MeshLine | null = null;
  private activeMirrorMeshLine: MeshLine | null = null;

  /**
   * Initializes the stroke renderer attached to the scene.
   *
   * @param scene - Three.js scene container
   */
  constructor(scene: Scene) {
    this.scene = scene;
    this.strokeGroup = new Group();
    this.strokeGroup.name = 'StrokeRenderer_Group';
    this.scene.add(this.strokeGroup);
    this.strokeMeshMap = new Map();
    this.strokeBaseOpacity = new Map();
    this.strokeCanvasMap = new Map();
  }

  private readonly strokeBaseOpacity: Map<string, number>;
  private readonly strokeCanvasMap: Map<string, string>;

  /**
   * Returns a map of all rendered stroke meshes.
   */
  public getStrokeMeshMap(): Map<string, MeshLine> {
    return this.strokeMeshMap;
  }

  /**
   * Begins rendering an interactive, in-progress stylus stroke.
   *
   * @param initialPoint - Starting stroke point in 3D world coordinates
   * @param color - Stroke hex color string
   * @param baseWidth - Base ribbon width
   * @param opacity - Stroke opacity (0.0 to 1.0)
   */
  public beginStroke(
    initialPoint: StrokePoint,
    color: string,
    baseWidth: number,
    opacity: number = 1.0
  ): void {
    // Initialize with a duplicated point to form a valid initial segment
    const coords: [number, number, number][] = [
      [initialPoint.x, initialPoint.y, initialPoint.z],
      [initialPoint.x + 0.0001, initialPoint.y, initialPoint.z],
    ];

    const meshLine = new MeshLine({
      lineWidth: baseWidth,
      color: color,
      opacity: opacity,
      transparent: opacity < 1.0,
      sizeAttenuation: true,
      dynamic: true,
    });

    meshLine.lines(coords);
    meshLine.build();

    this.activeMeshLine = meshLine;
    this.strokeGroup.add(meshLine as unknown as Object3D);
  }

  /**
   * Appends points to the currently active stroke and updates GPU geometry.
   *
   * @param points - Array of newly sampled and smoothed points
   */
  public updateActiveStroke(points: StrokePoint[]): void {
    if (!this.activeMeshLine || points.length < 2) {
      return;
    }

    const coords: [number, number, number][] = points.map((p) => [p.x, p.y, p.z]);
    this.activeMeshLine.setPositions(coords);
  }

  /**
   * Completes the active stroke, freezes its geometry, and registers its ID.
   *
   * @param strokeId - Unique identifier for the completed stroke
   * @returns The registered MeshLine instance or null if no stroke was active
   */
  public endStroke(strokeId: string): MeshLine | null {
    if (!this.activeMeshLine) {
      return null;
    }

    const completed = this.activeMeshLine;
    completed.name = `Stroke_${strokeId}`;
    completed.dynamic(false);

    this.strokeMeshMap.set(strokeId, completed);
    this.activeMeshLine = null;

    return completed;
  }

  /**
   * Renders a saved stroke directly from stored stroke data.
   *
   * @param data - Saved stroke record
   * @param points - Array of points representing the stroke
   * @returns Created MeshLine
   */
  public renderStoredStroke(data: StrokeData, points: StrokePoint[]): MeshLine | null {
    if (points.length < 2) {
      return null;
    }

    const coords: [number, number, number][] = points.map((p) => [p.x, p.y, p.z]);
    const meshLine = new MeshLine({
      lineWidth: data.width,
      color: data.color,
      opacity: data.opacity,
      transparent: data.opacity < 1.0,
      sizeAttenuation: true,
      dynamic: false,
    });

    meshLine.lines(coords);
    meshLine.build();
    meshLine.name = `Stroke_${data.id}`;

    this.strokeGroup.add(meshLine as unknown as Object3D);
    this.strokeMeshMap.set(data.id, meshLine);
    this.registerStrokeCanvas(data.id, data.canvasId, data.opacity);

    return meshLine;
  }

  /**
   * Associates a stroke with its owning canvas and base opacity.
   *
   * @param strokeId - Unique stroke identifier
   * @param canvasId - Owning canvas identifier
   * @param baseOpacity - Original base opacity of stroke
   */
  public registerStrokeCanvas(strokeId: string, canvasId: string, baseOpacity: number = 1.0): void {
    this.strokeCanvasMap.set(strokeId, canvasId);
    this.strokeBaseOpacity.set(strokeId, baseOpacity);
  }

  /**
   * Updates geometry and positions for an existing stored stroke.
   *
   * @param stroke - Stored stroke metadata
   * @param points - Updated stroke points
   */
  public updateStoredStroke(stroke: StrokeData, points: StrokePoint[]): void {
    if (points.length < 2) {
      return;
    }
    this.removeStroke(stroke.id);
    this.renderStoredStroke(stroke, points);
  }

  /**
   * Updates opacity of all strokes dynamically based on their canvas angle facing factor.
   *
   * @param getCanvasFacing - Lookup function returning facing factor (0.0 to 1.0) given a canvasId
   */
  public updateAngleOpacities(getCanvasFacing: (canvasId: string) => number): void {
    for (const [strokeId, meshLine] of this.strokeMeshMap) {
      const canvasId = this.strokeCanvasMap.get(strokeId);
      if (!canvasId) continue;
      const facing = getCanvasFacing(canvasId);
      const baseOpacity = this.strokeBaseOpacity.get(strokeId) ?? 1.0;
      const targetOpacity = Math.max(0.01, baseOpacity * facing);
      const mat = meshLine.material;
      if (mat && !Array.isArray(mat)) {
        mat.opacity = targetOpacity;
        mat.transparent = true;
      }
    }
  }

  /**
   * Removes a stroke from the scene and disposes its GPU resources.
   *
   * @param strokeId - Unique identifier of the stroke to remove
   */
  public removeStroke(strokeId: string): void {
    const meshLine = this.strokeMeshMap.get(strokeId);
    if (!meshLine) {
      return;
    }

    this.strokeGroup.remove(meshLine as unknown as Object3D);
    meshLine.dispose();
    this.strokeMeshMap.delete(strokeId);
    this.strokeCanvasMap.delete(strokeId);
    this.strokeBaseOpacity.delete(strokeId);
  }

  /**
   * Begins rendering an interactive mirrored stylus stroke in real-time.
   */
  public beginMirrorStroke(
    initialPoint: StrokePoint,
    color: string,
    baseWidth: number,
    opacity: number = 1.0
  ): void {
    const coords: [number, number, number][] = [
      [initialPoint.x, initialPoint.y, initialPoint.z],
      [initialPoint.x + 0.0001, initialPoint.y, initialPoint.z],
    ];

    const meshLine = new MeshLine({
      lineWidth: baseWidth,
      color: color,
      opacity: opacity,
      transparent: opacity < 1.0,
      sizeAttenuation: true,
      dynamic: true,
    });

    meshLine.lines(coords);
    meshLine.build();

    this.activeMirrorMeshLine = meshLine;
    this.strokeGroup.add(meshLine as unknown as Object3D);
  }

  /**
   * Updates coordinates of the active mirror stroke.
   */
  public updateActiveMirrorStroke(points: StrokePoint[]): void {
    if (!this.activeMirrorMeshLine || points.length < 2) return;
    const coords: [number, number, number][] = points.map((p) => [p.x, p.y, p.z]);
    this.activeMirrorMeshLine.setPositions(coords);
  }

  /**
   * Finalizes active mirror stroke and registers ID.
   */
  public endMirrorStroke(strokeId: string): MeshLine | null {
    if (!this.activeMirrorMeshLine) return null;
    const completed = this.activeMirrorMeshLine;
    completed.name = `Stroke_${strokeId}`;
    completed.dynamic(false);
    this.strokeMeshMap.set(strokeId, completed);
    this.activeMirrorMeshLine = null;
    return completed;
  }

  /**
   * Cancels any currently active in-progress stroke without saving.
   */
  public cancelActiveStroke(): void {
    if (this.activeMeshLine) {
      this.strokeGroup.remove(this.activeMeshLine as unknown as Object3D);
      this.activeMeshLine.dispose();
      this.activeMeshLine = null;
    }
    if (this.activeMirrorMeshLine) {
      this.strokeGroup.remove(this.activeMirrorMeshLine as unknown as Object3D);
      this.activeMirrorMeshLine.dispose();
      this.activeMirrorMeshLine = null;
    }
  }

  /**
   * Clears all strokes and disposes resources.
   */
  public clear(): void {
    this.cancelActiveStroke();
    for (const [, meshLine] of this.strokeMeshMap) {
      this.strokeGroup.remove(meshLine as unknown as Object3D);
      meshLine.dispose();
    }
    this.strokeMeshMap.clear();
    this.strokeCanvasMap.clear();
    this.strokeBaseOpacity.clear();
  }

  /**
   * Disposes the entire stroke renderer group.
   */
  public dispose(): void {
    this.clear();
    this.scene.remove(this.strokeGroup);
  }
}
