import { MetadataStore } from './MetadataStore';
import { BinaryStore } from './BinaryStore';
import type { ProjectData } from '../types/project';
import type { SpatialCanvasData, SpatialPlaneType } from '../types/canvas';
import type { StrokeData } from '../types/stroke';
import type { CameraBookmark } from '../types/bookmark';
import type { LayerData } from '../types/layer';

export type ActiveToolType = 'brush' | 'eraser' | 'select' | 'shape' | 'liquify' | 'pan';

export interface ProjectStateListeners {
  onActiveCanvasChanged?: (canvas: SpatialCanvasData) => void;
  onCanvasesUpdated?: (canvases: SpatialCanvasData[]) => void;
  onToolChanged?: (tool: ActiveToolType) => void;
  onColorChanged?: (color: string) => void;
  onWidthChanged?: (width: number) => void;
  onBookmarksUpdated?: (bookmarks: CameraBookmark[]) => void;
  onLayersUpdated?: (layers: LayerData[]) => void;
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
   * Updates position and rotation for a canvas in project state.
   */
  public updateCanvasTransform(
    canvasId: string,
    position: [number, number, number],
    rotation: [number, number, number, number]
  ): void {
    const canvas = this.project.canvases.find((c) => c.id === canvasId);
    if (!canvas) return;
    canvas.position = position;
    canvas.rotation = rotation;
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

  public getBookmarks(): CameraBookmark[] {
    return this.project.bookmarks || [];
  }

  public addBookmark(bookmark: CameraBookmark): void {
    if (!this.project.bookmarks) {
      this.project.bookmarks = [];
    }
    this.project.bookmarks.push(bookmark);
    this.listeners.onBookmarksUpdated?.(this.project.bookmarks);
  }

  public removeBookmark(bookmarkId: string): void {
    if (!this.project.bookmarks) return;
    this.project.bookmarks = this.project.bookmarks.filter((b) => b.id !== bookmarkId);
    this.listeners.onBookmarksUpdated?.(this.project.bookmarks);
  }

  public getLayers(canvasId: string): LayerData[] {
    const canvas = this.project.canvases.find((c) => c.id === canvasId);
    return canvas?.layers || [];
  }

  public addLayer(canvasId: string, name: string): LayerData | undefined {
    const canvas = this.project.canvases.find((c) => c.id === canvasId);
    if (!canvas) return undefined;

    if (!canvas.layers) {
      canvas.layers = [];
    }

    const newLayer: LayerData = {
      id: `layer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      opacity: 1.0,
      isVisible: true,
      isLocked: false,
      strokeIds: [],
    };

    canvas.layers.push(newLayer);
    canvas.activeLayerId = newLayer.id;
    this.listeners.onLayersUpdated?.(canvas.layers);
    return newLayer;
  }

  public toggleLayerVisibility(canvasId: string, layerId: string): void {
    const canvas = this.project.canvases.find((c) => c.id === canvasId);
    const layer = canvas?.layers?.find((l) => l.id === layerId);
    if (layer) {
      layer.isVisible = !layer.isVisible;
      if (canvas?.layers) this.listeners.onLayersUpdated?.(canvas.layers);
    }
  }

  public toggleLayerLock(canvasId: string, layerId: string): void {
    const canvas = this.project.canvases.find((c) => c.id === canvasId);
    const layer = canvas?.layers?.find((l) => l.id === layerId);
    if (layer) {
      layer.isLocked = !layer.isLocked;
      if (canvas?.layers) this.listeners.onLayersUpdated?.(canvas.layers);
    }
  }

  public setLayerOpacity(canvasId: string, layerId: string, opacity: number): void {
    const canvas = this.project.canvases.find((c) => c.id === canvasId);
    const layer = canvas?.layers?.find((l) => l.id === layerId);
    if (layer) {
      layer.opacity = opacity;
      if (canvas?.layers) this.listeners.onLayersUpdated?.(canvas.layers);
    }
  }

  public deleteLayer(canvasId: string, layerId: string): void {
    const canvas = this.project.canvases.find((c) => c.id === canvasId);
    if (canvas && canvas.layers) {
      canvas.layers = canvas.layers.filter((l) => l.id !== layerId);
      this.listeners.onLayersUpdated?.(canvas.layers);
    }
  }

  /**
   * Generates default initial project with XY canvas and sample bookmarks.
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
      layers: [
        {
          id: 'layer_default',
          name: 'Base Layer',
          opacity: 1.0,
          isVisible: true,
          isLocked: false,
          strokeIds: [],
        },
      ],
      activeLayerId: 'layer_default',
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
      bookmarks: [
        {
          id: 'bm_default_1',
          name: 'Perspective View',
          position: [5, 4, 8],
          target: [0, 0, 0],
          fov: 45,
          duration: 2.0,
          holdTime: 0.5,
          easing: 'power2.inOut',
        },
        {
          id: 'bm_default_2',
          name: 'Front View',
          position: [0, 0, 8],
          target: [0, 0, 0],
          fov: 45,
          duration: 2.0,
          holdTime: 0.5,
          easing: 'power2.inOut',
        },
      ],
    };
  }
}
