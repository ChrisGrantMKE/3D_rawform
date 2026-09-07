import type { CameraBookmark } from '../types/bookmark';

export interface BookmarkTimelineCallbacks {
  onAddBookmark: () => void;
  onSelectBookmark: (bookmark: CameraBookmark, index: number) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onPlayTour: () => void;
  onPauseTour: () => void;
  onSeekTour: (progress: number) => void;
  onToggleLoop: (loop: boolean) => void;
}

/**
 * Bottom-docked cinematic timeline for camera bookmarks and flythrough sequencing.
 */
export class BookmarkTimeline {
  private readonly container: HTMLElement;
  private readonly rootElement: HTMLElement;
  private readonly callbacks: BookmarkTimelineCallbacks;

  private isVisible: boolean = false;
  private isPlaying: boolean = false;
  private isLooping: boolean = false;

  private playButton!: HTMLButtonElement;
  private loopButton!: HTMLButtonElement;
  private scrubber!: HTMLInputElement;
  private cardsContainer!: HTMLElement;

  constructor(container: HTMLElement, callbacks: BookmarkTimelineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'bookmark-timeline-container glass-panel ui-interactive';
    this.rootElement.style.display = 'none';

    this.render();
    this.container.appendChild(this.rootElement);
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.rootElement.style.display = this.isVisible ? 'flex' : 'none';
  }

  public updateBookmarks(bookmarks: CameraBookmark[], activeIndex: number = -1): void {
    this.cardsContainer.innerHTML = bookmarks
      .map(
        (b, i) => `
        <div class="bookmark-card ${i === activeIndex ? 'active' : ''}" data-id="${b.id}" data-index="${i}">
          <div class="bookmark-index">#${i + 1}</div>
          <div class="bookmark-info">
            <span class="bookmark-name">${b.name}</span>
            <span class="bookmark-time">${b.duration}s</span>
          </div>
          <button class="small-btn btn-del-bm" data-id="${b.id}" title="Delete bookmark">✕</button>
        </div>
      `
      )
      .join('');

    this.bindCardEvents(bookmarks);
  }

  public setProgress(progress: number): void {
    this.scrubber.value = (progress * 100).toFixed(1);
  }

  public setPlayingState(playing: boolean): void {
    this.isPlaying = playing;
    this.playButton.innerHTML = playing ? '⏸ Pause' : '▶ Play Tour';
  }

  public dispose(): void {
    this.rootElement.remove();
  }

  private render(): void {
    this.rootElement.innerHTML = `
      <div class="timeline-controls">
        <button id="btn-add-bm" class="action-pill">+ Add View</button>
        <div class="toolbar-separator"></div>
        <button id="btn-play-tour" class="action-pill">▶ Play Tour</button>
        <button id="btn-loop-tour" class="tool-button" title="Loop playback">🔁</button>
        <input id="timeline-scrubber" class="custom-range" type="range" min="0" max="100" value="0" style="width: 140px;" />
        <button id="btn-close-timeline" class="small-btn" style="margin-left: 8px;">✕</button>
      </div>
      <div class="timeline-cards-strip" id="bm-cards-container"></div>
    `;

    this.playButton = this.rootElement.querySelector('#btn-play-tour') as HTMLButtonElement;
    this.loopButton = this.rootElement.querySelector('#btn-loop-tour') as HTMLButtonElement;
    this.scrubber = this.rootElement.querySelector('#timeline-scrubber') as HTMLInputElement;
    this.cardsContainer = this.rootElement.querySelector('#bm-cards-container') as HTMLElement;

    this.bindControls();
  }

  private bindControls(): void {
    this.rootElement.querySelector('#btn-add-bm')?.addEventListener('click', () => {
      this.callbacks.onAddBookmark();
    });

    this.playButton.addEventListener('click', () => {
      if (this.isPlaying) {
        this.callbacks.onPauseTour();
        this.setPlayingState(false);
      } else {
        this.callbacks.onPlayTour();
        this.setPlayingState(true);
      }
    });

    this.loopButton.addEventListener('click', () => {
      this.isLooping = !this.isLooping;
      this.loopButton.classList.toggle('active', this.isLooping);
      this.callbacks.onToggleLoop(this.isLooping);
    });

    this.scrubber.addEventListener('input', () => {
      const val = parseFloat(this.scrubber.value) / 100;
      this.callbacks.onSeekTour(val);
    });

    this.rootElement.querySelector('#btn-close-timeline')?.addEventListener('click', () => {
      this.toggle();
    });
  }

  private bindCardEvents(bookmarks: CameraBookmark[]): void {
    const cards = this.cardsContainer.querySelectorAll('.bookmark-card');
    cards.forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const id = (card as HTMLElement).dataset.id;
        const idx = parseInt((card as HTMLElement).dataset.index || '0', 10);

        if (target.classList.contains('btn-del-bm')) {
          e.stopPropagation();
          if (id) this.callbacks.onDeleteBookmark(id);
          return;
        }

        if (id && bookmarks[idx]) {
          this.callbacks.onSelectBookmark(bookmarks[idx], idx);
        }
      });
    });
  }
}
