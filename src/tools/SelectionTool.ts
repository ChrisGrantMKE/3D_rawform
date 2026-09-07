import { Raycaster, Vector2, Vector3, PerspectiveCamera } from 'three/webgpu';
import { Tool } from './Tool';
import type { StrokeRenderer } from '../engine/StrokeRenderer';
import type { SpatialCanvas } from '../engine/SpatialCanvas';
import type { ProjectState } from '../state/ProjectState';
import type { UndoRedoManager, Command } from '../state/UndoRedoManager';
import type { StrokePoint } from '../types/stroke';

/**
 * Command for translating a set of strokes with undo/redo capability.
 */
class TransformStrokesCommand implements Command {
  constructor(
    private state: ProjectState,
    private renderer: StrokeRenderer,
    private strokeIds: string[],
    private offset: Vector3
  ) {}

  public async execute(): Promise<void> {
    await this.applyOffset(this.offset);
  }

  public async undo(): Promise<void> {
    const reverseOffset = this.offset.clone().negate();
    await this.applyOffset(reverseOffset);
  }

  private async applyOffset(offset: Vector3): Promise<void> {
    const project = this.state.getProject();
    for (const id of this.strokeIds) {
      const stroke = project.strokes.find((s) => s.id === id);
      const binary = await this.state.binaryStore.readStroke(id);
      if (!stroke || !binary) continue;

      const pointCount = binary.length / 7;
      const points: StrokePoint[] = [];

      for (let i = 0; i < pointCount; i++) {
        const o = i * 7;
        binary[o] += offset.x;
        binary[o + 1] += offset.y;
        binary[o + 2] += offset.z;

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

      await this.state.binaryStore.writeStroke(id, binary);
      this.renderer.removeStroke(id);
      this.renderer.renderStoredStroke(stroke, points);
    }
  }
}

/**
 * Tool for selecting and translating strokes on active canvas planes.
 */
export class SelectionTool extends Tool {
  public readonly name: string = 'SelectionTool';

  private readonly renderer: StrokeRenderer;
  private readonly state: ProjectState;
  private readonly undoManager: UndoRedoManager;
  private readonly camera: PerspectiveCamera;
  private activeCanvasProvider: () => SpatialCanvas | undefined;

  private selectedStrokeIds: string[] = [];
  private isDragging: boolean = false;
  private lastWorldPos: Vector3 | null = null;
  private accumulatedOffset: Vector3 = new Vector3();

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

  public onPointerDown(point: StrokePoint, _samples: StrokePoint[], _event: PointerEvent): void {
    const canvas = this.activeCanvasProvider();
    if (!canvas) return;

    const hit = this.raycastCanvas(point.x, point.y, canvas);
    if (!hit) {
      this.selectedStrokeIds = [];
      return;
    }

    if (this.selectedStrokeIds.length > 0) {
      this.isDragging = true;
      this.lastWorldPos = hit.clone();
      this.accumulatedOffset.set(0, 0, 0);
    } else {
      this.selectStrokeAt(hit, canvas);
    }
  }

  public onPointerMove(point: StrokePoint, _samples: StrokePoint[], _event: PointerEvent): void {
    if (!this.isDragging || !this.lastWorldPos) return;

    const canvas = this.activeCanvasProvider();
    if (!canvas) return;

    const hit = this.raycastCanvas(point.x, point.y, canvas);
    if (!hit) return;

    const delta = hit.clone().sub(this.lastWorldPos);
    this.accumulatedOffset.add(delta);
    this.lastWorldPos = hit.clone();
  }

  public onPointerUp(_point: StrokePoint, _event: PointerEvent): void {
    if (this.isDragging && this.selectedStrokeIds.length > 0) {
      this.isDragging = false;
      if (this.accumulatedOffset.lengthSq() > 0.0001) {
        const cmd = new TransformStrokesCommand(
          this.state,
          this.renderer,
          [...this.selectedStrokeIds],
          this.accumulatedOffset.clone()
        );
        this.undoManager.execute(cmd);
      }
    }
    this.lastWorldPos = null;
  }

  public cancel(): void {
    this.isDragging = false;
    this.lastWorldPos = null;
    this.selectedStrokeIds = [];
  }

  public getSelectedStrokes(): string[] {
    return [...this.selectedStrokeIds];
  }

  private async selectStrokeAt(worldPoint: Vector3, canvas: SpatialCanvas): Promise<void> {
    const project = this.state.getProject();
    const strokes = project.strokes.filter((s) => s.canvasId === canvas.id);

    for (const stroke of strokes) {
      const binary = await this.state.binaryStore.readStroke(stroke.id);
      if (!binary) continue;

      if (this.testProximity(binary, worldPoint, 0.4)) {
        this.selectedStrokeIds = [stroke.id];
        return;
      }
    }

    this.selectedStrokeIds = [];
  }

  private testProximity(binary: Float32Array, point: Vector3, threshold: number): boolean {
    const count = binary.length / 7;
    const v = new Vector3();

    for (let i = 0; i < count; i++) {
      const o = i * 7;
      v.set(binary[o], binary[o + 1], binary[o + 2]);
      if (v.distanceTo(point) <= threshold) {
        return true;
      }
    }
    return false;
  }

  private raycastCanvas(screenX: number, screenY: number, canvas: SpatialCanvas): Vector3 | null {
    this.ndc.x = (screenX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(screenY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.ndc, this.camera);
    return canvas.intersectRay(this.raycaster.ray);
  }
}
