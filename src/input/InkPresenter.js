/**
 * Low-latency direct OS compositor ink trail presenter using the Web Ink API.
 */
export class InkPresenter {
    presenter = null;
    isSupported = false;
    /**
     * Initializes the InkPresenter on the target presentation container.
     *
     * @param targetElement - Canvas container element
     */
    async init(targetElement) {
        const nav = navigator;
        if (nav.ink && typeof nav.ink.requestPresenter === 'function') {
            try {
                this.presenter = await nav.ink.requestPresenter({ presentationArea: targetElement });
                this.isSupported = true;
            }
            catch {
                this.isSupported = false;
                this.presenter = null;
            }
        }
    }
    /**
     * Updates OS-level ink trail start point for ultra-low latency drawing.
     *
     * @param event - Active stylus PointerEvent
     * @param color - Hex color string
     * @param diameter - Stroke diameter in CSS pixels
     */
    updateTrail(event, color, diameter) {
        if (!this.isSupported || !this.presenter) {
            return;
        }
        try {
            this.presenter.updateInkTrailStartPoint(event, {
                color,
                diameter: Math.max(1, diameter),
            });
        }
        catch {
            // Ignored if compositor buffer is temporarily locked
        }
    }
    /**
     * Returns whether Web Ink API is supported on this client device.
     */
    getSupported() {
        return this.isSupported;
    }
}
