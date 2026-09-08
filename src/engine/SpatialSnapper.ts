import { Vector3, Raycaster, Vector2, PerspectiveCamera, Box3, Line3 } from 'three/webgpu';

export interface SnapTargetResult {
  hitPoint: Vector3;
  distanceToCamera: number;
  strokeId: string;
}

export interface StrokeSegmentRecord {
  strokeId: string;
  points: Vector3[];
  bbox: Box3;
}

/**
 * Intelligent spatial snapper with distance-weighted screen-space tolerance.
 * Automatically finds clicked or nearby existing strokes/objects and prioritizes
 * the candidate nearest to the observer in depth.
 */
export class SpatialSnapper {
  private readonly strokeRecords: Map<string, StrokeSegmentRecord> = new Map();
  private readonly raycaster: Raycaster = new Raycaster();
  private readonly ndc: Vector2 = new Vector2();
  private readonly tempLine: Line3 = new Line3();
  private readonly tempPoint: Vector3 = new Vector3();
  private readonly tempRayPoint: Vector3 = new Vector3();

  /**
   * Registers a stroke's 3D points and bounding volume for snapping queries.
   */
  public registerStroke(strokeId: string, points: Vector3[]): void {
    if (points.length < 2) return;
    const bbox = new Box3();
    for (const p of points) {
      bbox.expandByPoint(p);
    }
    this.strokeRecords.set(strokeId, {
      strokeId,
      points: points.map((p) => p.clone()),
      bbox,
    });
  }

  /**
   * Removes a stroke from snapping registry.
   */
  public unregisterStroke(strokeId: string): void {
    this.strokeRecords.delete(strokeId);
  }

  /**
   * Clears all registered strokes.
   */
  public clear(): void {
    this.strokeRecords.clear();
  }

  /**
   * Evaluates screen pointer coordinates against existing strokes using distance-scaled error correction.
   * Disambiguates overlapping candidates by selecting the nearest object to the camera observer.
   *
   * @param screenX - Screen pixel X coordinate
   * @param screenY - Screen pixel Y coordinate
   * @param camera - Active PerspectiveCamera
   * @param viewportWidth - Screen viewport width in pixels
   * @param viewportHeight - Screen viewport height in pixels
   * @param pixelTolerance - Screen-space snap tolerance radius in pixels (default 24px)
   * @returns SnapTargetResult or null if no candidate within tolerance
   */
  public findSnapTarget(
    screenX: number,
    screenY: number,
    camera: PerspectiveCamera,
    viewportWidth: number,
    viewportHeight: number,
    pixelTolerance: number = 24
  ): SnapTargetResult | null {
    if (this.strokeRecords.size === 0) return null;

    this.ndc.x = (screenX / viewportWidth) * 2 - 1;
    this.ndc.y = -(screenY / viewportHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, camera);
    const ray = this.raycaster.ray;

    const tanHalfFov = Math.tan(((camera.fov / 2) * Math.PI) / 180);
    const pxScaleFactor = (pixelTolerance / viewportHeight) * 2 * tanHalfFov;

    let bestCandidate: SnapTargetResult | null = null;
    let minCameraDist = Infinity;

    for (const record of this.strokeRecords.values()) {
      // Fast bounding box distance rejection
      const bboxCenter = record.bbox.getCenter(this.tempPoint);
      const distToRay = ray.distanceToPoint(bboxCenter);
      const bboxRadius = record.bbox.min.distanceTo(record.bbox.max) / 2;
      const tCenter = this.tempRayPoint.copy(bboxCenter).sub(camera.position).dot(ray.direction);
      const maxPossibleTol = Math.max(0.5, Math.abs(tCenter) * pxScaleFactor);

      if (distToRay > bboxRadius + maxPossibleTol) {
        continue;
      }

      // Check segments along the stroke
      const pts = record.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i];
        const p1 = pts[i + 1];
        this.tempLine.set(p0, p1);

        const mid = this.tempLine.getCenter(this.tempPoint);
        ray.closestPointToPoint(mid, this.tempRayPoint);

        const t = this.tempRayPoint.clone().sub(camera.position).dot(ray.direction);
        if (t <= 0.2) continue; // Behind or right against near plane

        const worldTolerance = t * pxScaleFactor;

        // Find closest point on segment to ray
        const closestOnSeg = new Vector3();
        this.tempLine.closestPointToPoint(this.tempRayPoint, true, closestOnSeg);

        // Distance from segment to ray line
        ray.closestPointToPoint(closestOnSeg, this.tempRayPoint);
        const distance3D = closestOnSeg.distanceTo(this.tempRayPoint);

        if (distance3D <= worldTolerance) {
          // Disambiguate: prioritize nearest candidate to the observer
          if (t < minCameraDist) {
            minCameraDist = t;
            bestCandidate = {
              hitPoint: closestOnSeg.clone(),
              distanceToCamera: t,
              strokeId: record.strokeId,
            };
          }
        }
      }
    }

    return bestCandidate;
  }
}
