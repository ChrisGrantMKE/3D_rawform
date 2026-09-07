import { MetadataStore } from './MetadataStore';
import { BinaryStore } from './BinaryStore';
import type { ProjectData } from '../types/project';
import type { SpatialCanvasData, SpatialPlaneType } from '../types/canvas';
import type { StrokeData } from '../types/stroke';

export type ActiveToolType = 'brush' | 'eraser' | 'pan';

export interface ProjectStateListeners {
  onActiveCanvasChanged?: (canvas: SpatialCanvasData) => void;
  onCanvasesUpdated?: (canvases: SpatialCanvasData[]) => void;
  onToolChanged?: (tool: ActiveToolType) => void;
  onColorChanged?: (color: string) => void;
  onWidthChanged?: (width: number) => void;
}

/**
 * Central state store managing active project, canvases, stroke index, and tool settings.
 */
export class ProjectState {
  public readonly metadataStore: MetadataStore;
  public readonly binaryStore: BinaryStore;

  private project: ProjectData;
  private activeTool: ActiveToolType = 'brush';
  private currentColor: string = '#818cf8';
  private currentWidth: number = 0.15;
  private currentOpacity: number = 1.0;
  private autoSaveTimer: number | null = null;
  private listeners: ProjectStateListeners = {};

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
  public setListeners(listeners: ProjectStateListeners): void {
    this.listeners = listeners;
  }

  /**
   * Returns the current project data.
   */
  public getProject(): ProjectData {
    return this.project;
  }

  /**
   * Gets the currently active drawing canvas data.
   */
  public getActiveCanvas(): SpatialCanvasData | undefined {
    return this.project.canvases.find((c) => c.id === this.project.activeCanvasId);
  }

  /**
   * Changes the active spatial canvas.
   *
   * @param canvasId - ID of canvas to make active
   */
  public setActiveCanvas(canvasId: string): void {
    const target = this.project.canvases.find((c) => c.id === canvasId);
    if (!target) return;

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
  public addCanvas(
    name: string,
    planeType: SpatialPlaneType,
    position: [number, number, number],
    rotation: [number, number, number, number]
  ): SpatialCanvasData {
    const newCanvas: SpatialCanvasData = {
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
  public async addStroke(stroke: StrokeData, binaryPoints: Float32Array): Promise<void> {
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
  public async removeStroke(strokeId: string): Promise<void> {
    this.project.strokes = this.project.strokes.filter((s) => s.id !== strokeId);
    for (const c of this.project.canvases) {
      c.strokeIds = c.strokeIds.filter((id) => id !== strokeId);
    }
    await this.binaryStore.deleteStroke(strokeId);
  }

  public getTool(): ActiveToolType { return this.activeTool; }
  public setTool(tool: ActiveToolType): void {
    this.activeTool = tool;
    this.listeners.onToolChanged?.(tool);
  }

  public getColor(): string { return this.currentColor; }
  public setColor(color: string): void {
    this.currentColor = color;
    this.listeners.onColorChanged?.(color);
  }

  public getWidth(): number { return this.currentWidth; }
  public setWidth(width: number): void {
    this.currentWidth = width;
    this.listeners.onWidthChanged?.(width);
  }

  public getOpacity(): number { return this.currentOpacity; }
  public setOpacity(opacity: number): void { this.currentOpacity = opacity; }

  /**
   * Persists project metadata to Dexie.js database.
   */
  public async saveMetadata(): Promise<void> {
    this.project.updatedAt = Date.now();
    await this.metadataStore.saveProject(this.project);
  }

  /**
   * Auto-save loop debounced every 30 seconds per AGENTS.md requirements.
   */
  private startAutoSave(): void {
    this.autoSaveTimer = window.setInterval(() => {
      this.saveMetadata();
    }, 30000);
  }

  /**
   * Disposes timers.
   */
  public dispose(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
    }
  }

  /**
   * Generates default initial project with XY canvas.
   */
  private createDefaultProject(): ProjectData {
    const defaultCanvasId = 'canvas_main';
    const mainCanvas: SpatialCanvasData = {
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
