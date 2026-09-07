# Architecture Decision Records — 3D_rawform

## ADR-001: Three.js over Babylon.js for 3D Engine
**Date:** 2026-09-07
**Status:** Accepted

**Context:** Needed a WebGL-based 3D engine with custom shader support, good mobile performance, and a large ecosystem.

**Decision:** Use Three.js with WebGL 2.

**Consequences:**
- Massive community and documentation available
- MeshLine library available for variable-width strokes
- Custom GLSL shaders fully supported
- WebGPU renderer available as future migration path
- Bundle size is reasonable (~150KB gzipped)

---

## ADR-002: PWA over Electron for Windows Target
**Date:** 2026-09-07
**Status:** Accepted

**Context:** Need a native-feeling desktop experience on Surface Pro without massive distribution overhead.

**Decision:** Ship as a PWA with Workbox service worker, using the File System Access API for save/open dialogs.

**Consequences:**
- No ~100MB Electron overhead
- Full offline support via service worker
- File System Access API provides native save/open dialogs in Chromium browsers
- Limitation: Firefox/Safari don't support File System Access API (fallback to download/upload)

---

## ADR-003: Dexie.js over raw IndexedDB for Storage
**Date:** 2026-09-07
**Status:** Accepted

**Context:** Need fast, local-first storage for large stroke vertex data (Float32Array) with query support for project metadata.

**Decision:** Use Dexie.js as the IndexedDB wrapper with a granular, append-friendly schema.

**Consequences:**
- Clean Promise-based API vs raw IndexedDB callbacks
- `bulkAdd()`/`bulkPut()` for batch operations
- Binary data (Float32Array) stored directly without base64 conversion
- Binary columns intentionally not indexed to prevent database bloat

---

## ADR-004: MeshLine for Phase 1 Stroke Rendering
**Date:** 2026-09-07
**Status:** Accepted

**Context:** Need variable-width, pressure-sensitive 3D strokes. WebGL has no native variable-width line support.

**Decision:** Start with THREE.MeshLine (proven library), migrate to custom ribbon BufferGeometry shader if performance becomes a bottleneck.

**Consequences:**
- Fast to implement (days, not weeks)
- Custom width callback maps pen pressure to line thickness
- Migration to custom shader is straightforward — same vertex data, different rendering
- MeshLine adds ~20KB to bundle

---

## ADR-005: WebGPU & TSL for Rendering Engine
**Date:** 2026-09-07
**Status:** Accepted

**Context:** CPU-bound geometry generation for complex strokes bottlenecks performance, especially for procedural styles.
**Decision:** Use Three.js `WebGPURenderer` and TSL (Three Shader Language).
**Consequences:**
- Unlocks Compute Shaders to generate ribbon geometry directly on the GPU.
- TSL automatically compiles to WebGL2 for older devices.
- Requires learning TSL syntax rather than raw GLSL.

---

## ADR-006: OPFS for Binary Storage
**Date:** 2026-09-07
**Status:** Accepted

**Context:** Storing raw `Float32Array` in IndexedDB causes main-thread blocking due to Structured Clone serialization.
**Decision:** Use Origin Private File System (OPFS) with `FileSystemSyncAccessHandle` inside a Web Worker.
**Consequences:**
- 15x–30x faster read/write speeds for stroke data.
- Dexie.js is retained solely for metadata queries.
- Adds architectural complexity (requires Web Worker synchronization).

---

## ADR-007: Web Ink API for Low-Latency Input
**Date:** 2026-09-07
**Status:** Accepted

**Context:** WebGL/WebGPU rendering is tied to the JS main thread, creating slight latency between the pen tip and the drawn line.
**Decision:** Implement the Web Ink API as a progressive enhancement.
**Consequences:**
- Zero-latency "ink trails" via direct OS compositor rendering on supported browsers (Chrome/Edge).
- Safe fallback to standard rendering when unsupported.
