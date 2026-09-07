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

    return meshLine;
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
  }

  /**
   * Disposes the entire stroke renderer group.
   */
  public dispose(): void {
    this.clear();
    this.scene.remove(this.strokeGroup);
  }
}
