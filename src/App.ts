import { Euler, Vector3 } from 'three/webgpu';
import { SceneManager, type BackgroundStyle, type PostFxMode } from './engine/SceneManager';
import { SpatialCanvas } from './engine/SpatialCanvas';
import { StrokeRenderer } from './engine/StrokeRenderer';
import { CameraAnimator } from './engine/CameraAnimator';
import { CanvasProjection } from './engine/CanvasProjection';
import { GuideSurface } from './engine/GuideSurface';
import { InputManager } from './input/InputManager';
import { BrushTool } from './tools/BrushTool';
import { EraserTool } from './tools/EraserTool';
import { SelectionTool } from './tools/SelectionTool';
import { ShapeTool } from './tools/ShapeTool';
import { LiquifyTool } from './tools/LiquifyTool';
import { Tool } from './tools/Tool';
import { ProjectState, type ActiveToolType } from './state/ProjectState';
import { UndoRedoManager } from './state/UndoRedoManager';
import { Toolbar } from './ui/Toolbar';
import { ColorPicker } from './ui/ColorPicker';
import { CanvasPanel } from './ui/CanvasPanel';
import { LayerPanel } from './ui/LayerPanel';
import { GuidePanel } from './ui/GuidePanel';
import { BookmarkTimeline } from './ui/BookmarkTimeline';
import { BirdsEyeView, type MinimapCanvasItem } from './ui/BirdsEyeView';
import { ImageExporter } from './export/ImageExporter';
import { GLTFExporterWrapper } from './export/GLTFExporterWrapper';
import { OBJExporterWrapper } from './export/OBJExporterWrapper';
import { VideoExporter } from './export/VideoExporter';
import { AssetImporter } from './export/AssetImporter';
import { PlanePreview } from './engine/PlanePreview';
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
  private guideSurface!: GuideSurface;
  private planePreview!: PlanePreview;
  private cameraAnimator!: CameraAnimator;
  private inputManager!: InputManager;
  private projectState!: ProjectState;
  private undoManager!: UndoRedoManager;

  private spatialCanvases: Map<string, SpatialCanvas> = new Map();
  private brushTool!: BrushTool;
  private eraserTool!: EraserTool;
  private selectionTool!: SelectionTool;
  private shapeTool!: ShapeTool;
  private liquifyTool!: LiquifyTool;
  private currentTool!: Tool;

  private toolbar!: Toolbar;
  private colorPicker!: ColorPicker;
  private canvasPanel!: CanvasPanel;
  private layerPanel!: LayerPanel;
  private guidePanel!: GuidePanel;
  private bookmarkTimeline!: BookmarkTimeline;
  private birdsEyeView!: BirdsEyeView;
  private gltfExporter: GLTFExporterWrapper = new GLTFExporterWrapper();
  private objExporter: OBJExporterWrapper = new OBJExporterWrapper();

  private isAngleFadeEnabled: boolean = true;
  private isHoldingC: boolean = false;
  private depthHud!: HTMLElement;
  private depthHudValue!: HTMLElement;

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
    this.guideSurface = new GuideSurface();
    this.sceneManager.scene.add(this.guideSurface.getObject());

    this.planePreview = new PlanePreview();
    this.sceneManager.scene.add(this.planePreview.getObject());

    this.cameraAnimator = new CameraAnimator(this.sceneManager.camera, this.sceneManager.cameraController);
    this.projectState = new ProjectState();
    this.undoManager = new UndoRedoManager();

    this.setupCanvases();
    this.setupTools();
    this.setupInput();
    this.setupUI();

    this.birdsEyeView = new BirdsEyeView(this.uiLayer, {
      onNavigateTo: (wx, wz) => {
        const curTarget = this.sceneManager.cameraController.getTarget();
        this.sceneManager.cameraController.setTarget(new Vector3(wx, curTarget.y, wz));
      },
    });

    this.sceneManager.onUpdate(() => {
      this.updateMinimap();
      if (this.isAngleFadeEnabled) {
        this.updateStrokeAngleFading();
      }
    });

    this.snapToActiveCanvas();
  }

  private setupCanvases(): void {
    const project = this.projectState.getProject();
    for (const canvasData of project.canvases) {
      const spatial = new SpatialCanvas(canvasData);
      // Keep only active canvas grid visible initially; hide others to eliminate clutter
      spatial.setGridVisible(canvasData.id === project.activeCanvasId);
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
      activeCanvasProvider,
      () => this.guideSurface
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

    this.liquifyTool = new LiquifyTool(
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
        // Dismiss the canvas grid on the very first stroke so grids do not clutter 3D space
        const active = this.getActiveSpatialCanvas();
        if (active && active.getGridVisible()) {
          active.setGridVisible(false);
        }
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
      onWheelScroll: (deltaY) => {
        if (this.planePreview.isActive()) {
          const step = deltaY > 0 ? 0.35 : -0.35;
          this.planePreview.adjustDepth(step, this.sceneManager.camera);
          this.updateDepthHud();
          return true;
        }
        return false;
      },
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
      onCreateCanvasFromView: () => this.handleCreateCanvasFromView(),
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
      onToggleVisibility: (layerId) => {
        const active = this.projectState.getActiveCanvas();
        if (active) this.projectState.toggleLayerVisibility(active.id, layerId);
      },
      onToggleLock: (layerId) => {
        const active = this.projectState.getActiveCanvas();
        if (active) this.projectState.toggleLayerLock(active.id, layerId);
      },
      onLayerOpacityChange: (layerId, op) => {
        const active = this.projectState.getActiveCanvas();
        if (active) this.projectState.setLayerOpacity(active.id, layerId, op);
      },
      onDeleteLayer: () => {},
    });

    this.guidePanel = new GuidePanel(this.uiLayer, {
      onSelectGuideType: (type) => this.guideSurface.setType(type),
      onDimensionsChanged: (r, h) => this.guideSurface.setDimensions(r, h),
      onToggleGuideVisibility: (v) => this.guideSurface.setVisible(v),
      onSelectMirrorAxis: (axis) => this.brushTool.setMirrorAxis(axis),
      onImportImage: async (file) => {
        const active = this.projectState.getActiveCanvas();
        const activeSpatial = active ? this.spatialCanvases.get(active.id) : undefined;
        const mesh = await AssetImporter.importReferenceImage(file, activeSpatial);
        this.sceneManager.scene.add(mesh);
      },
      onImportModel: async (file) => {
        const model = await AssetImporter.importGLTFModel(file);
        this.sceneManager.scene.add(model);
      },
    });

    this.bookmarkTimeline = new BookmarkTimeline(this.uiLayer, {
      onSelectBookmark: (bm) => this.cameraAnimator.flyToBookmark(bm),
      onAddBookmark: () => {
        this.handleAddBookmark();
        this.bookmarkTimeline.updateBookmarks(this.projectState.getBookmarks());
      },
      onDeleteBookmark: (bmId) => {
        this.projectState.removeBookmark(bmId);
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
      onToggleGuidePanel: () => this.guidePanel.toggle(),
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
    } else if (tool === 'liquify') {
      this.currentTool = this.liquifyTool;
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
        <button id="btn-add-view-canvas" class="action-pill" style="background: var(--bg-active); border-color: var(--border-highlight);" title="Drop a drawing canvas facing current camera view (Hotkey: C)">➕ Canvas From View (C)</button>
        <button id="btn-minimap" class="action-pill" title="Toggle Bird's Eye View Minimap">🧭 Minimap</button>
        <button id="btn-toggle-angle-fade" class="action-pill" title="Toggle Mental Canvas angle-dependent stroke opacity">👁️ Angle Fade</button>
        <select id="select-bg-style" class="action-pill" style="cursor: pointer; outline: none; background: var(--bg-panel); color: var(--text-primary); border-radius: var(--radius-full);" title="Background Style">
          <option value="dark">🌑 Dark</option>
          <option value="studio">🌌 Studio</option>
          <option value="light">☀️ Light</option>
          <option value="transparent">🔲 Alpha</option>
        </select>
        <select id="select-postfx-mode" class="action-pill" style="cursor: pointer; outline: none; background: var(--bg-panel); color: var(--text-primary); border-radius: var(--radius-full);" title="Post-Processing Effects">
          <option value="none">✨ FX: None</option>
          <option value="dof">🎥 FX: DoF</option>
          <option value="toon">🎨 FX: Toon</option>
          <option value="all">🎬 FX: All</option>
        </select>
        <button id="btn-export-png" class="action-pill">📷 Snapshot</button>
        <button id="btn-export-glb" class="action-pill">📦 GLB</button>
        <button id="btn-export-obj" class="action-pill">📄 OBJ</button>
        <button id="btn-export-mp4" class="action-pill">🎬 MP4</button>
      </div>
    `;

    header.querySelector('#btn-add-view-canvas')?.addEventListener('click', () => {
      this.handleCreateCanvasFromView();
    });

    header.querySelector('#btn-minimap')?.addEventListener('click', () => {
      this.birdsEyeView.toggle();
    });

    header.querySelector('#btn-toggle-angle-fade')?.addEventListener('click', (e) => {
      this.isAngleFadeEnabled = !this.isAngleFadeEnabled;
      const btn = e.currentTarget as HTMLElement;
      btn.style.opacity = this.isAngleFadeEnabled ? '1.0' : '0.5';
      if (!this.isAngleFadeEnabled) {
        this.strokeRenderer.updateAngleOpacities(() => 1.0);
      }
    });

    header.querySelector('#select-bg-style')?.addEventListener('change', (e) => {
      const style = (e.target as HTMLSelectElement).value as BackgroundStyle;
      this.sceneManager.setBackgroundStyle(style);
    });

    header.querySelector('#select-postfx-mode')?.addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement).value as PostFxMode;
      this.sceneManager.setPostFxMode(mode);
    });

    header.querySelector('#btn-export-png')?.addEventListener('click', () => {
      ImageExporter.downloadSnapshot(this.sceneManager.renderer.domElement);
    });

    header.querySelector('#btn-export-glb')?.addEventListener('click', () => {
      this.gltfExporter.downloadGLB(this.sceneManager.scene);
    });

    header.querySelector('#btn-export-obj')?.addEventListener('click', () => {
      this.objExporter.downloadOBJ(this.sceneManager.scene);
    });

    header.querySelector('#btn-export-mp4')?.addEventListener('click', async () => {
      const bookmarks = this.projectState.getBookmarks();
      if (bookmarks.length < 2) {
        alert('Please create at least 2 camera bookmarks in the timeline to export a flythrough tour video.');
        return;
      }
      const btn = header.querySelector('#btn-export-mp4') as HTMLButtonElement;
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳ Rendering MP4...';
      try {
        await VideoExporter.exportFlythrough(
          this.sceneManager.renderer.domElement,
          () => this.sceneManager.render(),
          this.cameraAnimator,
          bookmarks,
          {
            fps: 30,
            onProgress: (p) => {
              btn.textContent = `🎬 ${Math.round(p * 100)}%`;
            },
          }
        );
      } catch (err) {
        console.error('Failed to export video:', err);
        alert(`Video export failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    // Floating depth slice HUD
    this.depthHud = document.createElement('div');
    this.depthHud.className = 'glass-panel ui-interactive';
    this.depthHud.style.cssText =
      'display: none; position: absolute; top: 76px; left: 50%; transform: translateX(-50%); padding: 8px 18px; font-size: 13px; font-weight: 500; color: var(--accent-secondary); gap: 10px; align-items: center; z-index: 100; border-color: var(--border-highlight);';
    this.depthHud.innerHTML = `<span>📐 New Plane Depth: <b id="depth-hud-value" style="color: #fff; font-family: var(--font-mono);">+0.0m</b> <span style="color: var(--text-secondary); font-size: 11px;">(Scroll/Wheel to slice depth, Release [C] to place)</span></span>`;
    this.depthHudValue = this.depthHud.querySelector('#depth-hud-value') as HTMLElement;
    this.uiLayer.appendChild(this.depthHud);

    const btnAddView = header.querySelector('#btn-add-view-canvas') as HTMLButtonElement;
    btnAddView.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.startPlanePreview();
    });

    window.addEventListener('pointerup', () => {
      if (this.isHoldingC) {
        this.commitPlanePreview();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'c' || e.key === 'C') && !e.repeat) {
        this.startPlanePreview();
      }
      if (e.key === 'Escape' && this.planePreview.isActive()) {
        this.cancelPlanePreview();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'c' || e.key === 'C') {
        this.commitPlanePreview();
      }
    });

    this.uiLayer.appendChild(header);

    const status = document.createElement('div');
    status.className = 'status-pill glass-panel ui-interactive';
    status.innerHTML = `<span class="status-dot"></span><span>Active Canvas: <b id="active-canvas-label">Front (XY)</b></span>`;
    this.uiLayer.appendChild(status);
  }

  private startPlanePreview(): void {
    if (this.planePreview.isActive()) return;
    this.isHoldingC = true;
    const cam = this.sceneManager.camera;
    const target = this.sceneManager.cameraController.getTarget();
    this.planePreview.start(cam, target);
    this.depthHud.style.display = 'flex';
    this.updateDepthHud();
  }

  private commitPlanePreview(): void {
    if (!this.planePreview.isActive()) return;
    const result = this.planePreview.getResult();
    this.planePreview.stop();
    this.depthHud.style.display = 'none';
    this.isHoldingC = false;

    const count = this.spatialCanvases.size + 1;
    const data = this.projectState.addCanvas(
      `View Canvas ${count}`,
      'CUSTOM',
      result.position,
      result.rotation
    );
    this.registerSpatialCanvas(data);
  }

  private cancelPlanePreview(): void {
    if (!this.planePreview.isActive()) return;
    this.planePreview.stop();
    this.depthHud.style.display = 'none';
    this.isHoldingC = false;
  }

  private updateDepthHud(): void {
    const depth = this.planePreview.getResult().depth;
    this.depthHudValue.textContent = `${depth >= 0 ? '+' : ''}${depth.toFixed(1)}m`;
  }

  private getActiveSpatialCanvas(): SpatialCanvas | undefined {
    const activeId = this.projectState.getProject().activeCanvasId;
    return this.spatialCanvases.get(activeId);
  }

  private handleSelectCanvas(id: string): void {
    this.projectState.setActiveCanvas(id);
    for (const [cId, spatial] of this.spatialCanvases) {
      spatial.setActive(cId === id);
    }
    const canvas = this.projectState.getActiveCanvas();
    const label = this.uiLayer.querySelector('#active-canvas-label');
    if (label && canvas) label.textContent = canvas.name;
    this.snapToActiveCanvas();
  }

  private handleCreateCanvasFromView(): void {
    this.startPlanePreview();
    this.commitPlanePreview();
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

    // Only allow the new canvas to display its grid temporarily; hide all older canvas grids
    for (const [id, c] of this.spatialCanvases) {
      c.setGridVisible(id === data.id);
    }

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

  private updateMinimap(): void {
    if (!this.birdsEyeView || !this.birdsEyeView.getIsVisible()) return;

    const activeCanvas = this.projectState.getActiveCanvas();
    const items: MinimapCanvasItem[] = [];

    for (const [id, spatial] of this.spatialCanvases) {
      const obj = spatial.getObject();
      const euler = new Euler().setFromQuaternion(obj.quaternion, 'YXZ');
      items.push({
        id,
        name: spatial.name,
        x: obj.position.x,
        z: obj.position.z,
        width: spatial.width,
        angle: euler.y,
        isActive: activeCanvas ? activeCanvas.id === id : false,
      });
    }

    const cam = this.sceneManager.camera;
    const target = this.sceneManager.cameraController.getTarget();
    const camEuler = new Euler().setFromQuaternion(cam.quaternion, 'YXZ');

    this.birdsEyeView.update(items, {
      x: cam.position.x,
      z: cam.position.z,
      targetX: target.x,
      targetZ: target.z,
      angle: camEuler.y,
      fov: cam.fov,
    });
  }

  private updateStrokeAngleFading(): void {
    const camPos = this.sceneManager.camera.position;
    this.strokeRenderer.updateAngleOpacities((canvasId: string) => {
      const spatial = this.spatialCanvases.get(canvasId);
      if (!spatial) return 1.0;
      return spatial.getFacingFactor(camPos);
    });
  }

  /**
   * Disposes of application subsystems.
   */
  public dispose(): void {
    this.sceneManager.dispose();
    this.strokeRenderer.dispose();
    this.guideSurface.dispose();
    this.planePreview.dispose();
    this.cameraAnimator.dispose();
    this.inputManager.dispose();
    this.projectState.dispose();
    this.toolbar.dispose();
    this.colorPicker.dispose();
    this.canvasPanel.dispose();
    this.layerPanel.dispose();
    this.guidePanel.dispose();
    this.bookmarkTimeline.dispose();
    this.birdsEyeView.dispose();
  }
}
