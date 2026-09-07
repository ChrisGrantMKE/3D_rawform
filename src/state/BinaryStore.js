/**
 * Main-thread client for OPFS binary stroke storage via StorageWorker.
 */
export class BinaryStore {
    worker = null;
    pendingRequests = new Map();
    inMemoryFallback = new Map();
    reqCounter = 0;
    /**
     * Initializes the binary store and spawns the storage worker.
     */
    constructor() {
        try {
            this.worker = new Worker(new URL('../workers/StorageWorker.ts', import.meta.url), { type: 'module' });
            this.worker.onmessage = this.handleWorkerMessage.bind(this);
        }
        catch {
            this.worker = null;
        }
    }
    /**
     * Writes a stroke vertex Float32Array buffer to OPFS.
     *
     * @param strokeId - Unique identifier of the stroke
     * @param buffer - Raw Float32Array containing stroke vertices and pressure
     */
    async writeStroke(strokeId, buffer) {
        if (!this.worker) {
            this.inMemoryFallback.set(strokeId, buffer.slice());
            return;
        }
        const id = `req_${++this.reqCounter}`;
        const copy = buffer.buffer.slice(0);
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.worker?.postMessage({ type: 'write', id, strokeId, buffer: copy }, [copy]);
        });
    }
    /**
     * Reads a stroke vertex Float32Array from OPFS.
     *
     * @param strokeId - Unique identifier of the stroke
     * @returns The recovered Float32Array buffer or null if missing
     */
    async readStroke(strokeId) {
        if (!this.worker) {
            return this.inMemoryFallback.get(strokeId) || null;
        }
        const id = `req_${++this.reqCounter}`;
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, {
                resolve: (data) => {
                    if (data && data.buffer) {
                        resolve(new Float32Array(data.buffer));
                    }
                    else {
                        resolve(null);
                    }
                },
                reject,
            });
            this.worker?.postMessage({ type: 'read', id, strokeId });
        });
    }
    /**
     * Deletes a stroke binary file from OPFS.
     *
     * @param strokeId - Unique identifier of the stroke
     */
    async deleteStroke(strokeId) {
        if (!this.worker) {
            this.inMemoryFallback.delete(strokeId);
            return;
        }
        const id = `req_${++this.reqCounter}`;
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.worker?.postMessage({ type: 'delete', id, strokeId });
        });
    }
    /**
     * Dispatches responses from the Web Worker to pending promises.
     */
    handleWorkerMessage(e) {
        const { id, type, error, buffer } = e.data;
        const req = this.pendingRequests.get(id);
        if (!req)
            return;
        this.pendingRequests.delete(id);
        if (type === 'error' || error) {
            req.reject(new Error(error || 'Worker storage operation failed'));
        }
        else {
            req.resolve({ buffer });
        }
    }
}
