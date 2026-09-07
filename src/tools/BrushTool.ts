import { Raycaster, Vector2, PerspectiveCamera } from 'three/webgpu';
import { Tool } from './Tool';
import { CurveSmoothing } from '../engine/CurveSmoothing';
import type { StrokeRenderer } from '../engine/StrokeRenderer';
import type { SpatialCanvas } from '../engine/SpatialCanvas';
import type { ProjectState } from '../state/ProjectState';
import type { UndoRedoManager, Command } from '../state/UndoRedoManager';
import type { InkPresenter } from '../input/InkPresenter';
import type { StrokePoint, StrokeData } from '../types/stroke';

/**
 * Command for adding a stroke with undo/redo capability.
 */
class AddStrokeCommand implements Command {
  constructor(
    private state: ProjectState,
    private renderer: StrokeRenderer,
    private stroke: StrokeData,
    private binaryBuffer: Float32Array,
    private points: StrokePoint[]
  ) {}

  public async execute(): Promise<void> {
    await this.state.addStroke(this.stroke, this.binaryBuffer);
    this.renderer.renderStoredStroke(this.stroke, this.points);
  }

  public async undo(): Promise<void> {
    this.renderer.removeStroke(this.stroke.id);
    await this.state.removeStroke(this.stroke.id);
  }
}

/**
 * Tool for drawing spatial ribbons onto active canvas planes.
 */
export class BrushTool extends Tool {
  public readonly name: string = 'BrushTool';

  private readonly renderer: StrokeRenderer;
  private readonly state: ProjectState;
  private readonly undoManager: UndoRedoManager;
  private readonly camera: PerspectiveCamera;
  private readonly inkPresenter: InkPresenter;
  private activeCanvasProvider: () => SpatialCanvas | undefined;

  private isDrawing: boolean = false;
  private collectedPoints: StrokePoint[] = [];
  private raycaster: Raycaster = new Raycaster();
  private ndc: Vector2 = new Vector2();

  /**
   * Initializes the brush tool with required subsystem references.
   */
  constructor(
    renderer: StrokeRenderer,
    state: ProjectState,
    undoManager: UndoRedoManager,
    camera: PerspectiveCamera,
    inkPresenter: InkPresenter,
    activeCanvasProvider: () => SpatialCanvas | undefined
  ) {
    super();
    this.renderer = renderer;
    this.state = state;
    this.undoManager = undoManager;
    this.camera = camera;
    this.inkPresenter = inkPresenter;
    this.activeCanvasProvider = activeCanvasProvider;
  }

  public onPointerDown(point: StrokePoint, _samples: StrokePoint[], event: PointerEvent): void {
    const canvas = this.activeCanvasProvider();
    if (!canvas) return;

    const hit = this.raycastCanvas(point.x, point.y, canvas);
    if (!hit) return;

    this.isDrawing = true;
    const initial3DPoint: StrokePoint = {
      ...hit,
      pressure: point.pressure,
      tiltX: point.tiltX,
      tiltY: point.tiltY,
      time: point.time,
    };

    this.collectedPoints = [initial3DPoint];
    const width = this.calculateWidth(point.pressure);

    this.renderer.beginStroke(initial3DPoint, this.state.getColor(), width, this.state.getOpacity());
    this.inkPresenter.updateTrail(event, this.state.getColor(), width * 20);
  }

  public onPointerMove(point: StrokePoint, samples: StrokePoint[], event: PointerEvent): void {
    if (!this.isDrawing) return;

    const canvas = this.activeCanvasProvider();
    if (!canvas) return;

    for (const sample of samples) {
      const hit = this.raycastCanvas(sample.x, sample.y, canvas);
      if (hit) {
        this.collectedPoints.push({
          ...hit,
          pressure: sample.pressure,
          tiltX: sample.tiltX,
          tiltY: sample.tiltY,
          time: sample.time,
        });
      }
    }

    if (this.collectedPoints.length >= 2) {
      const smoothed = CurveSmoothing.smooth(this.collectedPoints, 0.04, 0.5);
      this.renderer.updateActiveStroke(smoothed);
    }

    const width = this.calculateWidth(point.pressure);
    this.inkPresenter.updateTrail(event, this.state.getColor(), width * 20);
  }

  public onPointerUp(_point: StrokePoint, _event: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.collectedPoints.length < 2) {
      this.renderer.cancelActiveStroke();
      this.collectedPoints = [];
      return;
    }

    const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.renderer.endStroke(strokeId);

    const activeCanvas = this.activeCanvasProvider();
    const canvasId = activeCanvas ? activeCanvas.id : 'unknown';
    const smoothedPoints = CurveSmoothing.smooth(this.collectedPoints, 0.04, 0.5);

    const strokeData: StrokeData = {
      id: strokeId,
      canvasId,
      color: this.state.getColor(),
      width: this.state.getWidth(),
      opacity: this.state.getOpacity(),
      pointCount: smoothedPoints.length,
      timestamp: Date.now(),
    };

    const binary = this.serializePointsToBuffer(smoothedPoints);
    const command = new AddStrokeCommand(
      this.state,
      this.renderer,
      strokeData,
      binary,
      smoothedPoints
    );

    this.undoManager.execute(command);
    this.collectedPoints = [];
  }

  public cancel(): void {
    if (this.isDrawing) {
      this.renderer.cancelActiveStroke();
      this.isDrawing = false;
      this.collectedPoints = [];
    }
  }

  private calculateWidth(pressure: number): number {
    const base = this.state.getWidth();
    return base * (0.3 + 1.4 * pressure);
  }

  private raycastCanvas(
    screenX: number,
    screenY: number,
    canvas: SpatialCanvas
  ): { x: number; y: number; z: number } | null {
    this.ndc.x = (screenX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(screenY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = canvas.intersectRay(this.raycaster.ray);
    if (!hit) return null;

    return { x: hit.x, y: hit.y, z: hit.z };
  }

  private serializePointsToBuffer(points: StrokePoint[]): Float32Array {
    const buffer = new Float32Array(points.length * 7);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const offset = i * 7;
      buffer[offset + 0] = p.x;
      buffer[offset + 1] = p.y;
      buffer[offset + 2] = p.z;
      buffer[offset + 3] = p.pressure;
      buffer[offset + 4] = p.tiltX;
      buffer[offset + 5] = p.tiltY;
      buffer[offset + 6] = p.time;
    }
    return buffer;
  }
}
