import { SceneManager } from './engine/SceneManager';
import { SpatialCanvas } from './engine/SpatialCanvas';
import { StrokeRenderer } from './engine/StrokeRenderer';
import { CameraAnimator } from './engine/CameraAnimator';
import { CanvasProjection } from './engine/CanvasProjection';
import { InputManager } from './input/InputManager';
import { BrushTool } from './tools/BrushTool';
import { EraserTool } from './tools/EraserTool';
import { SelectionTool } from './tools/SelectionTool';
import { ShapeTool } from './tools/ShapeTool';
import { Tool } from './tools/Tool';
import { ProjectState, type ActiveToolType } from './state/ProjectState';
import { UndoRedoManager } from './state/UndoRedoManager';
import { Toolbar } from './ui/Toolbar';
import { ColorPicker } from './ui/ColorPicker';
import { CanvasPanel } from './ui/CanvasPanel';
import { LayerPanel } from './ui/LayerPanel';
import { BookmarkTimeline } from './ui/BookmarkTimeline';
import { ImageExporter } from './export/ImageExporter';
import { GLTFExporterWrapper } from './export/GLTFExporterWrapper';
import type { SpatialPlaneType, SpatialCanvasData } from './types/canvas';
import type { CameraBookmark } from './types/bookmark';

/**
 * Root application coordinator bringing together 3D engine, input subsystem, tools, and UI.
 */
export class App {
  private readonly canvasContainer: HTMLElement;
  private readonly uiLayer: HTMLElement;

  private sceneManager!: SceneManager;
  private strokeRenderer!: StrokeRenderer;
  private cameraAnimator!: CameraAnimator;
  private inputManager!: InputManager;
  private projectState!: ProjectState;
  private undoManager!: UndoRedoManager;

  private spatialCanvases: Map<string, SpatialCanvas> = new Map();
  private brushTool!: BrushTool;
  private eraserTool!: EraserTool;
  private selectionTool!: SelectionTool;
  private shapeTool!: ShapeTool;
  private currentTool!: Tool;

  private toolbar!: Toolbar;
  private colorPicker!: ColorPicker;
  private canvasPanel!: CanvasPanel;
  private layerPanel!: LayerPanel;
  private bookmarkTimeline!: BookmarkTimeline;
  private gltfExporter: GLTFExporterWrapper = new GLTFExporterWrapper();

  /**
   * Initializes App DOM references.
   *
   * @param rootContainer - Root DOM container
   */
  constructor(rootContainer: HTMLElement) {
    this.canvasContainer = rootContainer.querySelector('#canvas-container') as HTMLElement;
    this.uiLayer = rootContainer.querySelector('#ui-layer') as HTMLElement;
  }

  /**
   * Bootstraps WebGPU scene, initial spatial canvas, tools, and user interface.
   */
  public async init(): Promise<void> {
    this.sceneManager = new SceneManager(this.canvasContainer);
    await this.sceneManager.init();

    this.strokeRenderer = new StrokeRenderer(this.sceneManager.scene);
    this.cameraAnimator = new CameraAnimator(this.sceneManager.camera, this.sceneManager.cameraController);
    this.projectState = new ProjectState();
    this.undoManager = new UndoRedoManager();

    this.setupCanvases();
    this.setupTools();
    this.setupInput();
    this.setupUI();
    this.snapToActiveCanvas();
  }

  private setupCanvases(): void {
    const project = this.projectState.getProject();
    for (const canvasData of project.canvases) {
      const spatial = new SpatialCanvas(canvasData);
      this.spatialCanvases.set(canvasData.id, spatial);
      this.sceneManager.scene.add(spatial.getObject());
    }
  }

  private setupTools(): void {
    const activeCanvasProvider = () => {
      const activeId = this.projectState.getProject().activeCanvasId;
      return this.spatialCanvases.get(activeId);
    };

    this.inputManager = new InputManager(this.canvasContainer);

    this.brushTool = new BrushTool(
      this.strokeRenderer,
      this.projectState,
      this.undoManager,
      this.sceneManager.camera,
      this.inputManager.getInkPresenter(),
      activeCanvasProvider
    );

    this.eraserTool = new EraserTool(
      this.strokeRenderer,
      this.projectState,
      this.undoManager,
      this.sceneManager.camera
    );

    this.selectionTool = new SelectionTool(
      this.strokeRenderer,
      this.projectState,
      this.undoManager,
      this.sceneManager.camera,
      activeCanvasProvider
    );

    this.shapeTool = new ShapeTool(
      this.strokeRenderer,
      this.projectState,
      this.undoManager,
      this.sceneManager.camera,
      activeCanvasProvider
    );

    this.currentTool = this.brushTool;
  }

  private setupInput(): void {
    this.inputManager.setListeners({
      onPenDown: (data) => {
        const tool = data.isEraser ? this.eraserTool : this.currentTool;
        tool.onPointerDown(data.point, data.samples, data.rawEvent);
      },
      onPenMove: (data) => {
        const tool = data.isEraser ? this.eraserTool : this.currentTool;
        tool.onPointerMove(data.point, data.samples, data.rawEvent);
      },
      onPenUp: (data) => {
        const tool = data.isEraser ? this.eraserTool : this.currentTool;
        tool.onPointerUp(data.point, data.rawEvent);
      },
      onCameraOrbit: (dTheta, dPhi) => this.sceneManager.cameraController.orbit(dTheta, dPhi),
      onCameraPan: (dx, dy) => this.sceneManager.cameraController.pan(dx, dy),
      onCameraZoom: (factor) => this.sceneManager.cameraController.zoom(factor),
    });
  }

  private setupUI(): void {
    this.buildHeader();

    this.colorPicker = new ColorPicker(this.uiLayer, {
      onColorSelect: (c) => this.projectState.setColor(c),
      onWidthChange: (w) => this.projectState.setWidth(w),
      onOpacityChange: (o) => this.projectState.setOpacity(o),
      onProfileSelect: (p) => this.handleProfileSelect(p),
    });

    this.canvasPanel = new CanvasPanel(this.uiLayer, {
      onSelectCanvas: (id) => this.handleSelectCanvas(id),
      onCreateCanvas: (name, type) => this.handleCreateCanvas(name, type),
      onCreateParallel: (dist) => this.handleCreateParallel(dist),
      onCreateHinge: (edge, deg) => this.handleCreateHinge(edge, deg),
      onSnapToCanvas: (id) => this.handleSnapCanvas(id),
    });

    this.layerPanel = new LayerPanel(this.uiLayer, {
      onAddLayer: (name) => {
        const active = this.projectState.getActiveCanvas();
        if (active) this.projectState.addLayer(active.id, name);
      },
      onSelectLayer: () => {},
      onToggleVisibility: (lId) => {
        const active = this.projectState.getActiveCanvas();
        if (active) this.projectState.toggleLayerVisibility(active.id, lId);
      },
      onToggleLock: (lId) => {
        const active = this.projectState.getActiveCanvas();
        if (active) this.projectState.toggleLayerLock(active.id, lId);
      },
      onLayerOpacityChange: (lId, op) => {
        const active = this.projectState.getActiveCanvas();
        if (active) this.projectState.setLayerOpacity(active.id, lId, op);
      },
      onDeleteLayer: (lId) => {
        const active = this.projectState.getActiveCanvas();
        if (active) this.projectState.deleteLayer(active.id, lId);
      },
    });

    this.bookmarkTimeline = new BookmarkTimeline(this.uiLayer, {
      onAddBookmark: () => this.handleAddBookmark(),
      onSelectBookmark: (b) => this.cameraAnimator.flyToBookmark(b),
      onDeleteBookmark: (id) => {
        this.projectState.removeBookmark(id);
        this.bookmarkTimeline.updateBookmarks(this.projectState.getBookmarks());
      },
      onPlayTour: () => {
        this.cameraAnimator.playTour(this.projectState.getBookmarks(), {
          loop: false,
          onUpdate: (prog) => this.bookmarkTimeline.setProgress(prog),
          onComplete: () => this.bookmarkTimeline.setPlayingState(false),
        });
      },
      onPauseTour: () => this.cameraAnimator.pause(),
      onSeekTour: (prog) => this.cameraAnimator.seek(prog),
      onToggleLoop: () => {},
    });

    this.bookmarkTimeline.updateBookmarks(this.projectState.getBookmarks());

    this.toolbar = new Toolbar(this.uiLayer, {
      onToolSelect: (tool) => this.switchTool(tool),
      onToggleColorPanel: () => this.colorPicker.toggle(),
      onToggleCanvasPanel: () => {
        this.canvasPanel.updateCanvases(
          this.projectState.getProject().canvases,
          this.projectState.getProject().activeCanvasId
        );
        this.canvasPanel.toggle();
      },
      onToggleLayerPanel: () => {
        const active = this.projectState.getActiveCanvas();
        if (active) {
          this.layerPanel.updateLayers(active.layers || [], active.activeLayerId || '');
        }
        this.layerPanel.toggle();
      },
      onToggleTimeline: () => this.bookmarkTimeline.toggle(),
      onSnapView: () => this.snapToActiveCanvas(),
      onUndo: () => this.undoManager.undo(),
      onRedo: () => this.undoManager.redo(),
      onExportPNG: () => ImageExporter.downloadSnapshot(this.sceneManager.renderer.domElement),
      onExportGLTF: () => this.gltfExporter.downloadGLB(this.sceneManager.scene),
    });

    this.undoManager.onChange(() => {
      this.toolbar.updateHistoryState(this.undoManager.canUndo(), this.undoManager.canRedo());
    });

    this.projectState.setListeners({
      onLayersUpdated: (layers) => {
        const active = this.projectState.getActiveCanvas();
        this.layerPanel.updateLayers(layers, active?.activeLayerId || '');
      },
      onBookmarksUpdated: (bms) => {
        this.bookmarkTimeline.updateBookmarks(bms);
      },
    });
  }

  private switchTool(tool: ActiveToolType): void {
    this.projectState.setTool(tool);
    if (tool === 'eraser') {
      this.currentTool = this.eraserTool;
    } else if (tool === 'select') {
      this.currentTool = this.selectionTool;
    } else if (tool === 'shape') {
      this.currentTool = this.shapeTool;
    } else {
      this.currentTool = this.brushTool;
    }
    this.toolbar.setActiveTool(tool);
  }

  private handleProfileSelect(profile: 'ink' | 'marker' | 'pencil'): void {
    if (profile === 'marker') {
      this.projectState.setWidth(0.35);
      this.projectState.setOpacity(0.45);
    } else if (profile === 'pencil') {
      this.projectState.setWidth(0.06);
      this.projectState.setOpacity(0.85);
    } else {
      this.projectState.setWidth(0.15);
      this.projectState.setOpacity(1.0);
    }
  }

  private buildHeader(): void {
    const header = document.createElement('div');
    header.className = 'top-header';
    header.innerHTML = `
      <div class="app-branding glass-panel ui-interactive">
        <span class="app-title">3D_rawform</span>
        <span class="app-badge">WebGPU</span>
      </div>
      <div class="top-actions ui-interactive">
        <button id="btn-export-png" class="action-pill">📷 Snapshot</button>
        <button id="btn-export-glb" class="action-pill">📦 Export 3D</button>
      </div>
    `;

    header.querySelector('#btn-export-png')?.addEventListener('click', () => {
      ImageExporter.downloadSnapshot(this.sceneManager.renderer.domElement);
    });

    header.querySelector('#btn-export-glb')?.addEventListener('click', () => {
      this.gltfExporter.downloadGLB(this.sceneManager.scene);
    });

    this.uiLayer.appendChild(header);

    const status = document.createElement('div');
    status.className = 'status-pill glass-panel ui-interactive';
    status.innerHTML = `<span class="status-dot"></span><span>Active Canvas: <b id="active-canvas-label">Front (XY)</b></span>`;
    this.uiLayer.appendChild(status);
  }

  private handleSelectCanvas(id: string): void {
    this.projectState.setActiveCanvas(id);
    const canvas = this.projectState.getActiveCanvas();
    const label = this.uiLayer.querySelector('#active-canvas-label');
    if (label && canvas) label.textContent = canvas.name;
    this.snapToActiveCanvas();
  }

  private handleCreateCanvas(name: string, planeType: SpatialPlaneType): void {
    const pos: [number, number, number] = [0, 0, 0];
    const rot: [number, number, number, number] = [0, 0, 0, 1];

    if (planeType === 'XZ') {
      const sin = Math.sin(-Math.PI / 4);
      const cos = Math.cos(-Math.PI / 4);
      rot[0] = sin;
      rot[3] = cos;
      pos[1] = -2;
    } else if (planeType === 'YZ') {
      const sin = Math.sin(Math.PI / 4);
      const cos = Math.cos(Math.PI / 4);
      rot[1] = sin;
      rot[3] = cos;
      pos[0] = 3;
    } else {
      pos[2] = this.spatialCanvases.size * 1.5;
    }

    const data = this.projectState.addCanvas(
      `${name} ${this.spatialCanvases.size + 1}`,
      planeType,
      pos,
      rot
    );
    this.registerSpatialCanvas(data);
  }

  private handleCreateParallel(distance: number): void {
    const active = this.projectState.getActiveCanvas();
    if (!active) return;

    const data = CanvasProjection.createParallel(
      active,
      distance,
      `Parallel ${this.spatialCanvases.size + 1}`
    );

    this.projectState.getProject().canvases.push(data);
    this.registerSpatialCanvas(data);
  }

  private handleCreateHinge(edge: 'top' | 'bottom' | 'left' | 'right', angleDeg: number): void {
    const active = this.projectState.getActiveCanvas();
    if (!active) return;

    const rad = (angleDeg * Math.PI) / 180;
    const data = CanvasProjection.createHinge(
      active,
      edge,
      rad,
      `Hinge ${edge} ${this.spatialCanvases.size + 1}`
    );

    this.projectState.getProject().canvases.push(data);
    this.registerSpatialCanvas(data);
  }

  private registerSpatialCanvas(data: SpatialCanvasData): void {
    const spatial = new SpatialCanvas(data);
    this.spatialCanvases.set(data.id, spatial);
    this.sceneManager.scene.add(spatial.getObject());

    this.handleSelectCanvas(data.id);
    this.canvasPanel.updateCanvases(this.projectState.getProject().canvases, data.id);
  }

  private handleAddBookmark(): void {
    const cam = this.sceneManager.camera;
    const target = this.sceneManager.cameraController.getTarget();
    const count = this.projectState.getBookmarks().length + 1;

    const bookmark: CameraBookmark = {
      id: `bm_${Date.now()}`,
      name: `View ${count}`,
      position: [cam.position.x, cam.position.y, cam.position.z],
      target: [target.x, target.y, target.z],
      fov: cam.fov,
      duration: 2.0,
      holdTime: 0.5,
      easing: 'power2.inOut',
    };

    this.projectState.addBookmark(bookmark);
  }

  private handleSnapCanvas(id: string): void {
    const canvas = this.projectState.getProject().canvases.find((c) => c.id === id);
    if (!canvas) return;
    this.sceneManager.cameraController.snapToCanvas(canvas.position, canvas.rotation, 9);
  }

  private snapToActiveCanvas(): void {
    const active = this.projectState.getActiveCanvas();
    if (!active) return;
    this.sceneManager.cameraController.snapToCanvas(active.position, active.rotation, 9);
  }

  /**
   * Disposes of application subsystems.
   */
  public dispose(): void {
    this.sceneManager.dispose();
    this.strokeRenderer.dispose();
    this.cameraAnimator.dispose();
    this.inputManager.dispose();
    this.projectState.dispose();
    this.toolbar.dispose();
    this.colorPicker.dispose();
    this.canvasPanel.dispose();
    this.layerPanel.dispose();
    this.bookmarkTimeline.dispose();
  }
}
