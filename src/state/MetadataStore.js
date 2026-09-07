import Dexie from 'dexie';
/**
 * Dexie.js database tracking project metadata, canvas layouts, and stroke index records.
 */
export class MetadataStore extends Dexie {
    projects;
    canvases;
    strokes;
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
    async saveProject(project) {
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
    async loadProject(projectId) {
        const project = await this.projects.get(projectId);
        if (!project)
            return null;
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
    async requestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                await navigator.storage.persist();
            }
            catch {
                // Ignored if permission prompt is declined
            }
        }
    }
}
