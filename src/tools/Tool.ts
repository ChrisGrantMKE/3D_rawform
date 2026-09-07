import type { StrokePoint } from '../types/stroke';

/**
 * Abstract base class for all interactive drawing and editing tools.
 */
export abstract class Tool {
  public abstract readonly name: string;

  /**
   * Invoked when pointer contacts the screen.
   */
  public abstract onPointerDown(
    point: StrokePoint,
    samples: StrokePoint[],
    event: PointerEvent
  ): void;

  /**
   * Invoked when pointer moves across the screen.
   */
  public abstract onPointerMove(
    point: StrokePoint,
    samples: StrokePoint[],
    event: PointerEvent
  ): void;

  /**
   * Invoked when pointer lifts from the screen.
   */
  public abstract onPointerUp(point: StrokePoint, event: PointerEvent): void;

  /**
   * Cancels active tool operation without committing changes.
   */
  public abstract cancel(): void;
}
