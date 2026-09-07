# System Architecture — 3D_rawform

## Tech Stack Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 3D Engine | Three.js + WebGL 2 | Mature ecosystem, custom shader support, WebGPU migration path |
| Stroke Rendering | THREE.MeshLine (Phase 1) → Custom ribbon shader (Phase 2) | MeshLine is proven and fast to integrate; custom shader for perf optimization later |
| Curve Smoothing | Catmull-Rom splines | Industry standard, preserves drawn intent |
| Input Handling | W3C Pointer Events API | Unified pen/touch/mouse with pressure, tilt, width/height |
| Camera Animation | GSAP + Quaternion SLERP | Smooth keyframe interpolation without gimbal lock |
| Build System | Vite + TypeScript | Fast HMR, tree-shaking, strict type safety |
| Storage | IndexedDB via Dexie.js | High-performance local-first binary storage |
| Windows Target | PWA (Workbox) | Offline-capable, no install friction, avoids Electron bloat |
| Android Target | Capacitor 6 | Standard web-to-native bridge, Gradle-based APK build |

## Component Architecture

```
Input Layer (Pointer Events)
    → InputManager (state machine routing pen vs touch)
    → PenHandler (pressure, tilt, eraser detection)
    → TouchHandler (gesture recognition)
    → PalmRejection (contact area + temporal filtering)

Engine Layer (Three.js)
    → SceneManager (scene, camera, lights, render loop)
    → StrokeRenderer (MeshLine/ribbon mesh generation)
    → SpatialCanvas (2D plane in 3D space)
    → CameraController (orbit, pan, zoom)
    → CameraAnimator (GSAP SLERP bookmark flythrough)

State Layer
    → ProjectState (central state)
    → UndoRedoManager (command pattern)
    → StorageManager (Dexie.js IndexedDB)

UI Layer (DOM)
    → Toolbar, ColorPicker, LayerPanel, BookmarkTimeline

Export Layer
    → GLTFExporter, OBJExporter, ImageExporter
```

## Data Flow

```
User Pen Input → InputManager → PenHandler → StrokeRenderer → Scene
User Touch Input → InputManager → TouchHandler → CameraController → Camera
Save → ProjectState → StorageManager → Dexie.js → IndexedDB
Export → ProjectState → GLTFExporter → File Download
```
