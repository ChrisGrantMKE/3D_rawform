import { PerspectiveCamera, Vector3, Quaternion, Spherical } from 'three/webgpu';

/**
 * Camera navigation controller supporting orbit, pan, zoom, and spatial canvas snapping.
 */
export class CameraController {
  private readonly camera: PerspectiveCamera;
  private readonly target: Vector3 = new Vector3(0, 0, 0);
  private readonly spherical: Spherical = new Spherical(10, Math.PI / 3, Math.PI / 4);

  // Damping / animation interpolation
  private isAnimating: boolean = false;
  private animStartPos: Vector3 = new Vector3();
  private animEndPos: Vector3 = new Vector3();
  private animStartTarget: Vector3 = new Vector3();
  private animEndTarget: Vector3 = new Vector3();
  private animProgress: number = 0;
  private changeCallbacks: Array<() => void> = [];

  /**
   * Registers a callback invoked whenever the camera position, target, or rotation changes.
   */
  public onChange(cb: () => void): void {
    this.changeCallbacks.push(cb);
  }

  private notifyChange(): void {
    for (const cb of this.changeCallbacks) {
      cb();
    }
  }

  /**
   * Initializes the camera controller.
   *
   * @param camera - The scene perspective camera
   */
  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
    this.updateCameraPosition();
  }

  /**
   * Orbits the camera around the target point.
   *
   * @param deltaTheta - Azimuthal rotation delta (radians)
   * @param deltaPhi - Polar rotation delta (radians)
   */
  public orbit(deltaTheta: number, deltaPhi: number): void {
    if (this.isAnimating) return;

    this.spherical.theta -= deltaTheta;
    this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi - deltaPhi));
    this.updateCameraPosition();
    this.notifyChange();
  }

  /**
   * Pans the camera and target in the screen plane.
   *
   * @param deltaX - Screen X movement delta
   * @param deltaY - Screen Y movement delta
   */
  public pan(deltaX: number, deltaY: number): void {
    if (this.isAnimating) return;

    const panSpeed = this.spherical.radius * 0.0015;
    const forward = new Vector3();
    this.camera.getWorldDirection(forward);

    const right = new Vector3().crossVectors(forward, this.camera.up).normalize();
    const up = new Vector3().crossVectors(right, forward).normalize();

    const panOffset = right.multiplyScalar(-deltaX * panSpeed).add(up.multiplyScalar(deltaY * panSpeed));
    this.target.add(panOffset);
    this.camera.position.add(panOffset);
    this.notifyChange();
  }

  /**
   * Zooms the camera toward or away from the target point.
   *
   * @param deltaRadius - Radius multiplier or increment
   */
  public zoom(deltaRadius: number): void {
    if (this.isAnimating) return;

    this.spherical.radius = Math.max(0.5, Math.min(200, this.spherical.radius * deltaRadius));
    this.updateCameraPosition();
    this.notifyChange();
  }

  /**
   * Snaps and aligns the camera directly orthogonal to a target plane's position and orientation.
   *
   * @param planePos - Target plane center position
   * @param planeRot - Target plane quaternion rotation [x, y, z, w]
   * @param distance - Viewing distance in world units
   */
  public snapToCanvas(
    planePos: [number, number, number],
    planeRot: [number, number, number, number],
    distance: number = 8
  ): void {
    const center = new Vector3(...planePos);
    const quat = new Quaternion(planeRot[0], planeRot[1], planeRot[2], planeRot[3]);
    const normal = new Vector3(0, 0, 1).applyQuaternion(quat).normalize();

    const eye = center.clone().add(normal.clone().multiplyScalar(distance));

    this.startAnimation(eye, center);
  }

  /**
   * Updates internal camera transform per frame.
   *
   * @param deltaTime - Time elapsed since last frame
   */
  public update(deltaTime: number): void {
    if (!this.isAnimating) return;

    this.animProgress += deltaTime * 3.0; // ~330ms transition
    if (this.animProgress >= 1.0) {
      this.animProgress = 1.0;
      this.isAnimating = false;
    }

    const t = this.easeOutCubic(this.animProgress);
    this.camera.position.lerpVectors(this.animStartPos, this.animEndPos, t);
    this.target.lerpVectors(this.animStartTarget, this.animEndTarget, t);
    this.camera.lookAt(this.target);

    if (!this.isAnimating) {
      this.syncSphericalFromPosition();
      this.notifyChange();
    }
  }

  /**
   * Returns current camera target coordinate.
   */
  public getTarget(): Vector3 {
    return this.target.clone();
  }

  /**
   * Sets the camera focal target in world coordinates and updates camera view.
   *
   * @param newTarget - Target focal point
   */
  public setTarget(newTarget: Vector3): void {
    const diff = newTarget.clone().sub(this.target);
    this.target.copy(newTarget);
    this.camera.position.add(diff);
    this.camera.lookAt(this.target);
    this.notifyChange();
  }

  /**
   * Updates camera position from spherical coordinates.
   */
  private updateCameraPosition(): void {
    this.camera.position.setFromSpherical(this.spherical).add(this.target);
    this.camera.lookAt(this.target);
  }

  /**
   * Recalculates spherical values from the current camera and target.
   */
  private syncSphericalFromPosition(): void {
    const offset = this.camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offset);
  }

  /**
   * Initiates animated camera transition.
   */
  private startAnimation(endPos: Vector3, endTarget: Vector3): void {
    this.animStartPos.copy(this.camera.position);
    this.animEndPos.copy(endPos);
    this.animStartTarget.copy(this.target);
    this.animEndTarget.copy(endTarget);
    this.animProgress = 0;
    this.isAnimating = true;
  }

  /**
   * Smooth cubic ease-out calculation.
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
}
