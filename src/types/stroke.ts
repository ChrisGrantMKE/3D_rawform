/**
 * Represents a single sampled point from stylus or pointer input.
 */
export interface StrokePoint {
  x: number;
  y: number;
  z: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  time: number;
}

/**
 * Brush profile settings controlling stroke behavior and aesthetics.
 */
export interface BrushProfile {
  id: string;
  name: string;
  baseWidth: number;
  minWidthRatio: number;
  maxWidthRatio: number;
  pressureSensitivity: number;
  smoothingTension: number;
  opacity: number;
}

/**
 * Serialized stroke data record.
 */
export interface StrokeData {
  id: string;
  canvasId: string;
  color: string;
  width: number;
  opacity: number;
  pointCount: number;
  timestamp: number;
  /**
   * Stored as interleaved Float32Array:
   * [x, y, z, pressure, tiltX, tiltY, time, ...] (7 floats per point)
   */
  binaryPath?: string;
  points?: Float32Array;
}
