import { SceneManager } from './engine/SceneManager';
import { SpatialCanvas } from './engine/SpatialCanvas';
import { StrokeRenderer } from './engine/StrokeRenderer';
import { InputManager } from './input/InputManager';
import { BrushTool } from './tools/BrushTool';
import { EraserTool } from './tools/EraserTool';
import { ProjectState } from './state/ProjectState';
import { UndoRedoManager } from './state/UndoRedoManager';
import { Toolbar } from './ui/Toolbar';
import { ColorPicker } from './ui/ColorPicker';
import { CanvasPanel } from './ui/CanvasPanel';
import { ImageExporter } from './export/ImageExporter';
import { GLTFExporterWrapper } from './export/GLTFExporterWrapper';
/**
 * Root application coordinator bringing together 3D engine, input subsystem, tools, and UI.
 */
export class App {
    canvasContainer;
    uiLayer;
    sceneManager;
    strokeRenderer;
    inputManager;
    projectState;
    undoManager;
    spatialCanvases = new Map();
    brushTool;
    eraserTool;
    currentTool;
    toolbar;
    colorPicker;
    canvasPanel;
    gltfExporter = new GLTFExporterWrapper();
    /**
     * Initializes App DOM references.
     *
     * @param rootContainer - Root DOM container
     */
    constructor(rootContainer) {
        this.canvasContainer = rootContainer.querySelector('#canvas-container');
        this.uiLayer = rootContainer.querySelector('#ui-layer');
    }
    /**
     * Bootstraps WebGPU scene, initial spatial canvas, tools, and user interface.
     */
    async init() {
        this.sceneManager = new SceneManager(this.canvasContainer);
        await this.sceneManager.init();
        this.strokeRenderer = new StrokeRenderer(this.sceneManager.scene);
        this.projectState = new ProjectState();
        this.undoManager = new UndoRedoManager();
        this.setupCanvases();
        this.setupTools();
        this.setupInput();
        this.setupUI();
        this.snapToActiveCanvas();
    }
    /**
     * Instantiates initial spatial canvases from state.
     */
    setupCanvases() {
        const project = this.projectState.getProject();
        for (const canvasData of project.canvases) {
            const spatial = new SpatialCanvas(canvasData);
            this.spatialCanvases.set(canvasData.id, spatial);
            this.sceneManager.scene.add(spatial.getObject());
        }
    }
    /**
     * Configures brush and eraser tools.
     */
    setupTools() {
        const activeCanvasProvider = () => {
            const activeId = this.projectState.getProject().activeCanvasId;
            return this.spatialCanvases.get(activeId);
        };
        this.inputManager = new InputManager(this.canvasContainer);
        this.brushTool = new BrushTool(this.strokeRenderer, this.projectState, this.undoManager, this.sceneManager.camera, this.inputManager.getInkPresenter(), activeCanvasProvider);
        this.eraserTool = new EraserTool(this.strokeRenderer, this.projectState, this.undoManager, this.sceneManager.camera);
        this.currentTool = this.brushTool;
    }
    /**
     * Configures input routing between active tool and camera navigation.
     */
    setupInput() {
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
    /**
     * Constructs UI overlay components and status monitors.
     */
    setupUI() {
        this.buildHeader();
        this.colorPicker = new ColorPicker(this.uiLayer, {
            onColorSelect: (c) => this.projectState.setColor(c),
            onWidthChange: (w) => this.projectState.setWidth(w),
            onOpacityChange: (o) => this.projectState.setOpacity(o),
        });
        this.canvasPanel = new CanvasPanel(this.uiLayer, {
            onSelectCanvas: (id) => this.handleSelectCanvas(id),
            onCreateCanvas: (name, type) => this.handleCreateCanvas(name, type),
            onSnapToCanvas: (id) => this.handleSnapCanvas(id),
        });
        this.toolbar = new Toolbar(this.uiLayer, {
            onToolSelect: (tool) => {
                this.projectState.setTool(tool);
                this.currentTool = tool === 'eraser' ? this.eraserTool : this.brushTool;
                this.toolbar.setActiveTool(tool);
            },
            onToggleColorPanel: () => this.colorPicker.toggle(),
            onToggleCanvasPanel: () => {
                this.canvasPanel.updateCanvases(this.projectState.getProject().canvases, this.projectState.getProject().activeCanvasId);
                this.canvasPanel.toggle();
            },
            onSnapView: () => this.snapToActiveCanvas(),
            onUndo: () => this.undoManager.undo(),
            onRedo: () => this.undoManager.redo(),
            onExportPNG: () => ImageExporter.downloadSnapshot(this.sceneManager.renderer.domElement),
            onExportGLTF: () => this.gltfExporter.downloadGLB(this.sceneManager.scene),
        });
        this.undoManager.onChange(() => {
            this.toolbar.updateHistoryState(this.undoManager.canUndo(), this.undoManager.canRedo());
        });
    }
    buildHeader() {
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
    handleSelectCanvas(id) {
        this.projectState.setActiveCanvas(id);
        const canvas = this.projectState.getActiveCanvas();
        const label = this.uiLayer.querySelector('#active-canvas-label');
        if (label && canvas)
            label.textContent = canvas.name;
        this.snapToActiveCanvas();
    }
    handleCreateCanvas(name, planeType) {
        const pos = [0, 0, 0];
        const rot = [0, 0, 0, 1];
        if (planeType === 'XZ') {
            // Rotate 90 degrees around X axis for horizontal ground plane
            const sin = Math.sin(-Math.PI / 4);
            const cos = Math.cos(-Math.PI / 4);
            rot[0] = sin;
            rot[3] = cos;
            pos[1] = -2;
        }
        else if (planeType === 'YZ') {
            // Rotate 90 degrees around Y axis for side profile plane
            const sin = Math.sin(Math.PI / 4);
            const cos = Math.cos(Math.PI / 4);
            rot[1] = sin;
            rot[3] = cos;
            pos[0] = 3;
        }
        else {
            // Offset XY slightly
            pos[2] = (this.spatialCanvases.size) * 1.5;
        }
        const data = this.projectState.addCanvas(`${name} ${this.spatialCanvases.size + 1}`, planeType, pos, rot);
        const spatial = new SpatialCanvas(data);
        this.spatialCanvases.set(data.id, spatial);
        this.sceneManager.scene.add(spatial.getObject());
        this.handleSelectCanvas(data.id);
        this.canvasPanel.updateCanvases(this.projectState.getProject().canvases, data.id);
    }
    handleSnapCanvas(id) {
        const canvas = this.projectState.getProject().canvases.find((c) => c.id === id);
        if (!canvas)
            return;
        this.sceneManager.cameraController.snapToCanvas(canvas.position, canvas.rotation, 9);
    }
    snapToActiveCanvas() {
        const active = this.projectState.getActiveCanvas();
        if (!active)
            return;
        this.sceneManager.cameraController.snapToCanvas(active.position, active.rotation, 9);
    }
    /**
     * Disposes of application subsystems.
     */
    dispose() {
        this.sceneManager.dispose();
        this.strokeRenderer.dispose();
        this.inputManager.dispose();
        this.projectState.dispose();
        this.toolbar.dispose();
        this.colorPicker.dispose();
        this.canvasPanel.dispose();
    }
}
