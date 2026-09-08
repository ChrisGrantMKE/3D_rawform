import { describe, it, expect } from 'vitest';
import { Vector3, Ray } from 'three/webgpu';
import { SpatialCanvas } from '../src/engine/SpatialCanvas';

describe('SpatialCanvas', () => {
  it('correctly intersects ray against plane', () => {
    const canvas = new SpatialCanvas({
      id: 'test_c1',
      name: 'Test Canvas',
      planeType: 'XY',
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      width: 10,
      height: 10,
      layers: [],
    });

    const ray = new Ray(new Vector3(2, 3, 5), new Vector3(0, 0, -1));
    const hit = canvas.intersectRay(ray);

    expect(hit).not.toBeNull();
    expect(hit!.x).toBeCloseTo(2, 4);
    expect(hit!.y).toBeCloseTo(3, 4);
    expect(hit!.z).toBeCloseTo(0, 4);
  });

  it('respects bounded flag for out-of-bounds ray hits', () => {
    const canvas = new SpatialCanvas({
      id: 'test_c2',
      name: 'Small Canvas',
      planeType: 'XY',
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      width: 4,
      height: 4,
      layers: [],
    });

    // Point outside half-width (4/2 = 2)
    const ray = new Ray(new Vector3(5, 0, 5), new Vector3(0, 0, -1));
    expect(canvas.intersectRay(ray, false)).not.toBeNull();
    expect(canvas.intersectRay(ray, true)).toBeNull();
  });

  it('dynamically expands bounds when points exceed current extents', () => {
    const canvas = new SpatialCanvas({
      id: 'test_c3',
      name: 'Expandable Canvas',
      planeType: 'XY',
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      width: 10,
      height: 10,
      layers: [],
    });

    expect(canvas.width).toBe(10);
    expect(canvas.height).toBe(10);

    canvas.expandBoundsToFit([new Vector3(15, 0, 0)]);
    expect(canvas.width).toBeGreaterThan(10);
  });
});
