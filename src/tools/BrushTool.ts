import { Raycaster, Vector2, Vector3, PerspectiveCamera } from 'three/webgpu';
import { Tool } from './Tool';
import { CurveSmoothing } from '../engine/CurveSmoothing';
import type { StrokeRenderer } from '../engine/StrokeRenderer';
import type { SpatialCanvas } from '../engine/SpatialCanvas';
import type { GuideSurface } from '../engine/GuideSurface';
import type { ProjectState } from '../state/ProjectState';
import type { UndoRedoManager, Command } from '../state/UndoRedoManager';
import type { InkPresenter } from '../input/InkPresenter';
import type { StrokePoint, StrokeData } from '../types/stroke';
import type { SpatialSnapper } from '../engine/SpatialSnapper';

/**
 * Command for adding one or multiple strokes with undo/redo capability.
 */
class AddStrokesBatchCommand implements Command {
  constructor(
    private state: ProjectState,
    private renderer: StrokeRenderer,
    private strokes: { data: StrokeData; binary: Float32Array; points: StrokePoint[] }[],
    private snapper?: SpatialSnapper
  ) {}

  public async execute(): Promise<void> {
    for (const item of this.strokes) {
      await this.state.addStroke(item.data, item.binary);
      this.renderer.renderStoredStroke(item.data, item.points);
      this.snapper?.registerStroke(
        item.data.id,
        item.points.map((p) => new Vector3(p.x, p.y, p.z))
      );
    }
  }

  public async undo(): Promise<void> {
    for (const item of this.strokes) {
      this.renderer.removeStroke(item.data.id);
      await this.state.removeStroke(item.data.id);
      this.snapper?.unregisterStroke(item.data.id);
    }
  }
}

/**
 * Tool for drawing spatial ribbons onto active canvas planes and 3D guide surfaces.
 * Supports live symmetry/mirror sketching across X, Y, or Z planes.
 */
export class BrushTool extends Tool {
  public readonly name: string = 'BrushTool';

  private readonly renderer: StrokeRenderer;
  private readonly state: ProjectState;
  private readonly undoManager: UndoRedoManager;
  private readonly camera: PerspectiveCamera;
  private readonly inkPresenter: InkPresenter;
  private activeCanvasProvider: () => SpatialCanvas | undefined;
  private guideSurfaceProvider?: () => GuideSurface | undefined;

  private isDrawing: boolean = false;
  private collectedPoints: StrokePoint[] = [];
  private raycaster: Raycaster = new Raycaster();
  private ndc: Vector2 = new Vector2();

  private mirrorAxis: 'x' | 'y' | 'z' | null = null;
  private mirrorOrigin: Vector3 = new Vector3(0, 0, 0);

  /**
   * Initializes the brush tool with required subsystem references.
   */
  constructor(
    renderer: StrokeRenderer,
    state: ProjectState,
    undoManager: UndoRedoManager,
    camera: PerspectiveCamera,
    inkPresenter: InkPresenter,
    activeCanvasProvider: () => SpatialCanvas | undefined,
    guideSurfaceProvider?: () => GuideSurface | undefined
  ) {
    super();
    this.renderer = renderer;
    this.state = state;
    this.undoManager = undoManager;
    this.camera = camera;
    this.inkPresenter = inkPresenter;
    this.activeCanvasProvider = activeCanvasProvider;
    this.guideSurfaceProvider = guideSurfaceProvider;
  }

  private snapper?: SpatialSnapper;
  private onSnapLocked?: (point: Vector3) => void;

  /**
   * Sets or clears the active 3D mirror symmetry plane.
   */
  public setMirrorAxis(axis: 'x' | 'y' | 'z' | null, origin: Vector3 = new Vector3(0, 0, 0)): void {
    this.mirrorAxis = axis;
    this.mirrorOrigin.copy(origin);
  }

  /**
   * Configures intelligent spatial snapping for automatic depth locking to existing objects.
   */
  public setSpatialSnapper(snapper: SpatialSnapper, onSnapLocked?: (point: Vector3) => void): void {
    this.snapper = snapper;
    this.onSnapLocked = onSnapLocked;
  }

  /**
   * Returns current mirror symmetry axis.
   */
  public getMirrorAxis(): 'x' | 'y' | 'z' | null {
    return this.mirrorAxis;
  }

  /**
   * Sets the guide surface provider.
   */
  public setGuideSurfaceProvider(provider: () => GuideSurface | undefined): void {
    this.guideSurfaceProvider = provider;
  }

  public onPointerDown(point: StrokePoint, _samples: StrokePoint[], event: PointerEvent): void {
    let hit: { x: number; y: number; z: number } | null = null;

    // 1. Distance-aware snapping to existing strokes / objects
    if (this.snapper) {
      const snap = this.snapper.findSnapTarget(
        event.clientX,
        event.clientY,
        this.camera,
        window.innerWidth,
        window.innerHeight,
        24
      );
      if (snap) {
        hit = { x: snap.hitPoint.x, y: snap.hitPoint.y, z: snap.hitPoint.z };
        this.onSnapLocked?.(snap.hitPoint);
      }
    }

    // 2. Fallback to active guide surface or canvas plane
    if (!hit) {
      hit = this.findHitPoint(point.x, point.y);
    }
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

    if (this.mirrorAxis) {
      const mirrorPoint = this.reflectPoint(initial3DPoint);
      this.renderer.beginMirrorStroke(mirrorPoint, this.state.getColor(), width, this.state.getOpacity());
    }

    this.inkPresenter.updateTrail(event, this.state.getColor(), width * 20);
  }

  public onPointerMove(point: StrokePoint, samples: StrokePoint[], event: PointerEvent): void {
    if (!this.isDrawing) return;

    for (const sample of samples) {
      const hit = this.findHitPoint(sample.x, sample.y);
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

      if (this.mirrorAxis) {
        const mirroredSmoothed = smoothed.map((p) => this.reflectPoint(p));
        this.renderer.updateActiveMirrorStroke(mirroredSmoothed);
      }
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
    const canvasId = activeCanvas ? activeCanvas.id : 'spatial_guide';
    const smoothedPoints = CurveSmoothing.smooth(this.collectedPoints, 0.04, 0.5);

    if (activeCanvas) {
      activeCanvas.expandBoundsToFit(smoothedPoints.map((p) => new Vector3(p.x, p.y, p.z)));
    }

    const primaryStrokeData: StrokeData = {
      id: strokeId,
      canvasId,
      color: this.state.getColor(),
      width: this.state.getWidth(),
      opacity: this.state.getOpacity(),
      pointCount: smoothedPoints.length,
      timestamp: Date.now(),
    };

    const batch: { data: StrokeData; binary: Float32Array; points: StrokePoint[] }[] = [
      {
        data: primaryStrokeData,
        binary: this.serializePointsToBuffer(smoothedPoints),
        points: smoothedPoints,
      },
    ];

    if (this.mirrorAxis) {
      const mirrorStrokeId = `stroke_mirror_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.renderer.endMirrorStroke(mirrorStrokeId);
      const mirrorPoints = smoothedPoints.map((p) => this.reflectPoint(p));
      const mirrorStrokeData: StrokeData = {
        id: mirrorStrokeId,
        canvasId,
        color: this.state.getColor(),
        width: this.state.getWidth(),
        opacity: this.state.getOpacity(),
        pointCount: mirrorPoints.length,
        timestamp: Date.now(),
      };
      batch.push({
        data: mirrorStrokeData,
        binary: this.serializePointsToBuffer(mirrorPoints),
        points: mirrorPoints,
      });
    }

    const command = new AddStrokesBatchCommand(this.state, this.renderer, batch, this.snapper);
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

  private findHitPoint(screenX: number, screenY: number): { x: number; y: number; z: number } | null {
    const guideSurface = this.guideSurfaceProvider?.();
    if (guideSurface && guideSurface.isActive()) {
      const guideHit = guideSurface.intersectScreen(screenX, screenY, this.camera);
      if (guideHit) {
        return { x: guideHit.x, y: guideHit.y, z: guideHit.z };
      }
    }

    const canvas = this.activeCanvasProvider();
    if (!canvas) return null;
    return this.raycastCanvas(screenX, screenY, canvas);
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

  private reflectPoint(p: StrokePoint): StrokePoint {
    const reflected = { ...p };
    if (this.mirrorAxis === 'x') {
      reflected.x = 2 * this.mirrorOrigin.x - p.x;
    } else if (this.mirrorAxis === 'y') {
      reflected.y = 2 * this.mirrorOrigin.y - p.y;
    } else if (this.mirrorAxis === 'z') {
      reflected.z = 2 * this.mirrorOrigin.z - p.z;
    }
    return reflected;
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
