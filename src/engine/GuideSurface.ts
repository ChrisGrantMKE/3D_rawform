import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  SphereGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  PlaneGeometry,
  DoubleSide,
  Ray,
  Raycaster,
  Vector3,
  Vector2,
  LineSegments,
  LineBasicMaterial,
  WireframeGeometry,
  Camera,
} from 'three/webgpu';

export type GuideType = 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane' | 'none';

export interface GuideSurfaceConfig {
  type: GuideType;
  radius: number;
  height: number;
  tubeRadius?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  opacity?: number;
}

/**
 * 3D Curved Guide Surface enabling Feather 3D-style spatial sketching.
 * Projects stylus strokes directly onto curved 3D geometric surfaces.
 */
export class GuideSurface {
  private readonly group: Group;
  private guideMesh: Mesh | null = null;
  private wireframeMesh: LineSegments | null = null;
  private currentType: GuideType = 'none';
  private radius: number = 3.0;
  private height: number = 6.0;
  private tubeRadius: number = 0.8;
  private isVisible: boolean = true;
  private readonly raycaster: Raycaster = new Raycaster();
  private readonly ndc: Vector2 = new Vector2();

  /**
   * Initializes guide surface container group.
   */
  constructor() {
    this.group = new Group();
    this.group.name = 'GuideSurface_Container';
  }

  /**
   * Returns the Three.js container group for scene graph integration.
   */
  public getObject(): Group {
    return this.group;
  }

  /**
   * Returns current active guide type.
   */
  public getType(): GuideType {
    return this.currentType;
  }

  /**
   * Checks if guide surface is active and visible.
   */
  public isActive(): boolean {
    return this.currentType !== 'none' && this.isVisible && this.guideMesh !== null;
  }

  /**
   * Sets guide surface geometry type.
   *
   * @param type - Surface shape type
   */
  public setType(type: GuideType): void {
    if (this.currentType === type) return;
    this.currentType = type;
    this.rebuildSurface();
  }

  /**
   * Sets dimensions for current guide surface.
   *
   * @param radius - Primary radius or width
   * @param height - Height for cylinder/cone
   * @param tubeRadius - Secondary radius for torus
   */
  public setDimensions(radius: number, height: number = 6.0, tubeRadius: number = 0.8): void {
    this.radius = radius;
    this.height = height;
    this.tubeRadius = tubeRadius;
    this.rebuildSurface();
  }

  /**
   * Sets world position of guide surface.
   */
  public setPosition(pos: Vector3): void {
    this.group.position.copy(pos);
  }

  /**
   * Sets visibility of guide surface.
   */
  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.group.visible = visible;
  }

  /**
   * Raycasts a world ray against the active curved guide surface.
   *
   * @param ray - Three.js Ray in world space
   * @returns 3D contact point or null if no intersection
   */
  public intersectRay(ray: Ray): Vector3 | null {
    if (!this.isActive() || !this.guideMesh) return null;

    this.raycaster.ray.copy(ray);
    const hits = this.raycaster.intersectObject(this.guideMesh, false);
    if (hits.length > 0) {
      return hits[0].point;
    }
    return null;
  }

  /**
   * Raycasts from screen coordinates against the curved guide surface.
   *
   * @param screenX - Window client X
   * @param screenY - Window client Y
   * @param camera - Active perspective camera
   * @returns 3D contact point or null
   */
  public intersectScreen(screenX: number, screenY: number, camera: Camera): Vector3 | null {
    if (!this.isActive() || !this.guideMesh) return null;

    this.ndc.x = (screenX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(screenY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, camera);

    const hits = this.raycaster.intersectObject(this.guideMesh, false);
    if (hits.length > 0) {
      return hits[0].point;
    }
    return null;
  }

  /**
   * Reconstructs guide geometry and wireframe helper.
   */
  private rebuildSurface(): void {
    this.cleanup();
    if (this.currentType === 'none') return;

    const geometry = this.createGeometry(this.currentType);
    if (!geometry) return;

    const material = new MeshBasicNodeMaterial();
    material.color.set(0x06b6d4); // Cyan holographic tint
    material.opacity = 0.12;
    material.transparent = true;
    material.side = DoubleSide;
    material.depthWrite = false;

    this.guideMesh = new Mesh(geometry, material);
    this.guideMesh.name = `GuideSurface_${this.currentType}`;

    const wireframeGeo = new WireframeGeometry(geometry);
    const wireMat = new LineBasicMaterial({
      color: 0x22d3ee,
      opacity: 0.35,
      transparent: true,
      depthWrite: false,
    });
    this.wireframeMesh = new LineSegments(wireframeGeo, wireMat);

    this.group.add(this.guideMesh);
    this.group.add(this.wireframeMesh);
  }

  /**
   * Instantiates Three.js geometry based on type.
   */
  private createGeometry(type: GuideType) {
    switch (type) {
      case 'sphere':
        return new SphereGeometry(this.radius, 32, 24);
      case 'cylinder':
        return new CylinderGeometry(this.radius, this.radius, this.height, 32, 1, true);
      case 'cone':
        return new ConeGeometry(this.radius, this.height, 32, 1, true);
      case 'torus':
        return new TorusGeometry(this.radius, this.tubeRadius, 24, 48);
      case 'plane':
        return new PlaneGeometry(this.radius * 2, this.height);
      default:
        return null;
    }
  }

  /**
   * Disposes current geometry and materials.
   */
  private cleanup(): void {
    if (this.guideMesh) {
      this.group.remove(this.guideMesh);
      this.guideMesh.geometry.dispose();
      (this.guideMesh.material as MeshBasicNodeMaterial).dispose();
      this.guideMesh = null;
    }
    if (this.wireframeMesh) {
      this.group.remove(this.wireframeMesh);
      this.wireframeMesh.geometry.dispose();
      (this.wireframeMesh.material as LineBasicMaterial).dispose();
      this.wireframeMesh = null;
    }
  }

  /**
   * Fully disposes guide resources.
   */
  public dispose(): void {
    this.cleanup();
  }
}
