import {
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  MeshBasicNodeMaterial,
  BackSide,
  DoubleSide,
} from 'three/webgpu';
import {
  positionWorld,
  fract,
  length,
  smoothstep,
  distance,
  cameraPosition,
  vec4,
  vec3,
  mix,
  clamp,
} from 'three/tsl';

/**
 * Procedural infinite ground dot matrix and atmospheric horizon environment.
 * Replaces wireframe grid boxes with an airport-runway-style stippled dot field
 * and atmospheric depth gradient extending from horizon into the sky.
 */
export class AtmosphereEnvironment {
  private readonly group: Group;
  private groundMesh: Mesh;
  private skyDomeMesh: Mesh;

  constructor() {
    this.group = new Group();
    this.group.name = 'AtmosphereEnvironment_Group';

    this.groundMesh = this.createGroundDotMatrix();
    this.skyDomeMesh = this.createAtmosphericSkyDome();

    this.group.add(this.skyDomeMesh);
    this.group.add(this.groundMesh);
  }

  /**
   * Returns Three.js container group for scene insertion.
   */
  public getObject(): Group {
    return this.group;
  }

  /**
   * Toggles visibility of the environment.
   */
  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /**
   * Creates the infinite dot matrix ground plane using TSL shader nodes.
   */
  private createGroundDotMatrix(): Mesh {
    const geo = new PlaneGeometry(1200, 1200, 1, 1);
    geo.rotateX(-Math.PI / 2);

    const mat = new MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.side = DoubleSide;

    // World XZ coordinates
    const posXZ = positionWorld.xz;

    // 1.0 unit dot matrix spacing
    const cell = fract(posXZ).sub(0.5);
    const dist = length(cell);

    // Anti-aliased circular dots
    const dotAlpha = smoothstep(0.045, 0.025, dist);

    // Distance falloff from camera to horizon
    const camDist = distance(cameraPosition, positionWorld);
    const distanceFade = smoothstep(90.0, 12.0, camDist);

    // Ground horizon shading: deeper near camera, fading towards horizon
    const groundShade = smoothstep(120.0, 5.0, camDist);
    const groundColor = mix(vec3(0.08, 0.10, 0.15), vec3(0.04, 0.05, 0.07), groundShade);

    // Airport runway inverted dot color (crisp high-contrast ice-blue / silver)
    const dotColor = vec3(0.82, 0.88, 0.98);

    // Blend dots onto ground base
    const totalAlpha = clamp(dotAlpha.mul(distanceFade).mul(0.75).add(0.25), 0.0, 0.95);
    const finalColor = mix(groundColor, dotColor, dotAlpha.mul(distanceFade));

    mat.colorNode = vec4(finalColor, totalAlpha);

    const mesh = new Mesh(geo, mat);
    mesh.name = 'Environment_GroundDotMatrix';
    mesh.position.y = -2; // Standard floor level
    return mesh;
  }

  /**
   * Creates atmospheric horizon sky dome with vertical gradient shading.
   */
  private createAtmosphericSkyDome(): Mesh {
    const geo = new SphereGeometry(600, 32, 16);

    const mat = new MeshBasicNodeMaterial();
    mat.side = BackSide;
    mat.depthWrite = false;

    // Vertical height gradient (world Y)
    const normalizedY = positionWorld.y.div(300.0);

    // Deep space zenith -> soft glowing horizon haze -> deep floor abyss
    const zenithColor = vec3(0.035, 0.042, 0.058);   // #090b0f
    const horizonColor = vec3(0.095, 0.118, 0.165);  // #181e2a soft atmospheric haze
    const abyssColor = vec3(0.025, 0.030, 0.040);    // #06080a

    // Sky above horizon
    const skyFactor = clamp(normalizedY, 0.0, 1.0);
    const skyGradient = mix(horizonColor, zenithColor, skyFactor);

    // Ground below horizon
    const groundFactor = clamp(normalizedY.negate(), 0.0, 1.0);
    const fullGradient = mix(skyGradient, abyssColor, groundFactor);

    mat.colorNode = vec4(fullGradient, 1.0);

    const mesh = new Mesh(geo, mat);
    mesh.name = 'Environment_SkyDome';
    return mesh;
  }

  /**
   * Disposes of geometry and materials.
   */
  public dispose(): void {
    this.groundMesh.geometry.dispose();
    (this.groundMesh.material as MeshBasicNodeMaterial).dispose();
    this.skyDomeMesh.geometry.dispose();
    (this.skyDomeMesh.material as MeshBasicNodeMaterial).dispose();
  }
}
