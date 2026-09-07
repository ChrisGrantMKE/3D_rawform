import { Vector3, Quaternion, Spherical } from 'three/webgpu';
/**
 * Camera navigation controller supporting orbit, pan, zoom, and spatial canvas snapping.
 */
export class CameraController {
    camera;
    target = new Vector3(0, 0, 0);
    spherical = new Spherical(10, Math.PI / 3, Math.PI / 4);
    // Damping / animation interpolation
    isAnimating = false;
    animStartPos = new Vector3();
    animEndPos = new Vector3();
    animStartTarget = new Vector3();
    animEndTarget = new Vector3();
    animProgress = 0;
    /**
     * Initializes the camera controller.
     *
     * @param camera - The scene perspective camera
     */
    constructor(camera) {
        this.camera = camera;
        this.updateCameraPosition();
    }
    /**
     * Orbits the camera around the target point.
     *
     * @param deltaTheta - Azimuthal rotation delta (radians)
     * @param deltaPhi - Polar rotation delta (radians)
     */
    orbit(deltaTheta, deltaPhi) {
        if (this.isAnimating)
            return;
        this.spherical.theta -= deltaTheta;
        this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi - deltaPhi));
        this.updateCameraPosition();
    }
    /**
     * Pans the camera and target in the screen plane.
     *
     * @param deltaX - Screen X movement delta
     * @param deltaY - Screen Y movement delta
     */
    pan(deltaX, deltaY) {
        if (this.isAnimating)
            return;
        const panSpeed = this.spherical.radius * 0.0015;
        const forward = new Vector3();
        this.camera.getWorldDirection(forward);
        const right = new Vector3().crossVectors(forward, this.camera.up).normalize();
        const up = new Vector3().crossVectors(right, forward).normalize();
        const panOffset = right.multiplyScalar(-deltaX * panSpeed).add(up.multiplyScalar(deltaY * panSpeed));
        this.target.add(panOffset);
        this.camera.position.add(panOffset);
    }
    /**
     * Zooms the camera toward or away from the target point.
     *
     * @param deltaRadius - Radius multiplier or increment
     */
    zoom(deltaRadius) {
        if (this.isAnimating)
            return;
        this.spherical.radius = Math.max(0.5, Math.min(200, this.spherical.radius * deltaRadius));
        this.updateCameraPosition();
    }
    /**
     * Snaps and aligns the camera directly orthogonal to a target plane's position and orientation.
     *
     * @param planePos - Target plane center position
     * @param planeRot - Target plane quaternion rotation [x, y, z, w]
     * @param distance - Viewing distance in world units
     */
    snapToCanvas(planePos, planeRot, distance = 8) {
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
    update(deltaTime) {
        if (!this.isAnimating)
            return;
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
        }
    }
    /**
     * Returns current camera target coordinate.
     */
    getTarget() {
        return this.target.clone();
    }
    /**
     * Updates camera position from spherical coordinates.
     */
    updateCameraPosition() {
        this.camera.position.setFromSpherical(this.spherical).add(this.target);
        this.camera.lookAt(this.target);
    }
    /**
     * Recalculates spherical values from the current camera and target.
     */
    syncSphericalFromPosition() {
        const offset = this.camera.position.clone().sub(this.target);
        this.spherical.setFromVector3(offset);
    }
    /**
     * Initiates animated camera transition.
     */
    startAnimation(endPos, endTarget) {
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
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
}
