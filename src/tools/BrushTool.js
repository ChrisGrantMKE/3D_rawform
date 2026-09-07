import { Raycaster, Vector2 } from 'three/webgpu';
import { Tool } from './Tool';
import { CurveSmoothing } from '../engine/CurveSmoothing';
/**
 * Command for adding a stroke with undo/redo capability.
 */
class AddStrokeCommand {
    state;
    renderer;
    stroke;
    binaryBuffer;
    points;
    constructor(state, renderer, stroke, binaryBuffer, points) {
        this.state = state;
        this.renderer = renderer;
        this.stroke = stroke;
        this.binaryBuffer = binaryBuffer;
        this.points = points;
    }
    async execute() {
        await this.state.addStroke(this.stroke, this.binaryBuffer);
        this.renderer.renderStoredStroke(this.stroke, this.points);
    }
    async undo() {
        this.renderer.removeStroke(this.stroke.id);
        await this.state.removeStroke(this.stroke.id);
    }
}
/**
 * Tool for drawing spatial ribbons onto active canvas planes.
 */
export class BrushTool extends Tool {
    name = 'BrushTool';
    renderer;
    state;
    undoManager;
    camera;
    inkPresenter;
    activeCanvasProvider;
    isDrawing = false;
    collectedPoints = [];
    raycaster = new Raycaster();
    ndc = new Vector2();
    /**
     * Initializes the brush tool with required subsystem references.
     */
    constructor(renderer, state, undoManager, camera, inkPresenter, activeCanvasProvider) {
        super();
        this.renderer = renderer;
        this.state = state;
        this.undoManager = undoManager;
        this.camera = camera;
        this.inkPresenter = inkPresenter;
        this.activeCanvasProvider = activeCanvasProvider;
    }
    onPointerDown(point, _samples, event) {
        const canvas = this.activeCanvasProvider();
        if (!canvas)
            return;
        const hit = this.raycastCanvas(point.x, point.y, canvas);
        if (!hit)
            return;
        this.isDrawing = true;
        const initial3DPoint = {
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
    onPointerMove(point, samples, event) {
        if (!this.isDrawing)
            return;
        const canvas = this.activeCanvasProvider();
        if (!canvas)
            return;
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
    onPointerUp(_point, _event) {
        if (!this.isDrawing)
            return;
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
        const strokeData = {
            id: strokeId,
            canvasId,
            color: this.state.getColor(),
            width: this.state.getWidth(),
            opacity: this.state.getOpacity(),
            pointCount: smoothedPoints.length,
            timestamp: Date.now(),
        };
        const binary = this.serializePointsToBuffer(smoothedPoints);
        const command = new AddStrokeCommand(this.state, this.renderer, strokeData, binary, smoothedPoints);
        this.undoManager.execute(command);
        this.collectedPoints = [];
    }
    cancel() {
        if (this.isDrawing) {
            this.renderer.cancelActiveStroke();
            this.isDrawing = false;
            this.collectedPoints = [];
        }
    }
    calculateWidth(pressure) {
        const base = this.state.getWidth();
        return base * (0.3 + 1.4 * pressure);
    }
    raycastCanvas(screenX, screenY, canvas) {
        this.ndc.x = (screenX / window.innerWidth) * 2 - 1;
        this.ndc.y = -(screenY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const hit = canvas.intersectRay(this.raycaster.ray);
        if (!hit)
            return null;
        return { x: hit.x, y: hit.y, z: hit.z };
    }
    serializePointsToBuffer(points) {
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
