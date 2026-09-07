import { Raycaster, Vector2 } from 'three/webgpu';
import { Tool } from './Tool';
/**
 * Command for removing a stroke with undo/redo capability.
 */
class DeleteStrokeCommand {
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
        this.renderer.removeStroke(this.stroke.id);
        await this.state.removeStroke(this.stroke.id);
    }
    async undo() {
        await this.state.addStroke(this.stroke, this.binaryBuffer);
        this.renderer.renderStoredStroke(this.stroke, this.points);
    }
}
/**
 * Tool for removing strokes via direct stylus contact or eraser tip.
 */
export class EraserTool extends Tool {
    name = 'EraserTool';
    renderer;
    state;
    undoManager;
    camera;
    isErasing = false;
    raycaster = new Raycaster();
    ndc = new Vector2();
    constructor(renderer, state, undoManager, camera) {
        super();
        this.renderer = renderer;
        this.state = state;
        this.undoManager = undoManager;
        this.camera = camera;
    }
    onPointerDown(point, _samples, _event) {
        this.isErasing = true;
        this.checkErase(point.x, point.y);
    }
    onPointerMove(point, _samples, _event) {
        if (!this.isErasing)
            return;
        this.checkErase(point.x, point.y);
    }
    onPointerUp(_point, _event) {
        this.isErasing = false;
    }
    cancel() {
        this.isErasing = false;
    }
    /**
     * Tests screen coordinate against registered strokes for erasure.
     */
    async checkErase(screenX, screenY) {
        this.ndc.x = (screenX / window.innerWidth) * 2 - 1;
        this.ndc.y = -(screenY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const project = this.state.getProject();
        const activeCanvas = this.state.getActiveCanvas();
        if (!activeCanvas)
            return;
        // Hit-test strokes belonging to the active canvas
        const strokes = project.strokes.filter((s) => s.canvasId === activeCanvas.id);
        for (const s of strokes) {
            const binary = await this.state.binaryStore.readStroke(s.id);
            if (!binary)
                continue;
            const hit = this.testStrokeHit(binary, this.raycaster);
            if (hit) {
                const points = this.deserializePoints(binary);
                const command = new DeleteStrokeCommand(this.state, this.renderer, s, binary, points);
                this.undoManager.execute(command);
                break;
            }
        }
    }
    testStrokeHit(binary, raycaster) {
        const pointCount = binary.length / 7;
        const thresholdDist = 0.25;
        for (let i = 0; i < pointCount; i++) {
            const offset = i * 7;
            const px = binary[offset];
            const py = binary[offset + 1];
            const pz = binary[offset + 2];
            const dist = raycaster.ray.distanceToPoint({ x: px, y: py, z: pz });
            if (dist < thresholdDist) {
                return true;
            }
        }
        return false;
    }
    deserializePoints(binary) {
        const count = binary.length / 7;
        const points = [];
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
