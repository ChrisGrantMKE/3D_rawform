import { BufferTarget, Output, Mp4OutputFormat, CanvasSource } from 'mediabunny';
import type { CameraBookmark } from '../types/bookmark';
import type { CameraAnimator } from '../engine/CameraAnimator';

export interface VideoExportOptions {
  fps?: number;
  filename?: string;
  bitrate?: number;
  onProgress?: (progress: number, frame: number, totalFrames: number) => void;
}

/**
 * High-performance MP4 video exporter using mediabunny and WebCodecs.
 * Renders flythrough camera bookmark animations into downloadable .mp4 video files.
 */
export class VideoExporter {
  /**
   * Renders the flythrough bookmark sequence to an MP4 video file.
   *
   * @param canvas - WebGL/WebGPU rendering canvas
   * @param scene - Three.js active scene
   * @param camera - Active camera
   * @param renderFrame - Callback to trigger synchronous scene render
   * @param animator - CameraAnimator reference
   * @param bookmarks - Camera bookmarks
   * @param options - Export options (fps, bitrate, onProgress)
   */
  public static async exportFlythrough(
    canvas: HTMLCanvasElement,
    renderFrame: () => void,
    animator: CameraAnimator,
    bookmarks: CameraBookmark[],
    options: VideoExportOptions = {}
  ): Promise<Blob | null> {
    if (bookmarks.length < 2) {
      throw new Error('At least 2 bookmarks are required to export a flythrough video.');
    }

    const fps = options.fps || 30;
    const bitrate = options.bitrate || 4_000_000;
    const filename = options.filename || `spatial_tour_${Date.now()}.mp4`;

    const tl = animator.createOfflineTimeline(bookmarks);
    const totalDuration = tl.totalDuration();
    if (totalDuration <= 0) return null;

    const totalFrames = Math.ceil(totalDuration * fps);
    const frameDuration = 1 / fps;

    const target = new BufferTarget();
    const output = new Output({
      target,
      format: new Mp4OutputFormat(),
    });

    const source = new CanvasSource(canvas, {
      codec: 'avc',
      bitrate,
    });

    output.addVideoTrack(source);
    await output.start();

    for (let f = 0; f <= totalFrames; f++) {
      const time = Math.min(f * frameDuration, totalDuration);
      tl.time(time);
      renderFrame();

      await source.add(time, frameDuration);
      options.onProgress?.(f / totalFrames, f, totalFrames);
    }

    await output.finalize();
    tl.kill();

    if (!target.buffer) {
      throw new Error('Video encoding produced an empty output buffer.');
    }

    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    this.downloadBlob(blob, filename);

    return blob;
  }

  /**
   * Triggers client-side browser download of the generated video blob.
   */
  private static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
