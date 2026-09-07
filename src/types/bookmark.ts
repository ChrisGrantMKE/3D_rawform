/**
 * Saved camera keyframe bookmark for spatial storytelling tours.
 */
export interface CameraBookmark {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  duration: number; // Transition duration in seconds to this bookmark
  holdTime: number; // Idle pause time at this bookmark in seconds
  easing?: string; // GSAP easing curve name (e.g. 'power2.inOut')
  canvasVisibility?: Record<string, boolean>; // Per-bookmark canvas visibility overrides
}

/**
 * Playback options for animated camera tour flythroughs.
 */
export interface FlythroughOptions {
  loop: boolean;
  onBookmarkReached?: (bookmark: CameraBookmark, index: number) => void;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}
