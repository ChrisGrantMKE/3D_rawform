interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface TouchGestureCallbacks {
  onOrbit: (deltaTheta: number, deltaPhi: number) => void;
  onPan: (deltaX: number, deltaY: number) => void;
  onZoom: (deltaFactor: number) => void;
  onGestureEnd?: () => void;
}

/**
 * Handles multi-touch gestures (1-finger orbit, 2-finger pan & pinch-zoom).
 */
export class TouchHandler {
  private activeTouches: Map<number, TouchPoint> = new Map();
  private prevTouchDistance: number = 0;
  private prevCenter: { x: number; y: number } = { x: 0, y: 0 };
  private callbacks?: TouchGestureCallbacks;

  /**
   * Registers gesture output callbacks.
   */
  public setCallbacks(callbacks: TouchGestureCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Handles touch pointerdown.
   */
  public handlePointerDown(event: PointerEvent): void {
    this.activeTouches.set(event.pointerId, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });

    if (this.activeTouches.size === 2) {
      this.initTwoFingerGesture();
    }
  }

  /**
   * Handles touch pointermove.
   */
  public handlePointerMove(event: PointerEvent): void {
    const prev = this.activeTouches.get(event.pointerId);
    if (!prev) return;

    const current: TouchPoint = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.activeTouches.set(event.pointerId, current);

    if (this.activeTouches.size === 1) {
      // 1-finger orbit
      const dx = current.x - prev.x;
      const dy = current.y - prev.y;
      this.callbacks?.onOrbit(dx * 0.005, dy * 0.005);
    } else if (this.activeTouches.size === 2) {
      // 2-finger pinch & pan
      this.processTwoFingerGesture();
    }
  }

  /**
   * Handles touch pointerup or cancel.
   */
  public handlePointerUp(event: PointerEvent): void {
    this.activeTouches.delete(event.pointerId);
    if (this.activeTouches.size === 2) {
      this.initTwoFingerGesture();
    } else if (this.activeTouches.size === 0) {
      this.callbacks?.onGestureEnd?.();
    }
  }

  /**
   * Initializes baseline distance and midpoint for 2-finger gestures.
   */
  private initTwoFingerGesture(): void {
    const touches = Array.from(this.activeTouches.values());
    if (touches.length < 2) return;

    this.prevTouchDistance = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
    this.prevCenter = {
      x: (touches[0].x + touches[1].x) / 2,
      y: (touches[0].y + touches[1].y) / 2,
    };
  }

  /**
   * Computes 2-finger pan displacement and pinch zoom ratio.
   */
  private processTwoFingerGesture(): void {
    const touches = Array.from(this.activeTouches.values());
    if (touches.length < 2) return;

    const currentDist = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
    const currentCenter = {
      x: (touches[0].x + touches[1].x) / 2,
      y: (touches[0].y + touches[1].y) / 2,
    };

    if (this.prevTouchDistance > 0 && currentDist > 0) {
      const zoomRatio = this.prevTouchDistance / currentDist;
      this.callbacks?.onZoom(zoomRatio);
    }

    const panDx = currentCenter.x - this.prevCenter.x;
    const panDy = currentCenter.y - this.prevCenter.y;
    this.callbacks?.onPan(panDx, panDy);

    this.prevTouchDistance = currentDist;
    this.prevCenter = currentCenter;
  }
}
