interface InkTrailStyle {
  color: string;
  diameter: number;
}

interface WebInkPresenter {
  updateInkTrailStartPoint(event: PointerEvent, style: InkTrailStyle): void;
}

interface NavigatorWithInk extends Navigator {
  ink?: {
    requestPresenter(options?: { presentationArea?: HTMLElement }): Promise<WebInkPresenter>;
  };
}

/**
 * Low-latency direct OS compositor ink trail presenter using the Web Ink API.
 */
export class InkPresenter {
  private presenter: WebInkPresenter | null = null;
  private isSupported: boolean = false;

  /**
   * Initializes the InkPresenter on the target presentation container.
   *
   * @param targetElement - Canvas container element
   */
  public async init(targetElement: HTMLElement): Promise<void> {
    const nav = navigator as NavigatorWithInk;
    if (nav.ink && typeof nav.ink.requestPresenter === 'function') {
      try {
        this.presenter = await nav.ink.requestPresenter({ presentationArea: targetElement });
        this.isSupported = true;
      } catch {
        this.isSupported = false;
        this.presenter = null;
      }
    }
  }

  /**
   * Updates OS-level ink trail start point for ultra-low latency drawing.
   *
   * @param event - Active stylus PointerEvent
   * @param color - Hex color string
   * @param diameter - Stroke diameter in CSS pixels
   */
  public updateTrail(event: PointerEvent, color: string, diameter: number): void {
    if (!this.isSupported || !this.presenter) {
      return;
    }

    try {
      this.presenter.updateInkTrailStartPoint(event, {
        color,
        diameter: Math.max(1, diameter),
      });
    } catch {
      // Ignored if compositor buffer is temporarily locked
    }
  }

  /**
   * Returns whether Web Ink API is supported on this client device.
   */
  public getSupported(): boolean {
    return this.isSupported;
  }
}
