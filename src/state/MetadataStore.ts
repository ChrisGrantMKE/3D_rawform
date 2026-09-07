import Dexie, { type EntityTable } from 'dexie';
import type { SpatialCanvasData } from '../types/canvas';
import type { StrokeData } from '../types/stroke';
import type { ProjectData } from '../types/project';

interface ProjectRecord {
  id: string;
  name: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  activeCanvasId: string;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
}

interface CanvasRecord extends SpatialCanvasData {
  projectId: string;
}

interface StrokeRecord extends StrokeData {
  projectId: string;
}

/**
 * Dexie.js database tracking project metadata, canvas layouts, and stroke index records.
 */
export class MetadataStore extends Dexie {
  public projects!: EntityTable<ProjectRecord, 'id'>;
  public canvases!: EntityTable<CanvasRecord, 'id'>;
  public strokes!: EntityTable<StrokeRecord, 'id'>;

  /**
   * Initializes Dexie database schema and tables.
   */
  constructor() {
    super('3D_rawform_DB');

    this.version(1).stores({
      projects: 'id, name, updatedAt',
      canvases: 'id, projectId, planeType',
      strokes: 'id, canvasId, projectId, timestamp',
    });

    this.requestPersistence();
  }

  /**
   * Saves or updates a project manifest.
   *
   * @param project - Full project data
   */
  public async saveProject(project: ProjectData): Promise<void> {
    await this.transaction('rw', this.projects, this.canvases, this.strokes, async () => {
      await this.projects.put({
        id: project.id,
        name: project.name,
        version: project.version,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        activeCanvasId: project.activeCanvasId,
        camera: project.camera,
      });

      for (const c of project.canvases) {
        await this.canvases.put({ ...c, projectId: project.id });
      }

      for (const s of project.strokes) {
        await this.strokes.put({ ...s, projectId: project.id });
      }
    });
  }

  /**
   * Loads an entire project including canvas definitions and stroke metadata.
   *
   * @param projectId - Unique project ID
   * @returns Complete project structure or null if not found
   */
  public async loadProject(projectId: string): Promise<ProjectData | null> {
    const project = await this.projects.get(projectId);
    if (!project) return null;

    const canvases = await this.canvases.where('projectId').equals(projectId).toArray();
    const strokes = await this.strokes.where('projectId').equals(projectId).toArray();

    return {
      id: project.id,
      name: project.name,
      version: project.version,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      activeCanvasId: project.activeCanvasId,
      camera: project.camera,
      canvases,
      strokes,
    };
  }

  /**
   * Requests persistent storage from browser to prevent eviction.
   */
  private async requestPersistence(): Promise<void> {
    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch {
        // Ignored if permission prompt is declined
      }
    }
  }
}
