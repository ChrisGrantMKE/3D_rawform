import { Scene, Object3D } from 'three/webgpu';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/**
 * Serializes 3D spatial strokes and scene objects into glTF 2.0 (.glb) binary format.
 */
export class GLTFExporterWrapper {
  private readonly exporter: GLTFExporter;

  constructor() {
    this.exporter = new GLTFExporter();
  }

  /**
   * Parses an Object3D or Scene into a binary GLB ArrayBuffer.
   *
   * @param input - The scene or object root to serialize
   * @returns Promise resolving to ArrayBuffer containing .glb binary data
   */
  public async exportGLB(input: Object3D | Scene): Promise<ArrayBuffer> {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      this.exporter.parse(
        input,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const jsonStr = JSON.stringify(result);
            const encoder = new TextEncoder();
            resolve(encoder.encode(jsonStr).buffer);
          }
        },
        (error) => reject(error),
        { binary: true }
      );
    });
  }

  /**
   * Triggers download of the serialized scene as a .glb file.
   *
   * @param input - The scene or object root to export
   * @param filename - Target filename (default 'sketch.glb')
   */
  public async downloadGLB(input: Object3D | Scene, filename: string = 'sketch.glb'): Promise<void> {
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
