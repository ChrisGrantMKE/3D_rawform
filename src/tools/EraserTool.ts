import { Raycaster, Vector2, PerspectiveCamera } from 'three/webgpu';
import { Tool } from './Tool';
import type { StrokeRenderer } from '../engine/StrokeRenderer';
import type { ProjectState } from '../state/ProjectState';
import type { UndoRedoManager, Command } from '../state/UndoRedoManager';
import type { StrokePoint, StrokeData } from '../types/stroke';

/**
 * Command for removing a stroke with undo/redo capability.
 */
class DeleteStrokeCommand implements Command {
  constructor(
    private state: ProjectState,
    private renderer: StrokeRenderer,
    private stroke: StrokeData,
    private binaryBuffer: Float32Array,
    private points: StrokePoint[]
  ) {}

  public async execute(): Promise<void> {
    this.renderer.removeStroke(this.stroke.id);
    await this.state.removeStroke(this.stroke.id);
  }

  public async undo(): Promise<void> {
    await this.state.addStroke(this.stroke, this.binaryBuffer);
    this.renderer.renderStoredStroke(this.stroke, this.points);
  }
}

/**
 * Tool for removing strokes via direct stylus contact or eraser tip.
 */
export class EraserTool extends Tool {
  public readonly name: string = 'EraserTool';

  private readonly renderer: StrokeRenderer;
  private readonly state: ProjectState;
  private readonly undoManager: UndoRedoManager;
  private readonly camera: PerspectiveCamera;

  private isErasing: boolean = false;
  private raycaster: Raycaster = new Raycaster();
  private ndc: Vector2 = new Vector2();

  constructor(
    renderer: StrokeRenderer,
    state: ProjectState,
    undoManager: UndoRedoManager,
    camera: PerspectiveCamera
  ) {
    super();
    this.renderer = renderer;
    this.state = state;
    this.undoManager = undoManager;
    this.camera = camera;
  }

  public onPointerDown(point: StrokePoint, _samples: StrokePoint[], _event: PointerEvent): void {
    this.isErasing = true;
    this.checkErase(point.x, point.y);
  }

  public onPointerMove(point: StrokePoint, _samples: StrokePoint[], _event: PointerEvent): void {
    if (!this.isErasing) return;
    this.checkErase(point.x, point.y);
  }

  public onPointerUp(_point: StrokePoint, _event: PointerEvent): void {
    this.isErasing = false;
  }

  public cancel(): void {
    this.isErasing = false;
  }

  /**
   * Tests screen coordinate against registered strokes for erasure.
   */
  private async checkErase(screenX: number, screenY: number): Promise<void> {
    this.ndc.x = (screenX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(screenY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const project = this.state.getProject();
    const activeCanvas = this.state.getActiveCanvas();
    if (!activeCanvas) return;

    // Hit-test strokes belonging to the active canvas
    const strokes = project.strokes.filter((s) => s.canvasId === activeCanvas.id);

    for (const s of strokes) {
      const binary = await this.state.binaryStore.readStroke(s.id);
      if (!binary) continue;

      const hit = this.testStrokeHit(binary, this.raycaster);
      if (hit) {
        const points = this.deserializePoints(binary);
        const command = new DeleteStrokeCommand(this.state, this.renderer, s, binary, points);
        this.undoManager.execute(command);
        break;
      }
    }
  }

  private testStrokeHit(binary: Float32Array, raycaster: Raycaster): boolean {
    const pointCount = binary.length / 7;
    const thresholdDist = 0.25;

    for (let i = 0; i < pointCount; i++) {
      const offset = i * 7;
      const px = binary[offset];
      const py = binary[offset + 1];
      const pz = binary[offset + 2];

      const dist = raycaster.ray.distanceToPoint({ x: px, y: py, z: pz } as any);
      if (dist < thresholdDist) {
        return true;
      }
    }
    return false;
  }

  private deserializePoints(binary: Float32Array): StrokePoint[] {
    const count = binary.length / 7;
    const points: StrokePoint[] = [];
    for (let i = 0; i < count; i++) {
      const o = i * 7;
      points.push({
        x: binary[o],
        y: binary[o + 1],
        z: binary[o + 2],
        pressure: binary[o + 3],
        tiltX: binary[o + 4],
        tiltY: binary[o + 5],
        time: binary[o + 6],
      });
    }
    return points;
  }
}
