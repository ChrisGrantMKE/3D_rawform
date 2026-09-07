/**
 * Exports viewport snapshot as high-resolution PNG image.
 */
export class ImageExporter {
    /**
     * Captures PNG data URL from the target canvas element.
     *
     * @param canvasElement - The WebGPU HTMLCanvasElement
     * @returns Base64 image data URL
     */
    static captureDataURL(canvasElement) {
        return canvasElement.toDataURL('image/png');
    }
    /**
     * Triggers download of the current canvas view as a PNG file.
     *
     * @param canvasElement - The WebGPU HTMLCanvasElement
     * @param filename - Target filename (default 'sketch.png')
     */
    static downloadSnapshot(canvasElement, filename = 'sketch.png') {
        const dataUrl = this.captureDataURL(canvasElement);
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }
}
