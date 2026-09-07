# System Architecture — 3D_rawform

## Tech Stack Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 3D Engine | Three.js + WebGPU | Compute shaders unlock massive performance gains over WebGL 2 |
| Stroke Rendering | Makio MeshLine (TSL) + WebGPU Compute Shaders | TSL-powered, WebGPU-native with WebGL2 fallback |
| Curve Smoothing | Catmull-Rom splines | Industry standard, preserves drawn intent |
| Input Handling | Pointer Events API + Web Ink API | Unified handling + ultra-low latency OS compositor bypass |
| Camera Animation | GSAP + Quaternion SLERP | Smooth keyframe interpolation without gimbal lock |
| Build System | Vite + TypeScript | Fast HMR, tree-shaking, strict type safety |
| Storage | OPFS + Dexie.js | 15x–30x faster binary storage in OPFS; metadata in Dexie |
| Windows Target | PWA (Workbox) | Offline-capable, no install friction, avoids Electron bloat |
| Android Target | Capacitor 6 | WebGL2 fallback (WebView lacks WebGPU); OPFS supported |

## Component Architecture

```
Input Layer (Pointer Events + Web Ink API)
    → InputManager (state machine routing pen vs touch)
    → PenHandler (pressure, tilt, eraser, coalesced/predicted events)
    → TouchHandler (gesture recognition)
    → PalmRejection (contact area + temporal filtering)
    → InkPresenter (Web Ink API low-latency trail)

Engine Layer (Three.js WebGPU)
    → SceneManager (scene, camera, lights, render loop)
    → StrokeRenderer (Makio MeshLine + TSL Compute Shader)
    → SpatialCanvas (2D plane in 3D space)
    → CameraController (orbit, pan, zoom)
    → CameraAnimator (GSAP SLERP bookmark flythrough)

State Layer
    → ProjectState (central state)
    → UndoRedoManager (command pattern)
    → MetadataStore (Dexie.js metadata-only)
    → BinaryStore (OPFS via StorageWorker)

Worker Layer
    → StorageWorker (OPFS FileSystemSyncAccessHandle I/O)

UI Layer (DOM)
    → Toolbar, ColorPicker, LayerPanel, BookmarkTimeline

Export Layer
    → GLTFExporter, OBJExporter, ImageExporter
    → VideoExporter (WebCodecs + mp4-muxer)
```

## Data Flow

```
User Pen Input → InputManager → PenHandler (coalesced) → StrokeRenderer → Scene
User Touch Input → InputManager → TouchHandler → CameraController → Camera
Save → ProjectState → MetadataStore (Dexie) + BinaryStore (OPFS via Worker)
Export → ProjectState → GLTFExporter / VideoExporter → File Download
```
