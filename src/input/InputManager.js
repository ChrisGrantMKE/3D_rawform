import { PalmRejection } from './PalmRejection';
import { PenHandler } from './PenHandler';
import { TouchHandler } from './TouchHandler';
import { InkPresenter } from './InkPresenter';
/**
 * Orchestrates incoming pointer events and routes between stylus tools and camera touch gestures.
 */
export class InputManager {
    targetElement;
    palmRejection;
    penHandler;
    touchHandler;
    inkPresenter;
    isMouseOrbiting = false;
    isMousePanning = false;
    lastMouseX = 0;
    lastMouseY = 0;
    listeners;
    /**
     * Initializes the input manager attached to the target canvas container.
     *
     * @param targetElement - Presentation canvas container
     */
    constructor(targetElement) {
        this.targetElement = targetElement;
        this.palmRejection = new PalmRejection();
        this.penHandler = new PenHandler();
        this.touchHandler = new TouchHandler();
        this.inkPresenter = new InkPresenter();
        this.inkPresenter.init(targetElement);
        this.setupHandlers();
        this.bindEvents();
    }
    /**
     * Registers application event listeners for tool and camera actions.
     */
    setListeners(listeners) {
        this.listeners = listeners;
    }
    /**
     * Returns the InkPresenter instance for low-latency trail rendering.
     */
    getInkPresenter() {
        return this.inkPresenter;
    }
    /**
     * Cleans up event listeners.
     */
    dispose() {
        this.targetElement.removeEventListener('pointerdown', this.onPointerDown);
        this.targetElement.removeEventListener('pointermove', this.onPointerMove);
        this.targetElement.removeEventListener('pointerup', this.onPointerUp);
        this.targetElement.removeEventListener('pointercancel', this.onPointerUp);
        this.targetElement.removeEventListener('wheel', this.onWheel);
        this.targetElement.removeEventListener('contextmenu', this.onContextMenu);
    }
    /**
     * Routes pen and touch handler outputs to higher-level application listeners.
     */
    setupHandlers() {
        this.penHandler.setCallbacks({
            onDown: (data) => this.listeners?.onPenDown(data),
            onMove: (data) => this.listeners?.onPenMove(data),
            onUp: (data) => this.listeners?.onPenUp(data),
        });
        const touchCallbacks = {
            onOrbit: (dTheta, dPhi) => this.listeners?.onCameraOrbit(dTheta, dPhi),
            onPan: (dx, dy) => this.listeners?.onCameraPan(dx, dy),
            onZoom: (factor) => this.listeners?.onCameraZoom(factor),
        };
        this.touchHandler.setCallbacks(touchCallbacks);
    }
    /**
     * Binds pointer event listeners with passive: false for gesture prevention.
     */
    bindEvents() {
        this.targetElement.addEventListener('pointerdown', this.onPointerDown, { passive: false });
        this.targetElement.addEventListener('pointermove', this.onPointerMove, { passive: false });
        this.targetElement.addEventListener('pointerup', this.onPointerUp, { passive: false });
        this.targetElement.addEventListener('pointercancel', this.onPointerUp, { passive: false });
        this.targetElement.addEventListener('wheel', this.onWheel, { passive: false });
        this.targetElement.addEventListener('contextmenu', this.onContextMenu);
    }
    onPointerDown = (e) => {
        e.preventDefault();
        if (e.pointerType === 'pen') {
            this.palmRejection.notifyPenDown();
            this.penHandler.handlePointerDown(e);
        }
        else if (e.pointerType === 'touch') {
            if (!this.palmRejection.shouldRejectTouch(e)) {
                this.touchHandler.handlePointerDown(e);
            }
        }
        else {
            // Mouse interaction
            if (e.button === 0 && !e.altKey) {
                this.penHandler.handlePointerDown(e);
            }
            else if (e.button === 2 || (e.button === 0 && e.altKey)) {
                this.isMouseOrbiting = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
            else if (e.button === 1) {
                this.isMousePanning = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        }
    };
    onPointerMove = (e) => {
        e.preventDefault();
        if (e.pointerType === 'pen') {
            this.penHandler.handlePointerMove(e);
        }
        else if (e.pointerType === 'touch') {
            if (!this.palmRejection.shouldRejectTouch(e)) {
                this.touchHandler.handlePointerMove(e);
            }
        }
        else {
            if (e.buttons === 1 && !e.altKey && !this.isMouseOrbiting) {
                this.penHandler.handlePointerMove(e);
            }
            else if (this.isMouseOrbiting) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.listeners?.onCameraOrbit(dx * 0.005, dy * 0.005);
            }
            else if (this.isMousePanning) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.listeners?.onCameraPan(dx, dy);
            }
        }
    };
    onPointerUp = (e) => {
        e.preventDefault();
        if (e.pointerType === 'pen') {
            this.palmRejection.notifyPenUp();
            this.penHandler.handlePointerUp(e);
        }
        else if (e.pointerType === 'touch') {
            this.touchHandler.handlePointerUp(e);
        }
        else {
            this.penHandler.handlePointerUp(e);
            this.isMouseOrbiting = false;
            this.isMousePanning = false;
        }
    };
    onWheel = (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.08 : 0.92;
        this.listeners?.onCameraZoom(factor);
    };
    onContextMenu = (e) => {
        e.preventDefault();
    };
}
