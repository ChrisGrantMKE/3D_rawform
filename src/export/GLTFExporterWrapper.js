import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
/**
 * Serializes 3D spatial strokes and scene objects into glTF 2.0 (.glb) binary format.
 */
export class GLTFExporterWrapper {
    exporter;
    constructor() {
        this.exporter = new GLTFExporter();
    }
    /**
     * Parses an Object3D or Scene into a binary GLB ArrayBuffer.
     *
     * @param input - The scene or object root to serialize
     * @returns Promise resolving to ArrayBuffer containing .glb binary data
     */
    async exportGLB(input) {
        return new Promise((resolve, reject) => {
            this.exporter.parse(input, (result) => {
                if (result instanceof ArrayBuffer) {
                    resolve(result);
                }
                else {
                    const jsonStr = JSON.stringify(result);
                    const encoder = new TextEncoder();
                    resolve(encoder.encode(jsonStr).buffer);
                }
            }, (error) => reject(error), { binary: true });
        });
    }
    /**
     * Triggers download of the serialized scene as a .glb file.
     *
     * @param input - The scene or object root to export
     * @param filename - Target filename (default 'sketch.glb')
     */
    async downloadGLB(input, filename = 'sketch.glb') {
        const glbBuffer = await this.exportGLB(input);
        const blob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
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
