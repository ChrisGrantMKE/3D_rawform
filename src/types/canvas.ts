/**
 * Standard spatial plane orientation.
 */
export type SpatialPlaneType = 'XY' | 'XZ' | 'YZ' | 'CUSTOM';

/**
 * Metadata and spatial positioning of a 2D canvas in 3D space.
 */
export interface SpatialCanvasData {
  id: string;
  name: string;
  planeType: SpatialPlaneType;
  position: [number, number, number];
  rotation: [number, number, number, number]; // Quaternion [x, y, z, w]
  width: number;
  height: number;
  opacity: number;
  isVisible: boolean;
  isLocked: boolean;
  strokeIds: string[];
}
