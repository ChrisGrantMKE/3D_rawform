interface StorageWorkerMessage {
  type: 'write' | 'read' | 'delete' | 'clear';
  id?: string;
  strokeId?: string;
  buffer?: ArrayBuffer;
}

interface StorageWorkerResponse {
  type: 'write' | 'read' | 'delete' | 'clear' | 'error';
  id?: string;
  strokeId?: string;
  buffer?: ArrayBuffer;
  error?: string;
}

/**
 * Web Worker for synchronous, high-throughput OPFS binary stroke I/O.
 */
self.onmessage = async (e: MessageEvent<StorageWorkerMessage>) => {
  const { type, id, strokeId, buffer } = e.data;

  try {
    const root = await navigator.storage.getDirectory();
    const strokesDir = await root.getDirectoryHandle('strokes', { create: true });

    if (type === 'write' && strokeId && buffer) {
      const fileHandle = await strokesDir.getFileHandle(`stroke_${strokeId}.bin`, { create: true });
      // Use createSyncAccessHandle when available in workers
      if ('createSyncAccessHandle' in fileHandle) {
        const accessHandle = await (fileHandle as any).createSyncAccessHandle();
        accessHandle.truncate(0);
        accessHandle.write(new Uint8Array(buffer), { at: 0 });
        accessHandle.flush();
        accessHandle.close();
      } else {
        const writable = await fileHandle.createWritable();
        await writable.write(buffer);
        await writable.close();
      }

      self.postMessage({ type: 'write', id, strokeId } as StorageWorkerResponse);
    } else if (type === 'read' && strokeId) {
      const fileHandle = await strokesDir.getFileHandle(`stroke_${strokeId}.bin`);
      const file = await fileHandle.getFile();
      const arrayBuffer = await file.arrayBuffer();

      (self as unknown as { postMessage: (msg: unknown, transfer?: Transferable[]) => void }).postMessage(
        { type: 'read', id, strokeId, buffer: arrayBuffer } as StorageWorkerResponse,
        [arrayBuffer]
      );
    } else if (type === 'delete' && strokeId) {
      await strokesDir.removeEntry(`stroke_${strokeId}.bin`);
      self.postMessage({ type: 'delete', id, strokeId } as StorageWorkerResponse);
    } else if (type === 'clear') {
      for await (const name of (strokesDir as any).keys()) {
        await strokesDir.removeEntry(name);
      }
      self.postMessage({ type: 'clear', id } as StorageWorkerResponse);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', id, error: errorMsg } as StorageWorkerResponse);
  }
};
