import { describe, it, expect } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { SpatialSnapper } from '../src/engine/SpatialSnapper';

describe('SpatialSnapper', () => {
  it('detects and snaps to a stroke within distance-scaled tolerance', () => {
    const snapper = new SpatialSnapper();
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    // Stroke along X axis at z = 0 (10 units from camera)
    snapper.registerStroke('stroke_1', [
      new Vector3(-2, 0, 0),
      new Vector3(2, 0, 0),
    ]);

    // Click at center screen (should point directly at 0, 0, 0)
    const hit = snapper.findSnapTarget(400, 400, camera, 800, 800, 24);
    expect(hit).not.toBeNull();
    expect(hit!.strokeId).toBe('stroke_1');
    expect(hit!.hitPoint.z).toBeCloseTo(0, 2);
    expect(hit!.distanceToCamera).toBeCloseTo(10, 2);
  });

  it('disambiguates overlapping strokes by selecting the nearest to observer', () => {
    const snapper = new SpatialSnapper();
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    // Near stroke at z = 5 (5 units from camera)
    snapper.registerStroke('near_stroke', [
      new Vector3(-1, 0, 5),
      new Vector3(1, 0, 5),
    ]);

    // Far stroke at z = -5 (15 units from camera)
    snapper.registerStroke('far_stroke', [
      new Vector3(-1, 0, -5),
      new Vector3(1, 0, -5),
    ]);

    // Click at center: both intersect ray, near_stroke should be selected!
    const hit = snapper.findSnapTarget(400, 400, camera, 800, 800, 30);
    expect(hit).not.toBeNull();
    expect(hit!.strokeId).toBe('near_stroke');
    expect(hit!.distanceToCamera).toBeCloseTo(5, 2);
  });
});
