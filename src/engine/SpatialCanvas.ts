import {
  Group,
  Plane,
  Vector3,
  Vector2,
  LineSegments,
  LineBasicMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Ray,
} from 'three/webgpu';
import type { SpatialCanvasData, SpatialPlaneType } from '../types/canvas';

/**
 * 2D planar drawing canvas situated in 3D world space.
 */
export class SpatialCanvas {
  public readonly id: string;
  public name: string;
  public planeType: SpatialPlaneType;
  public width: number;
  public height: number;
  public isVisible: boolean = true;
  public isLocked: boolean = false;

  private readonly group: Group;
  private readonly plane: Plane;
  private outlineMesh: LineSegments;
  private hitPlaneMesh: Mesh;

  /**
   * Initializes a spatial canvas with dimensions and transform.
   *
   * @param data - Initial spatial canvas configuration data
   */
  constructor(data: SpatialCanvasData) {
    this.id = data.id;
    this.name = data.name;
    this.planeType = data.planeType;
    this.width = data.width;
    this.height = data.height;

    this.group = new Group();
    this.group.name = `SpatialCanvas_${this.id}`;
    this.plane = new Plane();

    this.outlineMesh = this.createOutline(data.width, data.height);
    this.outlineMesh.visible = false;
    this.hitPlaneMesh = this.createHitPlane(data.width, data.height);

    this.group.add(this.outlineMesh);
    this.group.add(this.hitPlaneMesh);

    this.setPosition(new Vector3(...data.position));
    this.setRotation(data.rotation);
    this.updatePlane();
  }

  /**
   * Raycasts a 3D ray against this spatial canvas plane.
   * By default, permits unbounded spatial sketching across the entire plane.
   *
   * @param ray - Three.js Ray in world coordinates
   * @param bounded - Whether to restrict raycast strictly to current visual grid
   * @returns Intersection point in world coordinates or null
   */
  public intersectRay(ray: Ray, bounded: boolean = false): Vector3 | null {
    if (!this.isVisible || this.isLocked) {
      return null;
    }

    const intersection = new Vector3();
    const hit = ray.intersectPlane(this.plane, intersection);
    if (!hit) {
      return null;
    }

    if (bounded) {
      const localPoint = this.projectWorldToLocal(intersection);
      const halfW = this.width / 2;
      const halfH = this.height / 2;

      if (Math.abs(localPoint.x) > halfW || Math.abs(localPoint.y) > halfH) {
        return null;
      }
    }

    return intersection;
  }

  /**
   * Dynamically expands canvas grid bounds to encapsulate newly drawn strokes.
   */
  public expandBoundsToFit(points: Vector3[]): void {
    let maxLx = this.width / 2;
    let maxLy = this.height / 2;
    let needsExpansion = false;

    for (const p of points) {
      const local = this.projectWorldToLocal(p);
      if (Math.abs(local.x) > maxLx) {
        maxLx = Math.abs(local.x) * 1.15;
        needsExpansion = true;
      }
      if (Math.abs(local.y) > maxLy) {
        maxLy = Math.abs(local.y) * 1.15;
        needsExpansion = true;
      }
    }

    if (needsExpansion) {
      this.width = Math.ceil(maxLx * 2);
      this.height = Math.ceil(maxLy * 2);
      this.rebuildOutline();
    }
  }

  /**
   * Rebuilds visual outline and hit plane when dimensions are expanded.
   */
  public rebuildOutline(): void {
    this.group.remove(this.outlineMesh);
    this.outlineMesh.geometry.dispose();
    this.outlineMesh = this.createOutline(this.width, this.height);
    this.group.add(this.outlineMesh);

    this.group.remove(this.hitPlaneMesh);
    this.hitPlaneMesh.geometry.dispose();
    this.hitPlaneMesh = this.createHitPlane(this.width, this.height);
    this.group.add(this.hitPlaneMesh);
  }

  /**
   * Highlights or dims the canvas visual frame depending on active state.
   */
  public setActive(isActive: boolean): void {
    (this.outlineMesh.material as LineBasicMaterial).color.set(isActive ? 0x818cf8 : 0x475569);
    (this.outlineMesh.material as LineBasicMaterial).opacity = isActive ? 0.45 : 0.18;
  }

  /**
   * Sets visibility of the visual frame and grid lines.
   */
  public setGridVisible(visible: boolean): void {
    this.outlineMesh.visible = visible;
  }

  /**
   * Returns current visibility of the canvas grid lines.
   */
  public getGridVisible(): boolean {
    return this.outlineMesh.visible;
  }

  /**
   * Returns the plane normal in world space coordinates.
   */
  public getNormal(): Vector3 {
    return new Vector3(0, 0, 1).applyQuaternion(this.group.quaternion).normalize();
  }

  /**
   * Calculates view-angle facing factor (0.0 to 1.0) relative to a camera.
   * Grazing edge-on angles approach 0, face-on angles approach 1.
   *
   * @param cameraPosition - Camera world position
   * @param grazingThreshold - Cosine threshold below which opacity fades
   * @returns Facing factor from 0.0 (edge-on) to 1.0 (face-on)
   */
  public getFacingFactor(cameraPosition: Vector3, grazingThreshold: number = 0.22): number {
    const normal = this.getNormal();
    const viewDir = cameraPosition.clone().sub(this.group.position).normalize();
    const cosAngle = Math.abs(normal.dot(viewDir));

    if (cosAngle <= grazingThreshold * 0.4) return 0.0;
    if (cosAngle >= grazingThreshold * 1.8) return 1.0;
    const t = (cosAngle - grazingThreshold * 0.4) / (grazingThreshold * 1.4);
    return t * t * (3 - 2 * t);
  }

  /**
   * Transforms a world 3D position into 2D local canvas coordinates.
   *
   * @param worldPoint - 3D world coordinate
   * @returns 2D local plane coordinate
   */
  public projectWorldToLocal(worldPoint: Vector3): Vector2 {
    const local = worldPoint.clone();
    this.group.worldToLocal(local);
    return new Vector2(local.x, local.y);
  }

  /**
   * Transforms a 2D local canvas coordinate into a 3D world position.
   *
   * @param localPoint - 2D local plane coordinate
   * @returns 3D world position on the canvas plane
   */
  public unprojectLocalToWorld(localPoint: Vector2): Vector3 {
    const local = new Vector3(localPoint.x, localPoint.y, 0);
    this.group.localToWorld(local);
    return local;
  }

  /**
   * Gets the Three.js Object3D Group for scene hierarchy insertion.
   *
   * @returns The root group of this canvas
   */
  public getObject(): Group {
    return this.group;
  }

  /**
   * Sets canvas position in world space.
   *
   * @param pos - Target position
   */
  public setPosition(pos: Vector3): void {
    this.group.position.copy(pos);
    this.updatePlane();
  }

  /**
   * Sets canvas rotation from a quaternion tuple [x, y, z, w].
   *
   * @param rot - Quaternion array
   */
  public setRotation(rot: [number, number, number, number]): void {
    this.group.quaternion.set(rot[0], rot[1], rot[2], rot[3]);
    this.updatePlane();
  }

  /**
   * Disposes of geometry and materials.
   */
  public dispose(): void {
    this.outlineMesh.geometry.dispose();
    (this.outlineMesh.material as LineBasicMaterial).dispose();
    this.hitPlaneMesh.geometry.dispose();
    (this.hitPlaneMesh.material as MeshBasicMaterial).dispose();
    this.group.clear();
  }

  /**
   * Updates the mathematical 3D plane based on current group transform.
   */
  private updatePlane(): void {
    const normal = new Vector3(0, 0, 1).applyQuaternion(this.group.quaternion).normalize();
    this.plane.setFromNormalAndCoplanarPoint(normal, this.group.position);
  }

  /**
   * Creates the visual border and subtle grid of the canvas.
   */
  private createOutline(w: number, h: number): LineSegments {
    const hw = w / 2;
    const hh = h / 2;
    const vertices: number[] = [];

    // Outer boundary
    vertices.push(
      -hw, -hh, 0,  hw, -hh, 0,
       hw, -hh, 0,  hw,  hh, 0,
       hw,  hh, 0, -hw,  hh, 0,
      -hw,  hh, 0, -hw, -hh, 0
    );

    // Inner subtle grid lines
    const subdivisions = 4;
    for (let i = 1; i < subdivisions; i++) {
      const gx = -hw + (w * i) / subdivisions;
      const gy = -hh + (h * i) / subdivisions;
      vertices.push(gx, -hh, 0, gx, hh, 0);
      vertices.push(-hw, gy, 0, hw, gy, 0);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    const material = new LineBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.35,
    });

    return new LineSegments(geometry, material);
  }

  /**
   * Creates an invisible mesh to aid picking or depth testing.
   */
  private createHitPlane(w: number, h: number): Mesh {
    const geometry = new BufferGeometry();
    const hw = w / 2;
    const hh = h / 2;
    const vertices = new Float32Array([
      -hw, -hh, 0,  hw, -hh, 0,  hw,  hh, 0,
      -hw, -hh, 0,  hw,  hh, 0, -hw,  hh, 0,
    ]);
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    const material = new MeshBasicMaterial({
      visible: false,
      side: DoubleSide,
    });
    return new Mesh(geometry, material);
  }
}
