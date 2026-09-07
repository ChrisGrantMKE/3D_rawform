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
    this.hitPlaneMesh = this.createHitPlane(data.width, data.height);

    this.group.add(this.outlineMesh);
    this.group.add(this.hitPlaneMesh);

    this.setPosition(new Vector3(...data.position));
    this.setRotation(data.rotation);
    this.updatePlane();
  }

  /**
   * Raycasts a 3D ray against this spatial canvas plane within its boundaries.
   *
   * @param ray - Three.js Ray in world coordinates
   * @returns Intersection point in world coordinates or null if outside bounds
   */
  public intersectRay(ray: Ray): Vector3 | null {
    if (!this.isVisible || this.isLocked) {
      return null;
    }

    const intersection = new Vector3();
    const hit = ray.intersectPlane(this.plane, intersection);
    if (!hit) {
      return null;
    }

    const localPoint = this.projectWorldToLocal(intersection);
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    if (Math.abs(localPoint.x) <= halfW && Math.abs(localPoint.y) <= halfH) {
      return intersection;
    }

    return null;
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
