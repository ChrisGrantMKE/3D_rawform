/**
 * 3-tier palm rejection filter for stylus drawing.
 */
export class PalmRejection {
    penIsDown = false;
    lastPenTime = 0;
    temporalThresholdMs = 100;
    palmContactThresholdPx = 25;
    /**
     * Records that stylus has contacted the screen.
     */
    notifyPenDown() {
        this.penIsDown = true;
        this.lastPenTime = performance.now();
    }
    /**
     * Records that stylus has left the screen.
     */
    notifyPenUp() {
        this.penIsDown = false;
        this.lastPenTime = performance.now();
    }
    /**
     * Evaluates whether an incoming touch event should be rejected as a palm contact.
     *
     * @param event - PointerEvent to evaluate
     * @returns True if the event should be rejected, false if valid user touch
     */
    shouldRejectTouch(event) {
        // Tier 1: Reject if pen is currently down
        if (this.penIsDown) {
            return true;
        }
        // Tier 2: Temporal guard window (within 100ms of last pen interaction)
        const now = performance.now();
        if (now - this.lastPenTime < this.temporalThresholdMs) {
            return true;
        }
        // Tier 3: Contact geometry / area thresholding
        if (event.width > this.palmContactThresholdPx || event.height > this.palmContactThresholdPx) {
            return true;
        }
        return false;
    }
}
