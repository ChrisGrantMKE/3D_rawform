import { describe, it, expect } from 'vitest';
import { CurveSmoothing } from '../src/engine/CurveSmoothing';
import type { StrokePoint } from '../src/types/stroke';

describe('CurveSmoothing', () => {
  it('returns raw points if count is 2 or less', () => {
    const points: StrokePoint[] = [
      { x: 0, y: 0, z: 0, pressure: 0.5, tiltX: 0, tiltY: 0, time: 100 },
      { x: 1, y: 1, z: 0, pressure: 0.8, tiltX: 0, tiltY: 0, time: 120 },
    ];

    const result = CurveSmoothing.smooth(points);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(points[0]);
    expect(result[1]).toEqual(points[1]);
  });

  it('interpolates intermediate points preserving start and end coordinates', () => {
    const points: StrokePoint[] = [
      { x: 0, y: 0, z: 0, pressure: 0.2, tiltX: 0, tiltY: 0, time: 0 },
      { x: 2, y: 4, z: 0, pressure: 0.5, tiltX: 0, tiltY: 0, time: 50 },
      { x: 4, y: 0, z: 0, pressure: 0.8, tiltX: 0, tiltY: 0, time: 100 },
      { x: 6, y: 4, z: 0, pressure: 0.3, tiltX: 0, tiltY: 0, time: 150 },
    ];

    const smoothed = CurveSmoothing.smooth(points, 0.5, 0.5);

    expect(smoothed.length).toBeGreaterThan(points.length);
    expect(smoothed[0].x).toBeCloseTo(points[0].x, 2);
    expect(smoothed[0].y).toBeCloseTo(points[0].y, 2);
    const last = smoothed[smoothed.length - 1];
    expect(last.x).toBeCloseTo(points[points.length - 1].x, 2);
    expect(last.y).toBeCloseTo(points[points.length - 1].y, 2);
  });
});
