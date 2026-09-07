/**
 * Handles multi-touch gestures (1-finger orbit, 2-finger pan & pinch-zoom).
 */
export class TouchHandler {
    activeTouches = new Map();
    prevTouchDistance = 0;
    prevCenter = { x: 0, y: 0 };
    callbacks;
    /**
     * Registers gesture output callbacks.
     */
    setCallbacks(callbacks) {
        this.callbacks = callbacks;
    }
    /**
     * Handles touch pointerdown.
     */
    handlePointerDown(event) {
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
    handlePointerMove(event) {
        const prev = this.activeTouches.get(event.pointerId);
        if (!prev)
            return;
        const current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        this.activeTouches.set(event.pointerId, current);
        if (this.activeTouches.size === 1) {
            // 1-finger orbit
            const dx = current.x - prev.x;
            const dy = current.y - prev.y;
            this.callbacks?.onOrbit(dx * 0.005, dy * 0.005);
        }
        else if (this.activeTouches.size === 2) {
            // 2-finger pinch & pan
            this.processTwoFingerGesture();
        }
    }
    /**
     * Handles touch pointerup or cancel.
     */
    handlePointerUp(event) {
        this.activeTouches.delete(event.pointerId);
        if (this.activeTouches.size === 2) {
            this.initTwoFingerGesture();
        }
    }
    /**
     * Initializes baseline distance and midpoint for 2-finger gestures.
     */
    initTwoFingerGesture() {
        const touches = Array.from(this.activeTouches.values());
        if (touches.length < 2)
            return;
        this.prevTouchDistance = Math.hypot(touches[0].x - touches[1].x, touches[0].y - touches[1].y);
        this.prevCenter = {
            x: (touches[0].x + touches[1].x) / 2,
            y: (touches[0].y + touches[1].y) / 2,
        };
    }
    /**
     * Computes 2-finger pan displacement and pinch zoom ratio.
     */
    processTwoFingerGesture() {
        const touches = Array.from(this.activeTouches.values());
        if (touches.length < 2)
            return;
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
