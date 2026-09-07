import { Raycaster, Vector2, Vector3, PerspectiveCamera } from 'three/webgpu';
import { Tool } from './Tool';
import type { StrokeRenderer } from '../engine/StrokeRenderer';
import type { SpatialCanvas } from '../engine/SpatialCanvas';
import type { ProjectState } from '../state/ProjectState';
import type { UndoRedoManager, Command } from '../state/UndoRedoManager';
import type { StrokePoint, StrokeData } from '../types/stroke';

export type ShapeType = 'line' | 'rectangle' | 'ellipse';

class AddShapeCommand implements Command {
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
 * Tool for drafting geometric shapes (straight lines, rectangles, ellipses) onto spatial canvases.
 */
export class ShapeTool extends Tool {
  public readonly name: string = 'ShapeTool';

  private readonly renderer: StrokeRenderer;
  private readonly state: ProjectState;
  private readonly undoManager: UndoRedoManager;
  private readonly camera: PerspectiveCamera;
  private activeCanvasProvider: () => SpatialCanvas | undefined;

  private shapeType: ShapeType = 'line';
  private isDrawing: boolean = false;
  private startPointWorld: Vector3 | null = null;
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

  public setShapeType(type: ShapeType): void {
    this.shapeType = type;
  }

  public onPointerDown(point: StrokePoint, _samples: StrokePoint[], _event: PointerEvent): void {
    const canvas = this.activeCanvasProvider();
    if (!canvas) return;

    const hit = this.raycastCanvas(point.x, point.y, canvas);
    if (!hit) return;

    this.isDrawing = true;
    this.startPointWorld = hit;

    const initialPoint: StrokePoint = {
      x: hit.x,
      y: hit.y,
      z: hit.z,
      pressure: 0.5,
      tiltX: 0,
      tiltY: 0,
      time: point.time,
    };

    this.renderer.beginStroke(initialPoint, this.state.getColor(), this.state.getWidth(), this.state.getOpacity());
  }

  public onPointerMove(point: StrokePoint, _samples: StrokePoint[], _event: PointerEvent): void {
    if (!this.isDrawing || !this.startPointWorld) return;

    const canvas = this.activeCanvasProvider();
    if (!canvas) return;

    const hit = this.raycastCanvas(point.x, point.y, canvas);
    if (!hit) return;

    const shapePoints = this.generateShapePoints(this.startPointWorld, hit, canvas);
    if (shapePoints.length >= 2) {
      this.renderer.updateActiveStroke(shapePoints);
    }
  }

  public onPointerUp(point: StrokePoint, _event: PointerEvent): void {
    if (!this.isDrawing || !this.startPointWorld) return;
    this.isDrawing = false;

    const canvas = this.activeCanvasProvider();
    if (!canvas) {
      this.renderer.cancelActiveStroke();
      return;
    }

    const hit = this.raycastCanvas(point.x, point.y, canvas);
    if (!hit) {
      this.renderer.cancelActiveStroke();
      return;
    }

    const shapePoints = this.generateShapePoints(this.startPointWorld, hit, canvas);
    if (shapePoints.length < 2) {
      this.renderer.cancelActiveStroke();
      return;
    }

    const strokeId = `shape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.renderer.endStroke(strokeId);

    const strokeData: StrokeData = {
      id: strokeId,
      canvasId: canvas.id,
      color: this.state.getColor(),
      width: this.state.getWidth(),
      opacity: this.state.getOpacity(),
      pointCount: shapePoints.length,
      timestamp: Date.now(),
    };

    const binary = this.serializePoints(shapePoints);
    const cmd = new AddShapeCommand(this.state, this.renderer, strokeData, binary, shapePoints);
    this.undoManager.execute(cmd);

    this.startPointWorld = null;
  }

  public cancel(): void {
    if (this.isDrawing) {
      this.renderer.cancelActiveStroke();
      this.isDrawing = false;
      this.startPointWorld = null;
    }
  }

  private generateShapePoints(start: Vector3, end: Vector3, canvas: SpatialCanvas): StrokePoint[] {
    const p1Local = canvas.projectWorldToLocal(start);
    const p2Local = canvas.projectWorldToLocal(end);

    const localPoints: Vector2[] = [];

    if (this.shapeType === 'line') {
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        localPoints.push(new Vector2().lerpVectors(p1Local, p2Local, t));
      }
    } else if (this.shapeType === 'rectangle') {
      localPoints.push(new Vector2(p1Local.x, p1Local.y));
      localPoints.push(new Vector2(p2Local.x, p1Local.y));
      localPoints.push(new Vector2(p2Local.x, p2Local.y));
      localPoints.push(new Vector2(p1Local.x, p2Local.y));
      localPoints.push(new Vector2(p1Local.x, p1Local.y));
    } else {
      // Ellipse
      const cx = (p1Local.x + p2Local.x) / 2;
      const cy = (p1Local.y + p2Local.y) / 2;
      const rx = Math.abs(p2Local.x - p1Local.x) / 2;
      const ry = Math.abs(p2Local.y - p1Local.y) / 2;
      const segments = 36;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        localPoints.push(new Vector2(cx + Math.cos(theta) * rx, cy + Math.sin(theta) * ry));
      }
    }

    return localPoints.map((lp) => {
      const world = canvas.unprojectLocalToWorld(lp);
      return {
        x: world.x,
        y: world.y,
        z: world.z,
        pressure: 0.5,
        tiltX: 0,
        tiltY: 0,
        time: Date.now(),
      };
    });
  }

  private serializePoints(points: StrokePoint[]): Float32Array {
    const buffer = new Float32Array(points.length * 7);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const o = i * 7;
      buffer[o] = p.x;
      buffer[o + 1] = p.y;
      buffer[o + 2] = p.z;
      buffer[o + 3] = p.pressure;
      buffer[o + 4] = p.tiltX;
      buffer[o + 5] = p.tiltY;
      buffer[o + 6] = p.time;
    }
    return buffer;
  }

  private raycastCanvas(screenX: number, screenY: number, canvas: SpatialCanvas): Vector3 | null {
    this.ndc.x = (screenX / window.innerWidth) * 2 - 1;
    this.ndc.y = -(screenY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.ndc, this.camera);
    return canvas.intersectRay(this.raycaster.ray);
  }
}
