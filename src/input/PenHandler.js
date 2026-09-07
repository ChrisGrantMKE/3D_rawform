/**
 * Handles stylus hardware input with coalesced samples and pressure/tilt extraction.
 */
export class PenHandler {
    isDrawing = false;
    onPenDownCallback;
    onPenMoveCallback;
    onPenUpCallback;
    /**
     * Registers callbacks for pen lifecycle events.
     */
    setCallbacks(callbacks) {
        this.onPenDownCallback = callbacks.onDown;
        this.onPenMoveCallback = callbacks.onMove;
        this.onPenUpCallback = callbacks.onUp;
    }
    /**
     * Processes a pointerdown event from pen or primary mouse button.
     */
    handlePointerDown(event) {
        this.isDrawing = true;
        const isEraser = this.detectEraser(event);
        const point = this.extractStrokePoint(event);
        const samples = this.extractCoalescedPoints(event);
        this.onPenDownCallback?.({
            point,
            samples: samples.length > 0 ? samples : [point],
            isEraser,
            rawEvent: event,
        });
    }
    /**
     * Processes a pointermove event from pen.
     */
    handlePointerMove(event) {
        if (!this.isDrawing)
            return;
        const isEraser = this.detectEraser(event);
        const point = this.extractStrokePoint(event);
        const samples = this.extractCoalescedPoints(event);
        this.onPenMoveCallback?.({
            point,
            samples: samples.length > 0 ? samples : [point],
            isEraser,
            rawEvent: event,
        });
    }
    /**
     * Processes a pointerup or pointercancel event.
     */
    handlePointerUp(event) {
        if (!this.isDrawing)
            return;
        this.isDrawing = false;
        const isEraser = this.detectEraser(event);
        const point = this.extractStrokePoint(event);
        this.onPenUpCallback?.({
            point,
            samples: [point],
            isEraser,
            rawEvent: event,
        });
    }
    /**
     * Extracts calibrated stroke point attributes from a pointer event.
     */
    extractStrokePoint(event) {
        const rawPressure = event.pressure > 0 ? event.pressure : 0.5;
        return {
            x: event.clientX,
            y: event.clientY,
            z: 0,
            pressure: Math.max(0.05, Math.min(1.0, rawPressure)),
            tiltX: event.tiltX || 0,
            tiltY: event.tiltY || 0,
            time: event.timeStamp,
        };
    }
    /**
     * Retrieves high-frequency coalesced hardware samples if available.
     */
    extractCoalescedPoints(event) {
        if (typeof event.getCoalescedEvents === 'function') {
            const coalesced = event.getCoalescedEvents();
            if (coalesced && coalesced.length > 0) {
                return coalesced.map((e) => this.extractStrokePoint(e));
            }
        }
        return [this.extractStrokePoint(event)];
    }
    /**
     * Checks if the pointer event originates from an eraser tip or eraser barrel button.
     */
    detectEraser(event) {
        return event.button === 5 || (event.buttons & 32) === 32;
    }
}
