import { Group } from 'three/webgpu';
import { MeshLine } from 'makio-meshline';
/**
 * Renders spatial 3D ribbon strokes using WebGPU-native Makio MeshLine.
 */
export class StrokeRenderer {
    scene;
    strokeGroup;
    strokeMeshMap;
    activeMeshLine = null;
    /**
     * Initializes the stroke renderer attached to the scene.
     *
     * @param scene - Three.js scene container
     */
    constructor(scene) {
        this.scene = scene;
        this.strokeGroup = new Group();
        this.strokeGroup.name = 'StrokeRenderer_Group';
        this.scene.add(this.strokeGroup);
        this.strokeMeshMap = new Map();
    }
    /**
     * Begins rendering an interactive, in-progress stylus stroke.
     *
     * @param initialPoint - Starting stroke point in 3D world coordinates
     * @param color - Stroke hex color string
     * @param baseWidth - Base ribbon width
     * @param opacity - Stroke opacity (0.0 to 1.0)
     */
    beginStroke(initialPoint, color, baseWidth, opacity = 1.0) {
        // Initialize with a duplicated point to form a valid initial segment
        const coords = [
            [initialPoint.x, initialPoint.y, initialPoint.z],
            [initialPoint.x + 0.0001, initialPoint.y, initialPoint.z],
        ];
        const meshLine = new MeshLine({
            lineWidth: baseWidth,
            color: color,
            opacity: opacity,
            transparent: opacity < 1.0,
            sizeAttenuation: true,
            dynamic: true,
        });
        meshLine.lines(coords);
        meshLine.build();
        this.activeMeshLine = meshLine;
        this.strokeGroup.add(meshLine);
    }
    /**
     * Appends points to the currently active stroke and updates GPU geometry.
     *
     * @param points - Array of newly sampled and smoothed points
     */
    updateActiveStroke(points) {
        if (!this.activeMeshLine || points.length < 2) {
            return;
        }
        const coords = points.map((p) => [p.x, p.y, p.z]);
        this.activeMeshLine.setPositions(coords);
    }
    /**
     * Completes the active stroke, freezes its geometry, and registers its ID.
     *
     * @param strokeId - Unique identifier for the completed stroke
     * @returns The registered MeshLine instance or null if no stroke was active
     */
    endStroke(strokeId) {
        if (!this.activeMeshLine) {
            return null;
        }
        const completed = this.activeMeshLine;
        completed.name = `Stroke_${strokeId}`;
        completed.dynamic(false);
        this.strokeMeshMap.set(strokeId, completed);
        this.activeMeshLine = null;
        return completed;
    }
    /**
     * Renders a saved stroke directly from stored stroke data.
     *
     * @param data - Saved stroke record
     * @param points - Array of points representing the stroke
     * @returns Created MeshLine
     */
    renderStoredStroke(data, points) {
        if (points.length < 2) {
            return null;
        }
        const coords = points.map((p) => [p.x, p.y, p.z]);
        const meshLine = new MeshLine({
            lineWidth: data.width,
            color: data.color,
            opacity: data.opacity,
            transparent: data.opacity < 1.0,
            sizeAttenuation: true,
            dynamic: false,
        });
        meshLine.lines(coords);
        meshLine.build();
        meshLine.name = `Stroke_${data.id}`;
        this.strokeGroup.add(meshLine);
        this.strokeMeshMap.set(data.id, meshLine);
        return meshLine;
    }
    /**
     * Removes a stroke from the scene and disposes its GPU resources.
     *
     * @param strokeId - Unique identifier of the stroke to remove
     */
    removeStroke(strokeId) {
        const meshLine = this.strokeMeshMap.get(strokeId);
        if (!meshLine) {
            return;
        }
        this.strokeGroup.remove(meshLine);
        meshLine.dispose();
        this.strokeMeshMap.delete(strokeId);
    }
    /**
     * Cancels any currently active in-progress stroke without saving.
     */
    cancelActiveStroke() {
        if (this.activeMeshLine) {
            this.strokeGroup.remove(this.activeMeshLine);
            this.activeMeshLine.dispose();
            this.activeMeshLine = null;
        }
    }
    /**
     * Clears all strokes and disposes resources.
     */
    clear() {
        this.cancelActiveStroke();
        for (const [, meshLine] of this.strokeMeshMap) {
            this.strokeGroup.remove(meshLine);
            meshLine.dispose();
        }
        this.strokeMeshMap.clear();
    }
    /**
     * Disposes the entire stroke renderer group.
     */
    dispose() {
        this.clear();
        this.scene.remove(this.strokeGroup);
    }
}
