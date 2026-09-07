import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  LineSegments,
  LineBasicMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  Quaternion,
  PerspectiveCamera,
} from 'three/webgpu';

/**
 * Interactive preview plane for perspective depth slicing and canvas placement.
 * Mutes/occludes everything behind the plane at its 3D intersection point.
 */
export class PlanePreview {
  private readonly group: Group;
  private muteMesh: Mesh;
  private gridMesh: LineSegments;
  private crosshairMesh: LineSegments;

  private isVisible: boolean = false;
  private baseTarget: Vector3 = new Vector3();
  private depthOffset: number = 0;
  private currentQuat: Quaternion = new Quaternion();
  private currentPos: Vector3 = new Vector3();

  constructor() {
    this.group = new Group();
    this.group.name = 'PlanePreview_Group';
    this.group.visible = false;

    // 1. Translucent muting plane (semi-occluding background)
    const muteGeo = new PlaneGeometry(50, 50);
    const muteMat = new MeshBasicNodeMaterial();
    muteMat.color.set(0x0a0c10); // Scene background color
    muteMat.opacity = 0.72;
    muteMat.transparent = true;
    muteMat.depthWrite = false;

    this.muteMesh = new Mesh(muteGeo, muteMat);
    this.muteMesh.name = 'PlanePreview_MutePlane';
    this.muteMesh.position.z = -0.005; // Slightly behind grid

    // 2. Perspective Guide Grid
    this.gridMesh = this.createGrid(10, 10, 6);

    // 3. Central alignment crosshair
    this.crosshairMesh = this.createCrosshair(1.2);

    this.group.add(this.muteMesh);
    this.group.add(this.gridMesh);
    this.group.add(this.crosshairMesh);
  }

  /**
   * Returns Three.js container group for scene graph integration.
   */
  public getObject(): Group {
    return this.group;
  }

  /**
   * Checks if the preview plane is currently active and visible.
   */
  public isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Begins interactive preview aligned to the current camera viewpoint.
   *
   * @param camera - Active camera
   * @param target - 3D focal target
   */
  public start(camera: PerspectiveCamera, target: Vector3): void {
    this.isVisible = true;
    this.baseTarget.copy(target);
    this.depthOffset = 0;
    this.currentQuat.copy(camera.quaternion);

    this.updateTransform(camera);
    this.group.visible = true;
  }

  /**
   * Adjusts the depth offset of the preview plane along the camera's sightline.
   *
   * @param delta - Distance increment (positive = farther away, negative = closer)
   * @param camera - Active camera
   */
  public adjustDepth(delta: number, camera: PerspectiveCamera): void {
    this.depthOffset += delta;
    this.updateTransform(camera);
  }

  /**
   * Sets the absolute depth offset relative to the base target.
   */
  public setDepth(offset: number, camera: PerspectiveCamera): void {
    this.depthOffset = offset;
    this.updateTransform(camera);
  }

  /**
   * Gets the final 3D position and orientation for placing the new canvas.
   */
  public getResult(): { position: [number, number, number]; rotation: [number, number, number, number]; depth: number } {
    return {
      position: [this.currentPos.x, this.currentPos.y, this.currentPos.z],
      rotation: [this.currentQuat.x, this.currentQuat.y, this.currentQuat.z, this.currentQuat.w],
      depth: this.depthOffset,
    };
  }

  /**
   * Hides and finishes preview mode.
   */
  public stop(): void {
    this.isVisible = false;
    this.group.visible = false;
    this.depthOffset = 0;
  }

  /**
   * Updates preview position along the camera forward vector.
   */
  private updateTransform(camera: PerspectiveCamera): void {
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    this.currentPos.copy(this.baseTarget).addScaledVector(forward, this.depthOffset);
    this.currentQuat.copy(camera.quaternion);

    this.group.position.copy(this.currentPos);
    this.group.quaternion.copy(this.currentQuat);
  }

  /**
   * Creates the visual perspective grid with accent highlights.
   */
  private createGrid(w: number, h: number, divisions: number): LineSegments {
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

    // Grid lines
    for (let i = 1; i < divisions; i++) {
      const gx = -hw + (w * i) / divisions;
      const gy = -hh + (h * i) / divisions;
      vertices.push(gx, -hh, 0, gx, hh, 0);
      vertices.push(-hw, gy, 0, hw, gy, 0);
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));

    const mat = new LineBasicMaterial({
      color: 0x818cf8, // Indigo glow
      transparent: true,
      opacity: 0.65,
    });

    return new LineSegments(geo, mat);
  }

  /**
   * Creates central alignment crosshair.
   */
  private createCrosshair(size: number): LineSegments {
    const s = size / 2;
    const vertices = [
      -s, 0, 0.001,  s, 0, 0.001,
      0, -s, 0.001,  0, s, 0.001,
    ];
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    const mat = new LineBasicMaterial({
      color: 0x22d3ee, // Cyan tick
      transparent: true,
      opacity: 0.9,
    });
    return new LineSegments(geo, mat);
  }

  /**
   * Disposes of resources.
   */
  public dispose(): void {
    this.muteMesh.geometry.dispose();
    (this.muteMesh.material as MeshBasicNodeMaterial).dispose();
    this.gridMesh.geometry.dispose();
    (this.gridMesh.material as LineBasicMaterial).dispose();
    this.crosshairMesh.geometry.dispose();
    (this.crosshairMesh.material as LineBasicMaterial).dispose();
  }
}
