# Active Context — 3D_rawform

## Current Phase
**Phases 1–3 Core Completed** — All functional requirements from PROJECT_PLAN.md are implemented, tested, and running. Preparing for comprehensive UI/UX overhaul (studio-grade creative workspace).

## What's Been Done
- [x] Phase 1 MVP Core Engine: WebGPU, Makio MeshLine strokes, OPFS binary storage via Web Worker, Dexie.js metadata, curve smoothing.
- [x] Phase 2 Storytelling & Polish: GSAP + SLERP flythrough tours, bookmark timeline, per-canvas layers, parallel & hinge projections, selection/transform gizmo, shape tools, GLB/PNG export.
- [x] Phase 3 Advanced Tools: 3D curved guides (sphere, cylinder, cone, torus), live mirror symmetry, 3D liquify stroke deformation, MP4 video export with mediabunny, reference image/model import.
- [x] Dynamic Plane Expansion & Canvas From View (hotkey `C` + Hold C depth slicing preview).
- [x] Bird's Eye View Minimap (`GC-09`): Top-down radar view with camera frustum and interactive navigation.
- [x] Angle-Dependent Stroke Opacity (`LR-03`): Mental Canvas signature edge-on grazing angle fade.
- [x] OBJ Export (`IO-04`): Wavefront .obj export.
- [x] Background Styles (`LR-06`): Dark, studio, light, transparent environments.
- [x] Automated Unit Test Suite: Vitest installed, unit tests covering math, splines, canvas intersection, undo/redo commands.
- [x] Android Capacitor Project: `android/` directory generated and synced.
- [x] Post-Processing Effects: Depth of Field (`LR-04`) & Toon cel-shading (`LR-05`) via WebGPU TSL pipeline.
- [x] Infinite Dot Matrix Ground & Atmospheric Horizon: Replaced boxed grid with airport-runway-style TSL dot field and vertical sky dome horizon gradient.
- [x] Auto-Redrop View Canvas: Eliminated manual `C` key; canvas stays at focal plane and automatically re-drops on camera pivot.
- [x] Smart Spatial Snapping: Screen-space tolerance scaled by distance with nearest-to-observer filtering and Z-depth locking.
- [x] Depth Push/Pull: `Ctrl` + drag or scroll wheel for real-time slicing preview with translucent muting plane and HUD.

## Current Focus
- Rethinking and refining the UI interface, navigation, ergonomics, and display to transform from the engineering draft harness to a studio-grade creative sketching workspace (inspired by Procreate, Mental Canvas, and Feather 3D).

## Immediate Next Steps
1. Consolidate scattered floating panels (CanvasPanel, GuidePanel, LayerPanel, Timeline) into a unified, collapsible tabbed inspector drawer.
2. Build non-dominant hand quick rail for brush size/opacity scrubbers and instant undo/redo thumb buttons.
3. Polish floating dock with high-precision SVG iconography and active glow indicators.
4. Streamline touch & stylus ergonomics for Surface Pro and tablet drawing.
