import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Vector3,
  Vector2,
  Quaternion,
  PerspectiveCamera,
  Color,
} from 'three/webgpu';
import {
  positionLocal,
  length,
  smoothstep,
  fract,
  abs,
  max,
  vec4,
  clamp,
  uniform,
} from 'three/tsl';

/**
 * Interactive preview plane for perspective depth slicing and canvas placement.
 * Spans the full viewport with smooth radial edge falloff, mutes/occludes
 * objects situated behind it in 3D space, and provides focal crosshairs.
 */
export class PlanePreview {
  private readonly group: Group;
  private muteMesh: Mesh;
  private gridMesh: Mesh;

  private isVisible: boolean = false;
  private baseTarget: Vector3 = new Vector3();
  private depthOffset: number = 0;
  private currentQuat: Quaternion = new Quaternion();
  private currentPos: Vector3 = new Vector3();

  // Dynamic TSL uniforms for viewport-spanning grid and theme styling
  private gridSpanUniform = uniform(new Vector2(30, 20));
  private gridColorUniform = uniform(new Color(0x818cf8));
  private muteColorUniform = uniform(new Color(0x0a0c10));
  private muteOpacityUniform = uniform(0.72);

  constructor() {
    this.group = new Group();
    this.group.name = 'PlanePreview_Group';
    this.group.visible = false;

    // Unit geometry [-1, 1] scaled dynamically to span 1.8x the active camera frustum
    const unitPlane = new PlaneGeometry(2, 2);

    // 1. Translucent muting plane with soft radial vignette
    const muteMat = new MeshBasicNodeMaterial();
    muteMat.transparent = true;
    muteMat.depthWrite = false;

    const muteDist = length(positionLocal.xy);
    const muteEdgeFade = smoothstep(1.0, 0.25, muteDist);
    muteMat.colorNode = vec4(this.muteColorUniform, muteEdgeFade.mul(this.muteOpacityUniform));

    this.muteMesh = new Mesh(unitPlane, muteMat);
    this.muteMesh.name = 'PlanePreview_MutePlane';
    this.muteMesh.position.z = -0.005; // Placed slightly behind grid lines

    // 2. Viewport-spanning procedural perspective grid with edge fadeout
    const gridMat = new MeshBasicNodeMaterial();
    gridMat.transparent = true;
    gridMat.depthWrite = false;

    const normPos = positionLocal.xy;
    const radialDist = length(normPos);
    // Smooth fadeout as grid approaches viewport periphery
    const edgeFade = smoothstep(1.0, 0.2, radialDist);

    // World coordinates on the plane for invariant 1.0m and 5.0m grid intervals
    const worldPos = normPos.mul(this.gridSpanUniform.div(2.0));

    // Minor grid lines every 1.0 world unit
    const minorCell = abs(fract(worldPos.sub(0.5)).sub(0.5));
    const minorLine = max(smoothstep(0.04, 0.015, minorCell.x), smoothstep(0.04, 0.015, minorCell.y));

    // Major grid lines every 5.0 world units
    const majorCell = abs(fract(worldPos.div(5.0).sub(0.5)).sub(0.5));
    const majorLine = max(smoothstep(0.02, 0.006, majorCell.x), smoothstep(0.02, 0.006, majorCell.y));

    // Central crosshair ring and axes within center
    const centerDist = length(worldPos);
    const crosshairX = smoothstep(0.035, 0.01, abs(worldPos.y)).mul(smoothstep(1.8, 1.4, abs(worldPos.x)));
    const crosshairY = smoothstep(0.035, 0.01, abs(worldPos.x)).mul(smoothstep(1.8, 1.4, abs(worldPos.y)));
    const crosshairRing = smoothstep(0.03, 0.01, abs(centerDist.sub(0.6)));
    const crosshair = max(max(crosshairX, crosshairY), crosshairRing);

    // Combine lines and crosshair with edge fade
    const lineCombined = max(minorLine.mul(0.35), majorLine.mul(0.85));
    const totalLineAlpha = clamp(max(lineCombined, crosshair).mul(edgeFade).mul(0.85), 0.0, 1.0);

    gridMat.colorNode = vec4(this.gridColorUniform, totalLineAlpha);

    this.gridMesh = new Mesh(unitPlane, gridMat);
    this.gridMesh.name = 'PlanePreview_GridMesh';

    this.group.add(this.muteMesh);
    this.group.add(this.gridMesh);
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
   * Adapts preview colors to dark, studio, light, or transparent theme.
   */
  public setStyle(style: 'dark' | 'studio' | 'light' | 'transparent'): void {
    if (style === 'light') {
      this.gridColorUniform.value.set(0x2563eb); // Rich royal blue for high contrast
      this.muteColorUniform.value.set(0xf1f5f9);
      this.muteOpacityUniform.value = 0.8;
    } else if (style === 'studio') {
      this.gridColorUniform.value.set(0x38bdf8); // Sky cyan
      this.muteColorUniform.value.set(0x181e28);
      this.muteOpacityUniform.value = 0.72;
    } else if (style === 'transparent') {
      this.gridColorUniform.value.set(0x818cf8);
      this.muteColorUniform.value.set(0x020617);
      this.muteOpacityUniform.value = 0.55;
    } else {
      // Dark
      this.gridColorUniform.value.set(0x818cf8); // Indigo
      this.muteColorUniform.value.set(0x0a0c10);
      this.muteOpacityUniform.value = 0.72;
    }
  }

  /**
   * Begins interactive preview aligned to current camera viewpoint.
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
   * Updates preview transform and dynamically scales to span the active camera frustum.
   */
  private updateTransform(camera: PerspectiveCamera): void {
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    this.currentPos.copy(this.baseTarget).addScaledVector(forward, this.depthOffset);
    this.currentQuat.copy(camera.quaternion);

    this.group.position.copy(this.currentPos);
    this.group.quaternion.copy(this.currentQuat);

    // Compute view frustum dimensions at the plane's exact 3D depth
    const distToCam = Math.max(0.5, camera.position.distanceTo(this.currentPos));
    const vFovRad = (camera.fov * Math.PI) / 180;
    const vHeight = 2 * Math.tan(vFovRad / 2) * distToCam;
    const vWidth = vHeight * camera.aspect;

    // Scale to 1.8x viewport size so lines fade out smoothly toward and beyond screen edges
    const spanW = Math.max(16, vWidth * 1.8);
    const spanH = Math.max(16, vHeight * 1.8);

    this.group.scale.set(spanW / 2, spanH / 2, 1);
    this.gridSpanUniform.value.set(spanW, spanH);
  }

  /**
   * Disposes of geometry and materials.
   */
  public dispose(): void {
    this.muteMesh.geometry.dispose();
    (this.muteMesh.material as MeshBasicNodeMaterial).dispose();
    this.gridMesh.geometry.dispose();
    (this.gridMesh.material as MeshBasicNodeMaterial).dispose();
    this.group.clear();
  }
}
