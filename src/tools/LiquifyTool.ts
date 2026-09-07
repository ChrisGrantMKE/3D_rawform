import { Raycaster, Vector2, Vector3, PerspectiveCamera } from 'three/webgpu';
import { Tool } from './Tool';
import type { StrokeRenderer } from '../engine/StrokeRenderer';
import type { SpatialCanvas } from '../engine/SpatialCanvas';
import type { ProjectState } from '../state/ProjectState';
import type { UndoRedoManager, Command } from '../state/UndoRedoManager';
import type { StrokePoint, StrokeData } from '../types/stroke';

interface LiquifyEntry {
  stroke: StrokeData;
  originalBinary: Float32Array;
  currentBinary: Float32Array;
  isModified: boolean;
}

/**
 * Command for undoing/redoing 3D liquify stroke deformation.
 */
class LiquifyStrokesCommand implements Command {
  constructor(
    private state: ProjectState,
    private renderer: StrokeRenderer,
    private entries: { stroke: StrokeData; before: Float32Array; after: Float32Array }[]
  ) {}

  public async execute(): Promise<void> {
    for (const e of this.entries) {
      await this.applyBuffer(e.stroke, e.after);
    }
  }

  public async undo(): Promise<void> {
    for (const e of this.entries) {
      await this.applyBuffer(e.stroke, e.before);
    }
  }

  private async applyBuffer(stroke: StrokeData, buffer: Float32Array): Promise<void> {
    await this.state.binaryStore.writeStroke(stroke.id, buffer);
    const points = this.deserializeBuffer(buffer);
    this.renderer.updateStoredStroke(stroke, points);
  }

  private deserializeBuffer(buffer: Float32Array): StrokePoint[] {
    const count = buffer.length / 7;
    const points: StrokePoint[] = [];
    for (let i = 0; i < count; i++) {
      const o = i * 7;
      points.push({
        x: buffer[o],
        y: buffer[o + 1],
        z: buffer[o + 2],
        pressure: buffer[o + 3],
        tiltX: buffer[o + 4],
        tiltY: buffer[o + 5],
        time: buffer[o + 6],
      });
    }
    return points;
  }
}

/**
 * Spatial 3D Liquify tool inspired by Feather 3D.
 * Allows interactive spatial deformation and warping of strokes in 3D.
 */
export class LiquifyTool extends Tool {
  public readonly name: string = 'LiquifyTool';

  private readonly renderer: StrokeRenderer;
  private readonly state: ProjectState;
  private readonly undoManager: UndoRedoManager;
  private readonly camera: PerspectiveCamera;
  private activeCanvasProvider: () => SpatialCanvas | undefined;

  private isDragging: boolean = false;
  private lastWorldPos: Vector3 | null = null;
  private deformRadius: number = 1.2;
  private strokeEntries: Map<string, LiquifyEntry> = new Map();

  private raycaster: Raycaster = new Raycaster();
  private ndc: Vector2 = new Vector2();

  constructor(
    renderer: StrokeRenderer,
    state: ProjectState,
    undoManager: UndoRedoManager,
    camera: PerspectiveCamera,
    activeCanvasProvider: () => SpatialCanvas | undefined
  ) {
    super();
    this.renderer = renderer;
    this.state = state;
    this.undoManager = undoManager;
    this.camera = camera;
    this.activeCanvasProvider = activeCanvasProvider;
  }

  /**
   * Sets the 3D influence radius of the liquify brush.
   */
  public setRadius(radius: number): void {
    this.deformRadius = Math.max(0.2, radius);
  }

  public async onPointerDown(point: StrokePoint, _samples: StrokePoint[], _event: PointerEvent): Promise<void> {
    const hit = this.findHitPoint(point.x, point.y);
    if (!hit) return;

    this.isDragging = true;
    this.lastWorldPos = hit.clone();
    this.strokeEntries.clear();

    const canvas = this.activeCanvasProvider();
    if (!canvas) return;

    const canvasData = this.state.getProject().canvases.find((c) => c.id === canvas.id);
    const strokeIds = canvasData ? canvasData.strokeIds : [];
    for (const id of strokeIds) {
      const stroke = this.state.getProject().strokes.find((s) => s.id === id);
      const binary = await this.state.binaryStore.readStroke(id);
      if (!stroke || !binary) continue;

      this.strokeEntries.set(id, {
        stroke,
        originalBinary: new Float32Array(binary),
        currentBinary: new Float32Array(binary),
        isModified: false,
      });
    }
  }

  public onPointerMove(point: StrokePoint, _samples: StrokePoint[], _event: PointerEvent): void {
    if (!this.isDragging || !this.lastWorldPos) return;

    const currentPos = this.findHitPoint(point.x, point.y);
    if (!currentPos) return;

    const delta = currentPos.clone().sub(this.lastWorldPos);
    if (delta.lengthSq() < 0.00001) return;

    this.applyDeformation(this.lastWorldPos, delta);
    this.lastWorldPos.copy(currentPos);
  }

  public onPointerUp(_point: StrokePoint, _event: PointerEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.lastWorldPos = null;

    const modified: { stroke: StrokeData; before: Float32Array; after: Float32Array }[] = [];
    for (const [, entry] of this.strokeEntries) {
      if (entry.isModified) {
        modified.push({
          stroke: entry.stroke,
          before: entry.originalBinary,
          after: entry.currentBinary,
        });
      }
    }

    if (modified.length > 0) {
      const command = new LiquifyStrokesCommand(this.state, this.renderer, modified);
      this.undoManager.execute(command);
    }

    this.strokeEntries.clear();
  }

  public cancel(): void {
    if (this.isDragging) {
      // Revert to original
      for (const [, entry] of this.strokeEntries) {
        if (entry.isModified) {
          const points = this.deserializeBuffer(entry.originalBinary);
          this.renderer.updateStoredStroke(entry.stroke, points);
        }
      }
      this.isDragging = false;
      this.lastWorldPos = null;
      this.strokeEntries.clear();
    }
  }

  private applyDeformation(center: Vector3, delta: Vector3): void {
    for (const [, entry] of this.strokeEntries) {
      const buf = entry.currentBinary;
      const count = buf.length / 7;
      let strokeChanged = false;

      for (let i = 0; i < count; i++) {
        const o = i * 7;
        const px = buf[o];
        const py = buf[o + 1];
        const pz = buf[o + 2];

        const dist = center.distanceTo(new Vector3(px, py, pz));
        if (dist < this.deformRadius) {
          const factor = Math.pow(1 - (dist / this.deformRadius) ** 2, 2);
          buf[o] += delta.x * factor;
          buf[o + 1] += delta.y * factor;
          buf[o + 2] += delta.z * factor;
          strokeChanged = true;
        }
      }

      if (strokeChanged) {
        entry.isModified = true;
        const points = this.deserializeBuffer(buf);
        this.renderer.updateStoredStroke(entry.stroke, points);
      }
    }
  }

  private findHitPoint(screenX: number, screenY: number): Vector3 | null {
    const canvas = this.activeCanvasProvider();
    if (!canvas) return null;

    this.ndc.x = (screenX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(screenY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.ndc, this.camera);
    return canvas.intersectRay(this.raycaster.ray);
  }

  private deserializeBuffer(buffer: Float32Array): StrokePoint[] {
    const count = buffer.length / 7;
    const points: StrokePoint[] = [];
    for (let i = 0; i < count; i++) {
      const o = i * 7;
      points.push({
        x: buffer[o],
        y: buffer[o + 1],
        z: buffer[o + 2],
        pressure: buffer[o + 3],
        tiltX: buffer[o + 4],
        tiltY: buffer[o + 5],
        time: buffer[o + 6],
      });
    }
    return points;
  }
}
