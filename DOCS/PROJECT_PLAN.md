# 3D_rawform — Open-Source Spatial Sketching Application

> A lightweight, high-performance, subscription-free 3D spatial sketching app combining the best ideas from **Mental Canvas Draw** and **Feather 3D**. Designed for stylus and multi-touch on the Microsoft Surface Pro, architected to cross-compile into a native Android APK.

---

## Table of Contents

- [Vision](#vision)
- [Competitive Inspiration](#competitive-inspiration)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Feature Requirements](#feature-requirements)
  - [Core: Spatial Sketching Engine](#1-core-spatial-sketching-engine)
  - [3D Guides & Canvas System](#2-3d-guides--canvas-system)
  - [Pen & Touch Input](#3-pen--touch-input-system)
  - [Camera & Navigation](#4-camera--navigation)
  - [Storytelling & Animation](#5-storytelling--animation)
  - [Editing & Refinement Tools](#6-editing--refinement-tools)
  - [Lighting & Rendering](#7-lighting--rendering-effects)
  - [Import / Export / Storage](#8-import--export--storage)
- [Implementation Strategy](#implementation-strategy)
  - [Stroke Rendering Pipeline](#stroke-rendering-pipeline)
  - [Input System Architecture](#input-system-architecture)
  - [Canvas Projection System](#canvas-projection-system)
  - [Camera Animation System](#camera-animation-system)
  - [Project Storage Architecture](#project-storage-architecture)
  - [Performance Strategy](#performance-strategy)
- [Project Structure](#project-structure)
- [Phased Delivery](#phased-delivery)
- [Verification & Testing](#verification--testing)
- [Open Questions & Decisions](#open-questions--decisions)

---

## Vision

Most 3D sketching tools are locked behind subscriptions, cloud accounts, or heavyweight desktop installs. **3D_rawform** is different:

- **No subscriptions.** All data stays on your device — IndexedDB + local filesystem. No accounts, no cloud locks, no recurring fees.
- **Stylus-native.** Built from the ground up for pen pressure, tilt, and eraser-tip switching on the Surface Pro (and Android styluses like the S-Pen).
- **Touch-navigated.** Draw with the pen, navigate 3D space with your fingers. Palm rejection is automatic.
- **Portable.** One codebase targets both a Surface Pro PWA and a standalone Android APK via Capacitor.
- **Open-source.** No vendor lock-in, no proprietary formats. Standard glTF/OBJ export from day one.

---

## Competitive Inspiration

We draw from the strengths of two leading apps while avoiding their limitations:

### Mental Canvas Draw (Yale Research → Commercial App)
| What they do well | What we borrow |
|---|---|
| **View-centric spatial drawing** — transparent 2D canvases placed in 3D space, focus on creating compelling perspectives rather than full 3D volumes | Our canvas/plane system architecture |
| **Parallel & Hinge Projection** — tools that reposition 2D strokes into 3D while preserving the drawing's appearance from the original view | Our projection tooling for canvas manipulation |
| **Bookmark flythrough animation** — save camera views, sequence them, animate smooth cinematic transitions between them | Our storytelling/tour system |
| **Canvas visibility per-bookmark** — toggle which canvases are visible at each camera position, enabling reveals and scene transitions | Our per-keyframe visibility controls |
| **Angle-dependent stroke opacity** — strokes on canvases angled away from the camera become transparent, maintaining visual clarity | Our depth-aware rendering |

### Feather 3D (iPad)
| What they do well | What we borrow |
|---|---|
| **3D Guides** — customizable surfaces (planes, spheres, cylinders, cones) that act as spatial canvases you draw directly onto | Our guide surface system |
| **Pressure-sensitive 3D brushes** — brushes reimagined for 3D with varied styles and patterns | Our brush engine with pressure/tilt |
| **3D Liquify** — push and pull strokes in 3D space to adjust shapes and proportions after drawing | Our post-draw stroke deformation tools |
| **Live Mirror / Symmetry** — draw symmetrically across multiple axes including Z-axis | Our symmetry system |
| **Sequence tool** — capture and sequence camera shots for presentations | Influences our bookmark/tour system |
| **AR Viewer** — visualize sketches in physical space | Future phase consideration |
| **Post-processing effects** — depth of field, grain, glow, toon shading | Our rendering effects pipeline |

### Where we differentiate
| Gap in existing tools | Our approach |
|---|---|
| Mental Canvas is subscription-based, iPad/Windows only | 100% free, open-source, Surface Pro + Android |
| Feather is iPad-only (web version is limited) | Native-quality PWA on Surface Pro + Android APK via Capacitor |
| Neither offers robust open file formats | `.rawform` JSON + standard glTF/OBJ export |
| Neither is open-source or extensible | MIT-licensed, community-driven |

---

## Architecture & Tech Stack

The core architecture is a **Web-First 3D Hybrid** — a WebGL engine running at 60–120 FPS that packages identically for desktop and mobile.

```
┌─────────────────────────────────────────────────────────────┐
│                    Input Layer                               │
│  W3C Pointer Events: Pen Pressure/Tilt, Multi-touch         │
│  Palm Rejection · Eraser Tip · Simultaneous Pen+Touch       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│               Core Engine — Three.js / WebGL 2               │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ Stroke Engine │ │ Canvas/Guide │ │ Camera & Animation  │  │
│  │               │ │ System       │ │                     │  │
│  │ • MeshLine    │ │ • Flat Planes│ │ • Orbit / Pan       │  │
│  │ • Ribbon Mesh │ │ • Primitives │ │ • SLERP Keyframes   │  │
│  │ • Pressure    │ │ • Projection │ │ • CatmullRom Paths  │  │
│  │ • Smoothing   │ │ • Per-canvas │ │ • Flythrough Tours  │  │
│  │               │ │   Layers     │ │                     │  │
│  └──────────────┘ └──────────────┘ └─────────────────────┘  │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐  │
│  │ Editing Tools │ │ Rendering FX │ │ Storage & Export     │  │
│  │               │ │              │ │                     │  │
│  │ • Liquify     │ │ • Lighting   │ │ • IndexedDB/Dexie  │  │
│  │ • Mirror      │ │ • Shadows    │ │ • .rawform JSON    │  │
│  │ • Selection   │ │ • Depth-fade │ │ • glTF / OBJ       │  │
│  │ • Transform   │ │ • Toon shade │ │ • PNG / MP4        │  │
│  └──────────────┘ └──────────────┘ └─────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
┌─────────▼──────────┐     ┌───────────▼──────────┐
│ Surface Pro Target  │     │ Android Target        │
│ PWA + Service Worker│     │ Capacitor → APK       │
│ Offline-first       │     │ WebView optimized     │
└────────────────────┘     └──────────────────────┘
```

### Core Technologies

| Layer | Technology | Why |
|---|---|---|
| **Graphics** | Three.js + WebGL 2 | Mature, huge ecosystem, custom shader support, WebGPU path available |
| **Stroke Rendering** | THREE.MeshLine + custom ribbon shaders | Variable-width pressure-sensitive strokes that perform well on mobile |
| **Curve Smoothing** | Catmull-Rom splines | Industry-standard interpolation that preserves drawn intent |
| **Pen Input** | W3C Pointer Events API | Unified pen/touch/mouse handling with pressure, tilt, width/height |
| **Touch Gestures** | Custom pointer state machine | Separate pen-draw from touch-navigate, with palm rejection heuristics |
| **Camera Animation** | GSAP + THREE.Quaternion.slerp | Smooth keyframe interpolation without gimbal lock |
| **Build** | Vite + TypeScript | Fast HMR, tree-shaking, type safety |
| **Storage** | IndexedDB via Dexie.js | High-performance local-first binary storage for stroke data |
| **Windows Target** | PWA (Workbox service worker) | Full offline, native-feel, no install friction |
| **Android Target** | Capacitor 6 | Wraps web app into Gradle project → installable APK |

---

## Feature Requirements

### 1. Core: Spatial Sketching Engine

| ID | Requirement | Inspired By | Priority |
|---|---|---|---|
| SK-01 | **Variable-width pressure strokes** — stroke width responds continuously to pen pressure (0.0–1.0 range) with configurable min/max width | Feather 3D | P0 |
| SK-02 | **Pen tilt detection** — use tilt angle to optionally influence stroke shading or width | Feather 3D | P1 |
| SK-03 | **Catmull-Rom curve smoothing** — smooth raw pointer samples into clean curves while preserving drawn intent | Both | P0 |
| SK-04 | **Stable stroke mode** — optional smoothing that produces cleaner, more geometric lines for architectural work | Feather 3D | P1 |
| SK-05 | **Shape tools** — straight lines, circles, ellipses, smooth curves snapped to the active canvas | Feather 3D | P1 |
| SK-06 | **Eraser tool** — stroke-level deletion with visual preview | Both | P0 |
| SK-07 | **Undo/Redo** — stroke-level history stack (minimum 100 operations) | Both | P0 |
| SK-08 | **Brush styles** — at minimum: solid, dashed, dotted, calligraphic (tilt-sensitive), marker | Feather 3D | P1 |
| SK-09 | **Color palette** — HSL color picker with recent-color history and saveable palettes | Both | P0 |

### 2. 3D Guides & Canvas System

| ID | Requirement | Inspired By | Priority |
|---|---|---|---|
| GC-01 | **Flat canvas planes** — infinite transparent 2D planes positioned anywhere in 3D space (XY, XZ, YZ, or arbitrary orientation) | Mental Canvas | P0 |
| GC-02 | **Per-canvas layer stack** — each canvas contains its own layers with opacity, visibility, and lock controls | Mental Canvas | P1 |
| GC-03 | **3D Guide surfaces** — draw onto curved primitive surfaces: sphere, cylinder, cone, torus | Feather 3D | P1 |
| GC-04 | **Custom guide shapes** — stretch, twist, and reshape guide surfaces before drawing onto them | Feather 3D | P2 |
| GC-05 | **Parallel Projection tool** — adjust depth of a canvas (push forward/backward in space) while preserving the drawing's appearance from the original view | Mental Canvas | P1 |
| GC-06 | **Hinge Projection tool** — rotate a canvas around a defined axis to create angled planes (walls, floors) while preserving the original view | Mental Canvas | P1 |
| GC-07 | **Canvas opacity** — per-canvas opacity slider and angle-dependent transparency (canvases angled away from camera become more transparent) | Mental Canvas | P1 |
| GC-08 | **Visual grid overlay** — toggleable grid on each canvas plane for spatial reference | Original | P0 |
| GC-09 | **Bird's Eye View** — minimap/reference window showing a top-down view of all canvases and the camera frustum | Mental Canvas | P2 |

### 3. Pen & Touch Input System

| ID | Requirement | Inspired By | Priority |
|---|---|---|---|
| IN-01 | **Pen-draws, touch-navigates** — strict separation: `pointerType === 'pen'` draws, `pointerType === 'touch'` controls camera | Both | P0 |
| IN-02 | **Automatic palm rejection** — suppress touch events while pen is active; filter by contact area (`event.width/height`) | Both | P0 |
| IN-03 | **Eraser tip switching** — detect pen button / eraser tip for instant eraser toggle | Surface Pro | P0 |
| IN-04 | **Simultaneous pen + touch** — draw with pen while navigating with other hand (two independent pointer streams) | Both | P1 |
| IN-05 | **Multi-touch gestures** — 2-finger orbit, 2-finger pan, pinch-to-zoom with momentum | Both | P0 |

### 4. Camera & Navigation

| ID | Requirement | Inspired By | Priority |
|---|---|---|---|
| CN-01 | **Orbit control** — rotate the scene around a focus point with 2-finger drag | Both | P0 |
| CN-02 | **Pan control** — translate the view with 2-finger parallel drag | Both | P0 |
| CN-03 | **Zoom** — pinch-to-zoom with smooth momentum decay | Both | P0 |
| CN-04 | **Snap-to-axis views** — quick access to front, back, left, right, top, bottom views | Original | P1 |
| CN-05 | **Free navigation** — rotate workspace and draw from any perspective | Feather 3D | P0 |

### 5. Storytelling & Animation

| ID | Requirement | Inspired By | Priority |
|---|---|---|---|
| SA-01 | **Camera bookmarks** — save camera position + orientation + zoom as named keyframes | Mental Canvas | P0 |
| SA-02 | **Per-bookmark canvas visibility** — toggle which canvases are visible at each bookmark, enabling reveals and scene transitions | Mental Canvas | P1 |
| SA-03 | **Flythrough playback** — animate smooth camera path through bookmarks using SLERP quaternion interpolation and CatmullRomCurve3 | Mental Canvas | P0 |
| SA-04 | **Transition timing** — configurable duration and easing per transition between bookmarks | Mental Canvas | P1 |
| SA-05 | **Sequence tool** — capture camera shots and arrange them into a presentation | Feather 3D | P1 |
| SA-06 | **Export as video** — render flythrough to MP4 at configurable resolution (up to 4K) and aspect ratio (16:9, 1:1, 9:16) | Mental Canvas | P2 |

### 6. Editing & Refinement Tools

| ID | Requirement | Inspired By | Priority |
|---|---|---|---|
| ED-01 | **Selection tool** — select individual strokes, groups, or entire canvases for transformation | Feather 3D | P1 |
| ED-02 | **Move / Rotate / Scale** — transform selected strokes or groups with on-canvas gizmo handles | Feather 3D | P1 |
| ED-03 | **3D Liquify** — push and pull strokes in 3D space to adjust shapes, contours, and proportions post-draw | Feather 3D | P2 |
| ED-04 | **Live Mirror / Symmetry** — draw symmetrically across X, Y, and/or Z axes simultaneously | Feather 3D | P2 |
| ED-05 | **Grouping** — group strokes into named objects that can be moved, hidden, or exported as units | Feather 3D | P1 |

### 7. Lighting & Rendering Effects

| ID | Requirement | Inspired By | Priority |
|---|---|---|---|
| LR-01 | **Directional light** — at least one moveable light source with shadow casting | Feather 3D | P2 |
| LR-02 | **Ambient lighting** — configurable ambient light for base illumination | Feather 3D | P2 |
| LR-03 | **Angle-dependent stroke opacity** — strokes on canvases angled away from camera fade to transparent | Mental Canvas | P1 |
| LR-04 | **Post-processing: depth of field** — blur objects at extreme distances for cinematic effect | Feather 3D | P2 |
| LR-05 | **Post-processing: toon shading** — optional cel-shaded / outline rendering mode | Feather 3D | P2 |
| LR-06 | **Background options** — solid color, gradient, or transparent background | Both | P1 |

### 8. Import / Export / Storage

| ID | Requirement | Inspired By | Priority |
|---|---|---|---|
| IO-01 | **Save/load `.rawform` projects** — JSON-based project file containing all strokes, canvases, layers, camera keyframes, and settings | Original | P0 |
| IO-02 | **Auto-save** — debounced auto-save to IndexedDB every 30 seconds or on significant changes | Original | P0 |
| IO-03 | **Export to glTF 2.0** — industry-standard 3D format for Blender, Unity, etc. | Both | P0 |
| IO-04 | **Export to OBJ** — legacy 3D format for broad compatibility | Both | P1 |
| IO-05 | **Export to PNG** — high-resolution screenshot of current view with optional transparency | Both | P0 |
| IO-06 | **Import reference images** — load JPEG/PNG images onto a canvas as drawing references | Both | P1 |
| IO-07 | **Import 3D models** — load OBJ/glTF models as guide surfaces to draw onto | Feather 3D | P2 |
| IO-08 | **Export GIF / MP4** — animated export of camera flythrough | Feather 3D | P2 |
| IO-09 | **Persistent storage request** — use `navigator.storage.persist()` to protect IndexedDB from browser eviction | Original | P0 |

---

## Implementation Strategy

### Stroke Rendering Pipeline

**Problem:** WebGL has no native variable-width line rendering. We need smooth, pressure-sensitive 3D strokes that perform well on mobile.

**Solution:** Hybrid approach using THREE.MeshLine for the initial implementation, with a custom ribbon shader for optimization.

```
Pointer Event (pressure, x, y)
    │
    ▼
Raw Point Buffer (ring buffer, ~100 points)
    │
    ▼
Catmull-Rom Smoothing (configurable tension 0.3–0.7)
    │
    ▼
Width Calculation (pressure × strokeWidthSetting × brushProfile)
    │
    ▼
Ribbon Geometry Generation
    ├── Phase 1: THREE.MeshLine (proven library, fast to implement)
    │   └── Custom width callback maps pressure to line thickness
    └── Phase 2: Custom BufferGeometry ribbon shader (higher performance)
        └── Two triangles per segment, width perpendicular to view direction
    │
    ▼
Three.js Scene → WebGL Render
```

**Key implementation details:**
- **Point sampling:** Pointer events fire at variable rates. We resample to uniform arc-length spacing (every ~2px screen distance) to prevent bunching.
- **Smoothing:** Catmull-Rom interpolation with configurable tension — lower tension for loose sketching, higher for architectural lines.
- **Mesh update strategy:** During active drawing, update only the last few segments of the `BufferGeometry`. Once the stroke is completed, freeze the geometry and mark it as static (`geometry.attributes.position.needsUpdate = false`).
- **Draw call budget:** Target < 100 draw calls per frame. Batch completed strokes on the same canvas into merged geometry periodically.

### Input System Architecture

**Problem:** Need to simultaneously support pen drawing and multi-touch navigation without conflicts, with reliable palm rejection.

**Solution:** A pointer state machine that tracks every active pointer by ID and routes events based on type.

```
                    ┌─────────────────────┐
                    │   Pointer Event      │
                    │   (pointerdown/      │
                    │    pointermove/       │
                    │    pointerup)         │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Check pointerType   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───────┐ ┌─────▼──────┐  ┌──────▼──────┐
     │ pointerType     │ │ pointerType│  │ pointerType │
     │ === 'pen'       │ │ === 'touch'│  │ === 'mouse' │
     └────────┬───────┘ └─────┬──────┘  └──────┬──────┘
              │               │                │
     ┌────────▼───────┐ ┌─────▼──────────────┐ │
     │ DRAW PIPELINE   │ │ PALM REJECTION     │ │
     │                 │ │ FILTER             │ │
     │ • Pressure read │ │                    │ │
     │ • Tilt read     │ │ Is pen active?     │ │
     │ • Eraser check  │ │ ├─ YES → suppress  │ │
     │ • Stroke gen    │ │ │                  │ │
     │                 │ │ Contact area large? │ │
     │                 │ │ ├─ YES → suppress  │ │
     │                 │ │ │                  │ │
     │                 │ │ └─ PASS → GESTURE  │ │
     └─────────────────┘ │    RECOGNIZER      │ │
                         │ • 1-finger: ignore │ │
                         │ • 2-finger: orbit  │ │
                         │ • pinch: zoom      │ │
                         │ • 2-parallel: pan  │ │
                         └────────────────────┘ │
                                                │
                                       ┌────────▼────────┐
                                       │ FALLBACK:       │
                                       │ Mouse as pen    │
                                       │ (desktop dev)   │
                                       └─────────────────┘
```

**Key implementation details:**
- Set `touch-action: none` on the canvas element to prevent browser gesture hijacking.
- Track all active pointers in a `Map<pointerId, PointerState>` for simultaneous handling.
- Palm rejection uses a 3-layer filter: (1) suppress all touch while pen is active, (2) reject contacts with `event.width > threshold`, (3) temporal filter — ignore touches within 100ms of last pen event.
- Do **not** use `setPointerCapture()` broadly — it blocks other simultaneous inputs.

### Canvas Projection System

**Problem:** Need to let users place 2D drawing planes in 3D space and manipulate their positions while preserving how drawings look from the original viewpoint.

**Solution:** Implement Mental Canvas–style parallel and hinge projection as canvas transform operations.

**Parallel Projection:**
1. Store each canvas as a `THREE.Mesh` with a `PlaneGeometry` and transparent material.
2. Moving a canvas along the camera's depth axis: scale the canvas inversely so that from the original camera position, the drawing appears unchanged.
3. Formula: `newScale = originalScale × (newDistance / originalDistance)`

**Hinge Projection:**
1. User defines an axis of rotation by placing two anchor points on the canvas edge.
2. Rotating the canvas around this axis: shear-transform the stroke UVs so that from the original camera position, the drawing appearance is preserved.
3. Uses a `THREE.Object3D` pivot point positioned at the axis, with the canvas as a child.

### Camera Animation System

**Problem:** Need smooth, cinematic flythrough between saved camera bookmarks without gimbal lock.

**Solution:** GSAP-driven quaternion SLERP interpolation along CatmullRomCurve3 paths.

```typescript
// Pseudocode for bookmark-to-bookmark transition
interface CameraBookmark {
  name: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
  canvasVisibility: Map<string, boolean>;  // which canvases visible at this view
  transitionDuration: number;               // seconds to reach this bookmark
  easing: string;                           // GSAP easing function name
}

// Transition logic
function transitionTo(target: CameraBookmark) {
  const startQuat = camera.quaternion.clone();
  const startPos = camera.position.clone();

  gsap.to({ t: 0 }, {
    t: 1,
    duration: target.transitionDuration,
    ease: target.easing,
    onUpdate(self) {
      const t = self.targets()[0].t;
      // Position: lerp or follow CatmullRomCurve3
      camera.position.lerpVectors(startPos, target.position, t);
      // Rotation: SLERP (no gimbal lock)
      THREE.Quaternion.slerp(startQuat, target.quaternion, camera.quaternion, t);
      // FOV: linear interpolate
      camera.fov = THREE.MathUtils.lerp(startFov, target.fov, t);
      camera.updateProjectionMatrix();
    },
    onComplete() {
      // Apply canvas visibility for this bookmark
      applyVisibility(target.canvasVisibility);
    }
  });
}
```

**For multi-bookmark tours:** Chain transitions sequentially, or compute a `CatmullRomCurve3` through all bookmark positions for a single smooth flight path.

### Project Storage Architecture

**Problem:** 3D sketch projects contain large amounts of stroke vertex data that must be saved/loaded quickly without blocking the UI.

**Solution:** IndexedDB via Dexie.js with a granular, append-friendly schema.

```
┌─────────────────────────────────────────────────┐
│                  Dexie.js Schema                 │
│                                                  │
│  projects:    ++id, name, updatedAt              │
│  canvases:    ++id, projectId, name, transform   │
│  layers:      ++id, canvasId, name, order        │
│  strokes:     ++id, layerId, timestamp           │
│  │             (vertex data stored as            │
│  │              raw Float32Array — NOT indexed)   │
│  bookmarks:   ++id, projectId, name, order       │
│  settings:    ++id, projectId                    │
└─────────────────────────────────────────────────┘
```

**Key implementation details:**
- **Never index binary data.** Stroke vertex `Float32Array` data is stored but not indexed — only `id`, `layerId`, and `timestamp` are indexed.
- **Granular records.** Each stroke is its own record. Adding a stroke = one `put()` call, not a full project re-write.
- **Bulk operations.** Use `bulkAdd()` and `bulkPut()` when loading/saving many strokes at once.
- **Debounced auto-save.** Save metadata every 30 seconds; save new strokes immediately on `pointerup`.
- **Storage persistence.** Call `navigator.storage.persist()` on first launch to prevent browser eviction.
- **Export to `.rawform`** serializes the entire Dexie database to a single JSON file (vertex data as base64-encoded `Float32Array` for portability). Import reverses the process.

### Performance Strategy

Targeting **60 FPS minimum** on Surface Pro, **30+ FPS** on mid-range Android devices.

| Concern | Strategy |
|---|---|
| **Draw calls** | Batch completed strokes per-canvas into merged `BufferGeometry`. Target < 100 draw calls/frame. |
| **Active stroke** | Update only the tail of the active stroke geometry — don't rebuild the entire mesh each frame. |
| **Memory** | Aggressively `.dispose()` geometries, materials, textures when canvases are deleted. |
| **Textures** | Keep texture sizes ≤ 2048×2048 for Android compatibility. |
| **Bundle size** | Vite code-splitting — lazy-load export modules, effects, and non-critical UI. |
| **Service worker** | Workbox precaches critical assets (Three.js, shaders, fonts). App works fully offline. |
| **Monitoring** | Include `stats.js` in dev builds. Use Spector.js for WebGL debugging. |
| **Android WebView** | Profile with Android Studio Profiler. Avoid heavy CSS box-shadows that compete for GPU. |

---

## Project Structure

```
3D_rawform/
├── DOCS/
│   └── PROJECT_PLAN.md              # This document
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service worker (Workbox)
│   └── icons/                       # App icons
├── src/
│   ├── main.ts                      # Application entry point
│   ├── App.ts                       # Root app initialization
│   │
│   ├── engine/
│   │   ├── SceneManager.ts          # Three.js scene, camera, lights, render loop
│   │   ├── StrokeRenderer.ts        # MeshLine / ribbon mesh stroke generation
│   │   ├── CurveSmoothing.ts        # Catmull-Rom point interpolation
│   │   ├── SpatialCanvas.ts         # 2D canvas plane in 3D space
│   │   ├── CanvasProjection.ts      # Parallel & hinge projection tools
│   │   ├── GuideSurface.ts          # 3D primitive guides (sphere, cylinder, etc.)
│   │   ├── CameraController.ts      # Orbit, pan, zoom with touch gesture support
│   │   └── CameraAnimator.ts        # GSAP + SLERP bookmark flythrough
│   │
│   ├── input/
│   │   ├── InputManager.ts          # Pointer event routing state machine
│   │   ├── PenHandler.ts            # Pressure, tilt, eraser detection
│   │   ├── TouchHandler.ts          # Multi-touch gesture recognition
│   │   └── PalmRejection.ts         # Contact-area + temporal filtering
│   │
│   ├── tools/
│   │   ├── BrushTool.ts             # Active drawing tool with brush profiles
│   │   ├── EraserTool.ts            # Stroke-level and area eraser
│   │   ├── SelectionTool.ts         # Select / transform strokes and groups
│   │   ├── LiquifyTool.ts           # Push/pull stroke deformation
│   │   ├── MirrorTool.ts            # Multi-axis symmetry drawing
│   │   └── ShapeTool.ts             # Lines, circles, ellipses
│   │
│   ├── state/
│   │   ├── ProjectState.ts          # Central state management
│   │   ├── UndoRedoManager.ts       # Command pattern undo/redo stack
│   │   └── StorageManager.ts        # Dexie.js IndexedDB persistence
│   │
│   ├── ui/
│   │   ├── Toolbar.ts               # Floating touch-friendly tool palette
│   │   ├── ColorPicker.ts           # HSL picker with palette save
│   │   ├── LayerPanel.ts            # Per-canvas layer management
│   │   ├── CanvasPanel.ts           # Canvas/guide list and controls
│   │   ├── BookmarkTimeline.ts      # Keyframe bookmark sequence editor
│   │   ├── BirdsEyeView.ts         # Minimap showing canvas arrangement
│   │   └── ExportDialog.ts          # Export format and settings
│   │
│   ├── export/
│   │   ├── GLTFExporter.ts          # Three.js GLTFExporter wrapper
│   │   ├── OBJExporter.ts           # OBJ format export
│   │   ├── ImageExporter.ts         # PNG screenshot
│   │   └── VideoExporter.ts         # MP4 flythrough recording
│   │
│   ├── shaders/
│   │   ├── ribbon.vert              # Custom ribbon vertex shader
│   │   ├── ribbon.frag              # Custom ribbon fragment shader
│   │   └── depthFade.frag           # Angle-dependent opacity shader
│   │
│   └── types/
│       ├── stroke.ts                # Stroke, BrushProfile, Point types
│       ├── canvas.ts                # Canvas, Layer, Guide types
│       ├── bookmark.ts              # CameraBookmark type
│       └── project.ts               # Top-level project type
│
├── android/                         # Capacitor Android wrapper (Phase 2)
│   └── app/
│
└── .github/
    └── workflows/
        └── build.yml                # CI: lint, type-check, build
```

---

## Phased Delivery

### Phase 1 — Core Engine (MVP)
> Goal: Draw pressure-sensitive strokes on spatial planes, navigate in 3D, save/load projects.

| Component | Deliverables |
|---|---|
| **Stroke Engine** | MeshLine-based pressure strokes, Catmull-Rom smoothing, eraser, undo/redo |
| **Canvas System** | Flat planes (XY, XZ, YZ, custom), visual grid, basic canvas add/remove/transform |
| **Input System** | Pen/touch separation, palm rejection, 2-finger orbit/pan/zoom |
| **Camera** | OrbitControls customized for touch, snap-to-axis views |
| **Storage** | Dexie.js auto-save, `.rawform` save/load, IndexedDB persistence |
| **Export** | glTF export, PNG screenshot |
| **UI** | Floating toolbar, color picker, basic canvas list |

### Phase 2 — Storytelling & Polish
> Goal: Camera bookmarks, flythrough animation, layers, additional tools.

| Component | Deliverables |
|---|---|
| **Bookmarks** | Save/load camera bookmarks, per-bookmark canvas visibility |
| **Flythrough** | GSAP + SLERP animated camera tours, configurable timing |
| **Layers** | Per-canvas layer stack with opacity, visibility, lock |
| **Projection** | Parallel and hinge projection tools for canvas manipulation |
| **Brushes** | Multiple brush styles, shape tools, stable stroke mode |
| **Selection** | Select, move, rotate, scale strokes and groups |
| **Rendering** | Angle-dependent stroke opacity, background options |

### Phase 3 — Advanced Features
> Goal: Feather-inspired editing tools, rendering effects, Android APK.

| Component | Deliverables |
|---|---|
| **3D Guides** | Sphere, cylinder, cone, torus guide surfaces |
| **Liquify** | Push/pull stroke deformation in 3D |
| **Mirror** | Multi-axis live symmetry drawing |
| **Lighting** | Directional + ambient lights, shadow casting |
| **Post-FX** | Depth of field, toon shading |
| **Android** | Capacitor integration, APK build pipeline |
| **Video Export** | MP4 flythrough rendering |
| **Import** | Reference images, 3D model guides |

### Phase 4 — Future Considerations
- AR viewer (WebXR API)
- Collaboration / shared scenes
- Plugin / extension system
- Blender integration workflow
- Custom brush editor

---

## Verification & Testing

### Phase 1 — Surface Pro Acceptance Tests

| Test | Pass Criteria |
|---|---|
| Pen pressure response | Stroke width varies smoothly across full pressure range; min-width at light touch, max at full press |
| Curve smoothing | Rapidly drawn zig-zag produces smooth curves; slow drawing preserves detail |
| Palm rejection | Resting palm on screen while drawing with pen produces zero unintended strokes |
| Multi-touch navigation | 2-finger pinch-zoom, pan, and orbit all function without triggering strokes |
| Simultaneous pen + touch | Drawing with pen while orbiting with other hand works without conflict |
| Canvas creation | Create ≥ 3 canvases at different orientations and draw on each independently |
| Undo/Redo | 50+ consecutive undos and redos work correctly with no data corruption |
| Save/Load | Save a project with 500+ strokes across 5 canvases; close and reload — all data intact |
| Auto-save recovery | Kill the app mid-drawing; reopen — all strokes from last auto-save are preserved |
| glTF export | Exported file loads in Blender 4.x with correct geometry, colors, and relative positioning |
| Performance | Maintain ≥ 60 FPS with 200 strokes visible across 3 canvases on Surface Pro |

### Phase 2 — Storytelling Tests

| Test | Pass Criteria |
|---|---|
| Bookmark save/load | Save 5 bookmarks with different positions, orientations, and canvas visibility states |
| Flythrough playback | Tour through 5 bookmarks plays smoothly with no jitter or sudden jumps |
| Canvas visibility per-bookmark | Canvases correctly show/hide during flythrough transitions |
| Layer controls | Add 5 layers to a canvas; opacity, visibility, lock all function correctly |

### Phase 3 — Android Tests

| Test | Pass Criteria |
|---|---|
| Capacitor build | Debug APK builds without errors from the Capacitor project |
| WebView rendering | Scene renders at ≥ 30 FPS on a mid-range Android device (Pixel 7a or equivalent) |
| Stylus input on Android | S-Pen or generic stylus pressure is detected and rendered correctly |
| Touch gestures on Android | Orbit, pan, zoom gestures work identically to Surface Pro |

---

## Open Questions & Decisions

| # | Question | Impact | Recommendation |
|---|---|---|---|
| 1 | **Stroke rendering:** THREE.MeshLine vs custom ribbon `BufferGeometry` from day one? | Dev speed vs. performance | Start with MeshLine (proven, fast to integrate), migrate to custom shader if perf bottleneck emerges |
| 2 | **Project file format:** JSON with base64 vertex data vs. binary (MessagePack / CBOR)? | File size for complex projects | Start JSON for debuggability; add binary export option later if files exceed ~50MB |
| 3 | **PWA vs. Electron for Windows:** PWA has limited filesystem access; Electron adds ~100MB but gives native file dialogs | Distribution size vs. capability | PWA — use File System Access API for save/open dialogs; avoids Electron bloat |
| 4 | **Layer system in Phase 1 or Phase 2?** | MVP scope | Phase 2 — single implicit layer per canvas is sufficient for MVP |
| 5 | **GSAP licensing:** GSAP is free for open-source but has a custom license. Alternative: anime.js or Tween.js? | Legal / dependency | GSAP free tier covers our use case; evaluate anime.js as lighter alternative |
| 6 | **WebGPU readiness:** Should we plan for a WebGPU renderer path? | Future performance | Design shader abstractions to be renderer-agnostic; add WebGPU path in Phase 4 |
| 7 | **Custom brush editor:** Allow users to create their own brush profiles? | Feature scope, community value | Defer to Phase 4; use preset brush profiles until then |
