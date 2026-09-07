import type { SpatialCanvasData } from './canvas';
import type { StrokeData } from './stroke';
import type { CameraBookmark } from './bookmark';

/**
 * Camera position and orientation snapshot.
 */
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/**
 * Top-level project manifest document for .rawform serialization and Dexie storage.
 */
export interface ProjectData {
  id: string;
  name: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  activeCanvasId: string;
  camera: CameraState;
  canvases: SpatialCanvasData[];
  strokes: StrokeData[];
  bookmarks: CameraBookmark[];
}
