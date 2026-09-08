import { Scene, Object3D } from 'three/webgpu';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

/**
 * Serializes 3D spatial strokes and scene objects into Wavefront .obj text format.
 */
export class OBJExporterWrapper {
  private readonly exporter: OBJExporter;

  constructor() {
    this.exporter = new OBJExporter();
  }

  /**
   * Parses an Object3D or Scene into an OBJ format string.
   *
   * @param input - The scene or object root to serialize
   * @returns OBJ formatted string
   */
  public exportOBJ(input: Object3D | Scene): string {
    return this.exporter.parse(input);
  }

  /**
   * Triggers browser download of the serialized scene as an .obj file.
   *
   * @param input - The scene or object root to export
   * @param filename - Target filename (default 'sketch.obj')
   */
  public downloadOBJ(input: Object3D | Scene, filename: string = 'sketch.obj'): void {
    const objString = this.exportOBJ(input);
    const blob = new Blob([objString], { type: 'text/plain' });
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
