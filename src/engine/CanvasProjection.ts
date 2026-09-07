import { Vector3, Quaternion } from 'three/webgpu';
import type { SpatialCanvasData } from '../types/canvas';

export type HingeEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * Mathematical projection utilities for creating parallel and hinged spatial canvas planes.
 */
export class CanvasProjection {
  /**
   * Generates configuration for a parallel spatial canvas offset along the normal.
   *
   * @param base - Source canvas configuration
   * @param distance - Signed distance along normal (positive moves forward, negative moves backward)
   * @param name - Display name for new canvas
   * @returns Calculated SpatialCanvasData for the new parallel canvas
   */
  public static createParallel(
    base: SpatialCanvasData,
    distance: number,
    name: string
  ): SpatialCanvasData {
    const basePos = new Vector3(...base.position);
    const quat = new Quaternion(...base.rotation);
    const normal = new Vector3(0, 0, 1).applyQuaternion(quat).normalize();

    const newPos = basePos.clone().add(normal.multiplyScalar(distance));

    return {
      id: `canvas_parallel_${Date.now()}`,
      name,
      planeType: 'CUSTOM',
      position: [newPos.x, newPos.y, newPos.z],
      rotation: [...base.rotation],
      width: base.width,
      height: base.height,
      opacity: base.opacity,
      isVisible: true,
      isLocked: false,
      strokeIds: [],
    };
  }

  /**
   * Generates configuration for a canvas hinged along a shared edge of the base canvas.
   *
   * @param base - Source canvas configuration
   * @param edge - Edge to hinge on ('top', 'bottom', 'left', 'right')
   * @param angleRadians - Fold angle in radians (e.g. Math.PI / 2 for 90 degrees)
   * @param name - Display name for new canvas
   * @returns Calculated SpatialCanvasData for the hinged canvas
   */
  public static createHinge(
    base: SpatialCanvasData,
    edge: HingeEdge,
    angleRadians: number,
    name: string
  ): SpatialCanvasData {
    const basePos = new Vector3(...base.position);
    const baseQuat = new Quaternion(...base.rotation);

    const halfW = base.width / 2;
    const halfH = base.height / 2;

    let edgeOffsetLocal = new Vector3();
    let hingeAxisLocal = new Vector3();

    if (edge === 'top') {
      edgeOffsetLocal.set(0, halfH, 0);
      hingeAxisLocal.set(1, 0, 0);
    } else if (edge === 'bottom') {
      edgeOffsetLocal.set(0, -halfH, 0);
      hingeAxisLocal.set(-1, 0, 0);
    } else if (edge === 'left') {
      edgeOffsetLocal.set(-halfW, 0, 0);
      hingeAxisLocal.set(0, 1, 0);
    } else {
      edgeOffsetLocal.set(halfW, 0, 0);
      hingeAxisLocal.set(0, -1, 0);
    }

    const hingeAxisWorld = hingeAxisLocal.clone().applyQuaternion(baseQuat).normalize();
    const edgePosWorld = basePos.clone().add(edgeOffsetLocal.clone().applyQuaternion(baseQuat));

    const foldQuat = new Quaternion().setFromAxisAngle(hingeAxisWorld, angleRadians);
    const newQuat = foldQuat.clone().multiply(baseQuat);

    // Vector from edge to center of new plane
    const centerOffsetLocal = edgeOffsetLocal.clone();
    const centerOffsetWorld = centerOffsetLocal.applyQuaternion(newQuat);
    const newCenterPos = edgePosWorld.clone().add(centerOffsetWorld);

    return {
      id: `canvas_hinge_${Date.now()}`,
      name,
      planeType: 'CUSTOM',
      position: [newCenterPos.x, newCenterPos.y, newCenterPos.z],
      rotation: [newQuat.x, newQuat.y, newQuat.z, newQuat.w],
      width: edge === 'left' || edge === 'right' ? base.width : base.width,
      height: edge === 'top' || edge === 'bottom' ? base.height : base.height,
      opacity: base.opacity,
      isVisible: true,
      isLocked: false,
      strokeIds: [],
    };
  }
}
