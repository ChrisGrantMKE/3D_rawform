import {
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  MeshBasicNodeMaterial,
  BackSide,
  DoubleSide,
  Color,
} from 'three/webgpu';
import {
  positionWorld,
  fract,
  length,
  smoothstep,
  distance,
  cameraPosition,
  vec4,
  mix,
  clamp,
  uniform,
} from 'three/tsl';

/**
 * Procedural infinite ground dot matrix and atmospheric horizon environment.
 * Replaces wireframe grid boxes with an airport-runway-style stippled dot field
 * and atmospheric depth gradient extending from horizon into the sky.
 * Adapts dynamically to dark, studio, light, and transparent background themes.
 */
export class AtmosphereEnvironment {
  private readonly group: Group;
  private groundMesh: Mesh;
  private skyDomeMesh: Mesh;

  // Dynamic TSL uniforms for theme transitions
  private dotColorUniform = uniform(new Color(0xd2e1fa));
  private groundNearUniform = uniform(new Color(0x080a0f));
  private groundFarUniform = uniform(new Color(0x040507));
  private groundAlphaUniform = uniform(0.25);
  private zenithUniform = uniform(new Color(0x090b0f));
  private horizonUniform = uniform(new Color(0x181e2a));
  private abyssUniform = uniform(new Color(0x06080a));

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
   * Updates environment palette and lighting theme to match active view style.
   *
   * @param style - 'dark' | 'studio' | 'light' | 'transparent'
   */
  public setStyle(style: 'dark' | 'studio' | 'light' | 'transparent'): void {
    if (style === 'light') {
      this.groundMesh.visible = true;
      this.skyDomeMesh.visible = true;
      // High-contrast slate charcoal dots against light architectural ground
      this.dotColorUniform.value.set(0x334155);
      this.groundNearUniform.value.set(0xf1f5f9);
      this.groundFarUniform.value.set(0xe2e8f0);
      this.groundAlphaUniform.value = 0.55;
      this.zenithUniform.value.set(0xf8fafc);
      this.horizonUniform.value.set(0xe2e8f0);
      this.abyssUniform.value.set(0xf1f5f9);
    } else if (style === 'studio') {
      this.groundMesh.visible = true;
      this.skyDomeMesh.visible = true;
      // Vibrant electric cyan dots in a dark studio vignette
      this.dotColorUniform.value.set(0x82b4ff);
      this.groundNearUniform.value.set(0x10141c);
      this.groundFarUniform.value.set(0x181e28);
      this.groundAlphaUniform.value = 0.25;
      this.zenithUniform.value.set(0x10141e);
      this.horizonUniform.value.set(0x1f2838);
      this.abyssUniform.value.set(0x0c0f17);
    } else if (style === 'transparent') {
      this.groundMesh.visible = true;
      this.skyDomeMesh.visible = false; // Hide sky dome to preserve alpha canvas
      this.dotColorUniform.value.set(0x60a5fa);
      this.groundNearUniform.value.set(0x000000);
      this.groundFarUniform.value.set(0x000000);
      this.groundAlphaUniform.value = 0.0; // Pure alpha ground, dots float in 3D
    } else {
      // Default: Dark
      this.groundMesh.visible = true;
      this.skyDomeMesh.visible = true;
      this.dotColorUniform.value.set(0xd2e1fa);
      this.groundNearUniform.value.set(0x080a0f);
      this.groundFarUniform.value.set(0x040507);
      this.groundAlphaUniform.value = 0.25;
      this.zenithUniform.value.set(0x090b0f);
      this.horizonUniform.value.set(0x181e2a);
      this.abyssUniform.value.set(0x06080a);
    }
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
    const groundColor = mix(this.groundNearUniform, this.groundFarUniform, groundShade);

    // Blend dots onto ground base
    const totalAlpha = clamp(dotAlpha.mul(distanceFade).mul(0.85).add(this.groundAlphaUniform), 0.0, 0.95);
    const finalColor = mix(groundColor, this.dotColorUniform, dotAlpha.mul(distanceFade));

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

    // Sky above horizon
    const skyFactor = clamp(normalizedY, 0.0, 1.0);
    const skyGradient = mix(this.horizonUniform, this.zenithUniform, skyFactor);

    // Ground below horizon
    const groundFactor = clamp(normalizedY.negate(), 0.0, 1.0);
    const fullGradient = mix(skyGradient, this.abyssUniform, groundFactor);

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
