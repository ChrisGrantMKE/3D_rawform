import { Vector3 } from 'three/webgpu';
/**
 * Curve smoothing utility using Catmull-Rom spline interpolation and arc-length resampling.
 */
export class CurveSmoothing {
    /**
     * Resamples and smooths input stroke points along a Catmull-Rom spline.
     *
     * @param rawPoints - Original sampled points from pointer input
     * @param minDistance - Target arc-length distance between sampled points
     * @param tension - Spline tension (0.0 to 1.0, default 0.5)
     * @returns Smoothed array of stroke points
     */
    static smooth(rawPoints, minDistance = 2.0, tension = 0.5) {
        if (rawPoints.length <= 2) {
            return [...rawPoints];
        }
        const smoothed = [];
        const n = rawPoints.length;
        for (let i = 0; i < n - 1; i++) {
            const p0 = rawPoints[Math.max(0, i - 1)];
            const p1 = rawPoints[i];
            const p2 = rawPoints[i + 1];
            const p3 = rawPoints[Math.min(n - 1, i + 2)];
            const segmentPoints = this.interpolateSegment(p0, p1, p2, p3, minDistance, tension);
            for (const pt of segmentPoints) {
                smoothed.push(pt);
            }
        }
        smoothed.push(rawPoints[n - 1]);
        return smoothed;
    }
    /**
     * Interpolates between p1 and p2 using Catmull-Rom formulation.
     */
    static interpolateSegment(p0, p1, p2, p3, minDistance, tension) {
        const v1 = new Vector3(p1.x, p1.y, p1.z);
        const v2 = new Vector3(p2.x, p2.y, p2.z);
        const dist = v1.distanceTo(v2);
        const steps = Math.max(1, Math.ceil(dist / minDistance));
        const result = [];
        for (let step = 0; step < steps; step++) {
            const t = step / steps;
            const point = this.calculateSplinePoint(p0, p1, p2, p3, t, tension);
            result.push(point);
        }
        return result;
    }
    /**
     * Computes a single interpolated point and attributes at parameter t.
     */
    static calculateSplinePoint(p0, p1, p2, p3, t, tension) {
        const t2 = t * t;
        const t3 = t2 * t;
        const s = (1 - tension) * 0.5;
        const b0 = -s * t3 + 2 * s * t2 - s * t;
        const b1 = (2 - s) * t3 + (s - 3) * t2 + 1;
        const b2 = (s - 2) * t3 + (3 - 2 * s) * t2 + s * t;
        const b3 = s * t3 - s * t2;
        const x = b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x;
        const y = b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y;
        const z = b0 * p0.z + b1 * p1.z + b2 * p2.z + b3 * p3.z;
        const pressure = p1.pressure + (p2.pressure - p1.pressure) * t;
        const tiltX = p1.tiltX + (p2.tiltX - p1.tiltX) * t;
        const tiltY = p1.tiltY + (p2.tiltY - p1.tiltY) * t;
        const time = p1.time + (p2.time - p1.time) * t;
        return { x, y, z, pressure, tiltX, tiltY, time };
    }
}
