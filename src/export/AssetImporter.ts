import {
  Mesh,
  PlaneGeometry,
  MeshBasicNodeMaterial,
  TextureLoader,
  DoubleSide,
  Group,
  Vector3,
} from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { SpatialCanvas } from '../engine/SpatialCanvas';

/**
 * Handles importing 2D reference images onto spatial canvases and loading 3D glTF/GLB models.
 */
export class AssetImporter {
  private static gltfLoader = new GLTFLoader();
  private static textureLoader = new TextureLoader();

  /**
   * Imports an image file and attaches it as a textured reference plane.
   *
   * @param file - Image file (PNG, JPEG, WebP)
   * @param canvas - Optional spatial canvas to align with
   * @returns Created reference plane Mesh
   */
  public static async importReferenceImage(
    file: File,
    canvas?: SpatialCanvas
  ): Promise<Mesh> {
    const objectUrl = URL.createObjectURL(file);

    return new Promise<Mesh>((resolve, reject) => {
      this.textureLoader.load(
        objectUrl,
        (texture) => {
          URL.revokeObjectURL(objectUrl);
          const aspect = texture.image.width / texture.image.height;
          const height = canvas ? canvas.height : 6;
          const width = height * aspect;

          const geometry = new PlaneGeometry(width, height);
          const material = new MeshBasicNodeMaterial();
          material.colorNode = null;
          material.color.set(0xffffff);
          material.map = texture;
          material.transparent = true;
          material.opacity = 0.8;
          material.side = DoubleSide;
          material.depthWrite = false;

          const mesh = new Mesh(geometry, material);
          mesh.name = `ReferenceImage_${file.name}`;

          if (canvas) {
            mesh.position.copy(canvas.getObject().position);
            mesh.quaternion.copy(canvas.getObject().quaternion);
            mesh.position.add(new Vector3(0, 0, 0.01)); // Slight offset to avoid z-fighting
          }

          resolve(mesh);
        },
        undefined,
        (error) => {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      );
    });
  }

  /**
   * Imports a glTF / GLB 3D model file as a reference object in the spatial scene.
   *
   * @param file - 3D model file (.gltf or .glb)
   * @returns Root Group containing imported 3D model
   */
  public static async importGLTFModel(file: File): Promise<Group> {
    const buffer = await file.arrayBuffer();

    return new Promise<Group>((resolve, reject) => {
      this.gltfLoader.parse(
        buffer,
        '',
        (gltf) => {
          const root = gltf.scene;
          root.name = `ReferenceModel_${file.name}`;
          resolve(root);
        },
        (error) => reject(error)
      );
    });
  }
}
