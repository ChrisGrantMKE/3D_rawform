import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import gsap from 'gsap';
import type { CameraBookmark, FlythroughOptions } from '../types/bookmark';
import type { CameraController } from './CameraController';

/**
 * Storytelling camera animator coordinating flythrough tours and bookmark transitions via GSAP and Quaternion SLERP.
 */
export class CameraAnimator {
  private readonly camera: PerspectiveCamera;
  private readonly controller: CameraController;
  private timeline: gsap.core.Timeline | null = null;
  private isTourPlaying: boolean = false;

  /**
   * Initializes the camera animator.
   *
   * @param camera - Three.js perspective camera
   * @param controller - Camera navigation controller
   */
  constructor(camera: PerspectiveCamera, controller: CameraController) {
    this.camera = camera;
    this.controller = controller;
  }

  /**
   * Smoothly animates the camera to a single bookmark viewpoint.
   *
   * @param bookmark - Target camera bookmark
   * @param onComplete - Optional callback when transition finishes
   */
  public flyToBookmark(bookmark: CameraBookmark, onComplete?: () => void): void {
    this.stop();

    const startPos = this.camera.position.clone();
    const endPos = new Vector3(...bookmark.position);
    const startTarget = this.controller.getTarget();
    const endTarget = new Vector3(...bookmark.target);

    const startQuat = this.camera.quaternion.clone();
    const tempCam = this.camera.clone();
    tempCam.position.copy(endPos);
    tempCam.lookAt(endTarget);
    const endQuat = tempCam.quaternion.clone();

    const animObj = { progress: 0 };
    gsap.to(animObj, {
      progress: 1,
      duration: bookmark.duration || 1.8,
      ease: bookmark.easing || 'power2.inOut',
      onUpdate: () => {
        this.camera.position.lerpVectors(startPos, endPos, animObj.progress);
        const currentTarget = new Vector3().lerpVectors(startTarget, endTarget, animObj.progress);
        this.camera.quaternion.copy(startQuat).slerp(endQuat, animObj.progress);
        this.camera.lookAt(currentTarget);
      },
      onComplete: () => {
        this.camera.position.copy(endPos);
        this.camera.lookAt(endTarget);
        onComplete?.();
      },
    });
  }

  /**
   * Plays a sequential animated camera flythrough across an array of bookmarks.
   *
   * @param bookmarks - Ordered list of camera bookmarks
   * @param options - Playback configuration and event callbacks
   */
  public playTour(bookmarks: CameraBookmark[], options?: FlythroughOptions): void {
    if (bookmarks.length < 2) {
      if (bookmarks.length === 1) {
        this.flyToBookmark(bookmarks[0], options?.onComplete);
      }
      return;
    }

    this.stop();
    this.isTourPlaying = true;

    this.timeline = gsap.timeline({
      repeat: options?.loop ? -1 : 0,
      onUpdate: () => {
        if (this.timeline && options?.onUpdate) {
          options.onUpdate(this.timeline.progress());
        }
      },
      onComplete: () => {
        this.isTourPlaying = false;
        options?.onComplete?.();
      },
    });

    for (let i = 0; i < bookmarks.length; i++) {
      const current = bookmarks[i];
      const next = bookmarks[(i + 1) % bookmarks.length];

      if (!options?.loop && i === bookmarks.length - 1) {
        break;
      }

      this.addTourSegment(this.timeline, current, next, i, options);
    }

    this.timeline.play();
  }

  /**
   * Pauses the active flythrough tour.
   */
  public pause(): void {
    this.timeline?.pause();
    this.isTourPlaying = false;
  }

  /**
   * Resumes the paused flythrough tour.
   */
  public resume(): void {
    this.timeline?.resume();
    this.isTourPlaying = true;
  }

  /**
   * Stops and resets the active flythrough tour.
   */
  public stop(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
    this.isTourPlaying = false;
  }

  /**
   * Seeks the active tour to a normalized progress value (0.0 to 1.0).
   *
   * @param progress - Normalized timeline progress
   */
  public seek(progress: number): void {
    this.timeline?.progress(Math.max(0, Math.min(1, progress)));
  }

  /**
   * Returns whether a tour animation is currently playing.
   */
  public isPlaying(): boolean {
    return this.isTourPlaying;
  }

  /**
   * Disposes active animations.
   */
  public dispose(): void {
    this.stop();
  }

  /**
   * Constructs an individual transition segment between two bookmarks.
   */
  private addTourSegment(
    tl: gsap.core.Timeline,
    from: CameraBookmark,
    to: CameraBookmark,
    index: number,
    options?: FlythroughOptions
  ): void {
    const duration = to.duration || 2.5;
    const holdTime = from.holdTime || 0.5;

    const fromPos = new Vector3(...from.position);
    const toPos = new Vector3(...to.position);
    const fromTarget = new Vector3(...from.target);
    const toTarget = new Vector3(...to.target);

    const tempCam = this.camera.clone();
    tempCam.position.copy(fromPos);
    tempCam.lookAt(fromTarget);
    const startQuat = tempCam.quaternion.clone();

    tempCam.position.copy(toPos);
    tempCam.lookAt(toTarget);
    const endQuat = tempCam.quaternion.clone();

    const segmentObj = { progress: 0 };

    tl.call(() => {
      options?.onBookmarkReached?.(from, index);
    });

    if (holdTime > 0) {
      tl.to({}, { duration: holdTime });
    }

    tl.to(segmentObj, {
      progress: 1,
      duration,
      ease: to.easing || 'power1.inOut',
      onUpdate: () => {
        this.camera.position.lerpVectors(fromPos, toPos, segmentObj.progress);
        const curTarget = new Vector3().lerpVectors(fromTarget, toTarget, segmentObj.progress);
        this.camera.quaternion.copy(startQuat).slerp(endQuat, segmentObj.progress);
        this.camera.lookAt(curTarget);
      },
    });
  }
}
