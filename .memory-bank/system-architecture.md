# System Architecture — 3D_rawform

## Tech Stack Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 3D Engine | Three.js + WebGPU | Compute shaders unlock massive performance gains over WebGL 2 |
| Stroke Rendering | WebGPURenderer + TSL Compute Shaders | GPU-side geometry generation; zero CPU bottleneck for strokes |
| Curve Smoothing | Catmull-Rom splines | Industry standard, preserves drawn intent |
| Input Handling | Pointer Events API + Web Ink API | Unified handling + ultra-low latency OS compositor bypass |
| Camera Animation | GSAP + Quaternion SLERP | Smooth keyframe interpolation without gimbal lock |
| Build System | Vite + TypeScript | Fast HMR, tree-shaking, strict type safety |
| Storage | OPFS + Dexie.js | 15x–30x faster binary storage in OPFS; metadata in Dexie |
| Windows Target | PWA (Workbox) | Offline-capable, no install friction, avoids Electron bloat |
| Android Target | Capacitor 6 | Standard web-to-native bridge, Gradle-based APK build |

## Component Architecture

```
Input Layer (Pointer Events + Web Ink API)
    → InputManager (state machine routing pen vs touch)
    → PenHandler (pressure, tilt, eraser detection)
    → TouchHandler (gesture recognition)
    → PalmRejection (contact area + temporal filtering)

Engine Layer (Three.js)
    → SceneManager (scene, camera, lights, render loop)
    → StrokeRenderer (TSL Compute Shader mesh generation)
    → SpatialCanvas (2D plane in 3D space)
    → CameraController (orbit, pan, zoom)
    → CameraAnimator (GSAP SLERP bookmark flythrough)

State Layer
    → ProjectState (central state)
    → UndoRedoManager (command pattern)
    → StorageManager (OPFS + Dexie.js)

UI Layer (DOM)
    → Toolbar, ColorPicker, LayerPanel, BookmarkTimeline

Export Layer
    → GLTFExporter, OBJExporter, ImageExporter
```

## Data Flow

```
User Pen Input → InputManager → PenHandler → StrokeRenderer → Scene
User Touch Input → InputManager → TouchHandler → CameraController → Camera
Save → ProjectState → StorageManager → OPFS (Raw Data) + Dexie (Metadata)
Export → ProjectState → GLTFExporter → File Download
```
