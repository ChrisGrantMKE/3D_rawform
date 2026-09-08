# Progress — 3D_rawform

## 2026-09-07

### Session 1 — Project Setup & Planning
- Initialized git repository on `main` branch
- Pushed initial commit to `git@github.com:ChrisGrantMKE/3D_rawform.git`
- Created README.md and .gitignore
- Created DOCS/PROJECT_PLAN.md with 40+ requirements
- Created DOCS/VIBE_CODING_TOOLCHAIN.md and AGENTS.md
- Initialized .memory-bank/

### Session 2 — Phase 1 MVP Core Engine
- Initialized Vite + TypeScript strict mode project
- Three.js WebGPURenderer with WebGL2 auto-compilation fallback via TSL
- Makio MeshLine pressure-sensitive stylus stroke rendering
- Catmull-Rom spline interpolation and arc-length resampling (`CurveSmoothing`)
- Flat spatial canvas planes (XY, XZ, YZ, custom) with orientation controls
- Pointer Events state machine with pen/touch separation and palm rejection heuristics
- OPFS binary storage via Web Worker (`StorageWorker`) + Dexie.js metadata store
- Floating toolbar, HSL color picker, and basic canvas list

### Session 3 — Phase 2 Storytelling & Polish
- Camera bookmarks timeline with per-bookmark canvas visibility
- Cinematic flythrough tours with GSAP + SLERP quaternion rotation interpolation
- Per-canvas layer management (visibility, opacity, locking)
- Parallel and hinge projection tools for canvas manipulation
- Selection and spatial transformation gizmo (`SelectionTool`)
- Geometric shape tools (`ShapeTool` — lines, circles, rectangles)
- glTF 2.0 binary (`.glb`) export and PNG screenshot exporter

### Session 4 — Phase 3 Advanced Tools & Media
- 3D curved guide surfaces (`GuideSurface` — sphere, cylinder, cone, torus)
- Live multi-axis mirror symmetry drawing (`MirrorTool`)
- 3D spatial stroke deformation tool (`LiquifyTool`)
- Offline MP4 video flythrough exporter powered by `mediabunny`
- Reference image and 3D glTF model import (`AssetImporter`)
- Touch & mouse navigation fallback (Shift+Left to Pan, Alt/Right drag to Orbit)

### Session 5 — Spatial Canvas Innovations
- Dynamic canvas boundary auto-expansion as strokes extend beyond initial grid
- Mental Canvas-style "Canvas From View" (Hotkey: `C`)
- Interactive "Hold C" plane depth slicing preview with background muting HUD

## 2026-09-08

### Session 6 — Core Requirements Completion & Test Infrastructure
- **Bird's Eye View Minimap (GC-09):** Top-down 2D radar minimap (`BirdsEyeView.ts`) displaying spatial canvas positions, active highlights, and camera FOV frustum cone with interactive navigation.
- **Angle-Dependent Stroke Opacity (LR-03):** Mental Canvas signature rendering effect smoothly fading strokes on canvases viewed edge-on.
- **Wavefront OBJ Export (IO-04):** Implemented `OBJExporterWrapper` for standard 3D CAD/DCC export.
- **Scene Background Styles (LR-06):** Added dark obsidian, dark studio vignette, warm blueprint/light, and transparent alpha background environments.
- **Vitest Unit Test Suite:** Configured Vitest and implemented unit test coverage for `CurveSmoothing`, `SpatialCanvas`, and `UndoRedoManager`.
- **Android Platform Setup:** Generated native Android platform project via `npx cap add android` and synced assets.
- **Depth of Field Post-Processing (LR-04):** WebGPU cinematic bokeh blur using Three.js TSL `DepthOfFieldNode` and depth buffer pass.
- **Toon / Cel-Shading (LR-05):** Cel-shaded outline rendering pass using TSL `toonOutlinePass`.
- **PostProcessPipeline:** Managed in `PostProcessPipeline.ts` and wired into `SceneManager` with UI selector (None, DoF, Toon, All).
