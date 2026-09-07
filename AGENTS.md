# AGENTS.md — 3D_rawform

## Project Overview
3D_rawform is an open-source spatial sketching application built with Three.js/WebGL 2.
It targets Microsoft Surface Pro (PWA) and Android (Capacitor APK).
Users draw with a stylus on 2D canvases placed in 3D space, navigate with touch gestures,
and create flythrough animations between saved camera bookmarks.

Inspired by Mental Canvas Draw (view-centric spatial canvases, bookmark flythroughs) and
Feather 3D (3D guide surfaces, pressure brushes, liquify, live mirror).

## Tech Stack
- **Runtime:** TypeScript (strict mode), Vite
- **3D Engine:** Three.js (WebGL 2), custom ribbon shaders
- **Stroke Rendering:** THREE.MeshLine → custom BufferGeometry ribbon mesh
- **Curve Smoothing:** Catmull-Rom splines
- **Input:** W3C Pointer Events API (pen/touch/mouse separation)
- **Animation:** GSAP + THREE.Quaternion.slerp
- **Storage:** IndexedDB via Dexie.js (local-first, no cloud)
- **Windows:** PWA with Workbox service worker
- **Android:** Capacitor 6 → Gradle → APK
- **Testing:** Vitest for unit tests

## Coding Standards
- Use TypeScript strict mode. No `any` types.
- Use ES modules (import/export). No CommonJS.
- Use `const` by default. Avoid `let` unless mutation is required.
- File naming: PascalCase for classes/components, camelCase for utilities.
- One class per file. Class name must match filename.
- All public methods must have JSDoc comments.
- Maximum function length: 50 lines. Extract helpers if longer.
- Use the Command pattern for undo/redo operations.
- Preserve all existing comments and docstrings unrelated to your changes.

## Architecture Rules
- **engine/** — Pure Three.js logic. No DOM manipulation. No UI concerns.
- **input/** — Pointer event handling only. No rendering logic.
- **tools/** — Tool implementations. Each tool extends a base Tool class.
- **state/** — Central state management. Only StorageManager touches IndexedDB.
- **ui/** — DOM-based UI components. No Three.js imports.
- **export/** — File format serialization. No side effects.
- **shaders/** — GLSL files only.
- **types/** — TypeScript type definitions only. No runtime code.

## Performance Constraints
- Target: 60 FPS on Surface Pro, 30+ FPS on mid-range Android.
- Maximum 100 draw calls per frame.
- Dispose all Three.js resources (geometry, material, texture) on deletion.
- Debounce auto-save to every 30 seconds. Save strokes immediately on pointerup.
- Never index binary data in Dexie.js. Store raw Float32Array/ArrayBuffer.
- Batch completed strokes per-canvas into merged BufferGeometry.

## What NOT to Do
- Do NOT use React, Vue, or any frontend framework. This is vanilla TS + Three.js.
- Do NOT use TailwindCSS. Use vanilla CSS.
- Do NOT use Electron. This is a PWA.
- Do NOT add cloud/network dependencies. This app is 100% offline-capable.
- Do NOT use `setPointerCapture()` broadly — it blocks simultaneous pen+touch inputs.
- Do NOT use `requestAnimationFrame` manually — use the Three.js render loop.
- Do NOT store base64 strings in IndexedDB — use raw Float32Array/ArrayBuffer.
- Do NOT add npm packages without checking bundle size impact first.

## Key References
- Project Plan: `DOCS/PROJECT_PLAN.md`
- Vibe Coding Toolchain: `DOCS/VIBE_CODING_TOOLCHAIN.md`
- Memory Bank: `.memory-bank/`
