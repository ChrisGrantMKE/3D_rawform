import { MetadataStore } from './MetadataStore';
import { BinaryStore } from './BinaryStore';
/**
 * Central state store managing active project, canvases, stroke index, and tool settings.
 */
export class ProjectState {
    metadataStore;
    binaryStore;
    project;
    activeTool = 'brush';
    currentColor = '#818cf8';
    currentWidth = 0.15;
    currentOpacity = 1.0;
    autoSaveTimer = null;
    listeners = {};
    /**
     * Initializes state and sets up default spatial canvas planes.
     */
    constructor() {
        this.metadataStore = new MetadataStore();
        this.binaryStore = new BinaryStore();
        this.project = this.createDefaultProject();
        this.startAutoSave();
    }
    /**
     * Sets event listeners for reactive UI updates.
     */
    setListeners(listeners) {
        this.listeners = listeners;
    }
    /**
     * Returns the current project data.
     */
    getProject() {
        return this.project;
    }
    /**
     * Gets the currently active drawing canvas data.
     */
    getActiveCanvas() {
        return this.project.canvases.find((c) => c.id === this.project.activeCanvasId);
    }
    /**
     * Changes the active spatial canvas.
     *
     * @param canvasId - ID of canvas to make active
     */
    setActiveCanvas(canvasId) {
        const target = this.project.canvases.find((c) => c.id === canvasId);
        if (!target)
            return;
        this.project.activeCanvasId = canvasId;
        this.listeners.onActiveCanvasChanged?.(target);
    }
    /**
     * Adds a new spatial canvas to the project.
     *
     * @param name - Display name
     * @param planeType - Orientation ('XY', 'XZ', 'YZ')
     * @param position - 3D position
     * @param rotation - Quaternion rotation
     */
    addCanvas(name, planeType, position, rotation) {
        const newCanvas = {
            id: `canvas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name,
            planeType,
            position,
            rotation,
            width: 8,
            height: 6,
            opacity: 1.0,
            isVisible: true,
            isLocked: false,
            strokeIds: [],
        };
        this.project.canvases.push(newCanvas);
        this.listeners.onCanvasesUpdated?.(this.project.canvases);
        this.setActiveCanvas(newCanvas.id);
        return newCanvas;
    }
    /**
     * Registers a newly completed stroke in state and writes binary data immediately.
     *
     * @param stroke - Stroke metadata
     * @param binaryPoints - Float32Array raw point data
     */
    async addStroke(stroke, binaryPoints) {
        this.project.strokes.push(stroke);
        const active = this.getActiveCanvas();
        if (active) {
            active.strokeIds.push(stroke.id);
        }
        await this.binaryStore.writeStroke(stroke.id, binaryPoints);
    }
    /**
     * Removes a stroke from state and marks for deletion.
     *
     * @param strokeId - Unique stroke ID
     */
    async removeStroke(strokeId) {
        this.project.strokes = this.project.strokes.filter((s) => s.id !== strokeId);
        for (const c of this.project.canvases) {
            c.strokeIds = c.strokeIds.filter((id) => id !== strokeId);
        }
        await this.binaryStore.deleteStroke(strokeId);
    }
    getTool() { return this.activeTool; }
    setTool(tool) {
        this.activeTool = tool;
        this.listeners.onToolChanged?.(tool);
    }
    getColor() { return this.currentColor; }
    setColor(color) {
        this.currentColor = color;
        this.listeners.onColorChanged?.(color);
    }
    getWidth() { return this.currentWidth; }
    setWidth(width) {
        this.currentWidth = width;
        this.listeners.onWidthChanged?.(width);
    }
    getOpacity() { return this.currentOpacity; }
    setOpacity(opacity) { this.currentOpacity = opacity; }
    /**
     * Persists project metadata to Dexie.js database.
     */
    async saveMetadata() {
        this.project.updatedAt = Date.now();
        await this.metadataStore.saveProject(this.project);
    }
    /**
     * Auto-save loop debounced every 30 seconds per AGENTS.md requirements.
     */
    startAutoSave() {
        this.autoSaveTimer = window.setInterval(() => {
            this.saveMetadata();
        }, 30000);
    }
    /**
     * Disposes timers.
     */
    dispose() {
        if (this.autoSaveTimer !== null) {
            clearInterval(this.autoSaveTimer);
        }
    }
    /**
     * Generates default initial project with XY canvas.
     */
    createDefaultProject() {
        const defaultCanvasId = 'canvas_main';
        const mainCanvas = {
            id: defaultCanvasId,
            name: 'Front (XY)',
            planeType: 'XY',
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            width: 8,
            height: 6,
            opacity: 1.0,
            isVisible: true,
            isLocked: false,
            strokeIds: [],
        };
        return {
            id: `proj_${Date.now()}`,
            name: 'Spatial Sketch 1',
            version: '1.0.0',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            activeCanvasId: defaultCanvasId,
            camera: {
                position: [0, 2, 8],
                target: [0, 0, 0],
                fov: 45,
            },
            canvases: [mainCanvas],
            strokes: [],
        };
    }
}
