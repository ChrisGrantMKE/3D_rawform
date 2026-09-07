import { PalmRejection } from './PalmRejection';
import { PenHandler, type PenEventData } from './PenHandler';
import { TouchHandler, type TouchGestureCallbacks } from './TouchHandler';
import { InkPresenter } from './InkPresenter';

export interface InputManagerListeners {
  onPenDown: (data: PenEventData) => void;
  onPenMove: (data: PenEventData) => void;
  onPenUp: (data: PenEventData) => void;
  onCameraOrbit: (deltaTheta: number, deltaPhi: number) => void;
  onCameraPan: (deltaX: number, deltaY: number) => void;
  onCameraZoom: (factor: number) => void;
  onWheelScroll?: (deltaY: number) => boolean;
}

/**
 * Orchestrates incoming pointer events and routes between stylus tools and camera touch gestures.
 */
export class InputManager {
  private readonly targetElement: HTMLElement;
  private readonly palmRejection: PalmRejection;
  private readonly penHandler: PenHandler;
  private readonly touchHandler: TouchHandler;
  private readonly inkPresenter: InkPresenter;

  private isMouseOrbiting: boolean = false;
  private isMousePanning: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  private listeners?: InputManagerListeners;

  /**
   * Initializes the input manager attached to the target canvas container.
   *
   * @param targetElement - Presentation canvas container
   */
  constructor(targetElement: HTMLElement) {
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
  public setListeners(listeners: InputManagerListeners): void {
    this.listeners = listeners;
  }

  /**
   * Returns the InkPresenter instance for low-latency trail rendering.
   */
  public getInkPresenter(): InkPresenter {
    return this.inkPresenter;
  }

  /**
   * Cleans up event listeners.
   */
  public dispose(): void {
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
  private setupHandlers(): void {
    this.penHandler.setCallbacks({
      onDown: (data) => this.listeners?.onPenDown(data),
      onMove: (data) => this.listeners?.onPenMove(data),
      onUp: (data) => this.listeners?.onPenUp(data),
    });

    const touchCallbacks: TouchGestureCallbacks = {
      onOrbit: (dTheta, dPhi) => this.listeners?.onCameraOrbit(dTheta, dPhi),
      onPan: (dx, dy) => this.listeners?.onCameraPan(dx, dy),
      onZoom: (factor) => this.listeners?.onCameraZoom(factor),
    };
    this.touchHandler.setCallbacks(touchCallbacks);
  }

  /**
   * Binds pointer event listeners with passive: false for gesture prevention.
   */
  private bindEvents(): void {
    this.targetElement.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    this.targetElement.addEventListener('pointermove', this.onPointerMove, { passive: false });
    this.targetElement.addEventListener('pointerup', this.onPointerUp, { passive: false });
    this.targetElement.addEventListener('pointercancel', this.onPointerUp, { passive: false });
    this.targetElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.targetElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();

    if (e.pointerType === 'pen') {
      this.palmRejection.notifyPenDown();
      this.penHandler.handlePointerDown(e);
    } else if (e.pointerType === 'touch') {
      if (!this.palmRejection.shouldRejectTouch(e)) {
        this.touchHandler.handlePointerDown(e);
      }
    } else {
      // Mouse interaction: Left click draws, Right/Alt+Left orbits, Middle/Shift+Left pans
      if (e.button === 0 && !e.altKey && !e.shiftKey) {
        this.penHandler.handlePointerDown(e);
      } else if (e.button === 2 || (e.button === 0 && e.altKey)) {
        this.isMouseOrbiting = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.isMousePanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    e.preventDefault();

    if (e.pointerType === 'pen') {
      this.penHandler.handlePointerMove(e);
    } else if (e.pointerType === 'touch') {
      if (!this.palmRejection.shouldRejectTouch(e)) {
        this.touchHandler.handlePointerMove(e);
      }
    } else {
      if (e.buttons === 1 && !e.altKey && !e.shiftKey && !this.isMouseOrbiting && !this.isMousePanning) {
        this.penHandler.handlePointerMove(e);
      } else if (this.isMouseOrbiting) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.listeners?.onCameraOrbit(dx * 0.005, dy * 0.005);
      } else if (this.isMousePanning) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.listeners?.onCameraPan(dx, dy);
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    e.preventDefault();

    if (e.pointerType === 'pen') {
      this.palmRejection.notifyPenUp();
      this.penHandler.handlePointerUp(e);
    } else if (e.pointerType === 'touch') {
      this.touchHandler.handlePointerUp(e);
    } else {
      if (!this.isMouseOrbiting && !this.isMousePanning) {
        this.penHandler.handlePointerUp(e);
      }
      this.isMouseOrbiting = false;
      this.isMousePanning = false;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (this.listeners?.onWheelScroll?.(e.deltaY)) {
      return;
    }
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    this.listeners?.onCameraZoom(factor);
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };
}
