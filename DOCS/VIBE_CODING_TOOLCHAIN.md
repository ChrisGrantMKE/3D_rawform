# 3D_rawform — Vibe Coding Toolchain & Skill Files

> Resources, skill files, and AI-agent configurations selected from the [awesome-vibe-coding-resources](https://github.com/acvnace/awesome-vibe-coding-resources) ecosystem, tailored for the 3D_rawform spatial sketching project.

---

## Table of Contents

- [Overview](#overview)
- [Selected Resources](#selected-resources)
  - [Tier 1 — Integrate Now](#tier-1--integrate-now-project-foundation)
  - [Tier 2 — Use During Development](#tier-2--use-during-active-development)
  - [Tier 3 — Pre-Deploy & QA](#tier-3--pre-deploy--qa)
- [AGENTS.md Configuration](#agentsmd-configuration)
- [Memory Bank Setup](#memory-bank-setup)
- [Omni Skills Forge — Three.js Skill](#omni-skills-forge--threejs-skill)
- [Tech Stack Integration Map](#tech-stack-integration-map)

---

## Overview

The [awesome-vibe-coding-resources](https://github.com/acvnace/awesome-vibe-coding-resources) repo catalogs tools for AI-assisted ("vibe") coding workflows. After reviewing the full list against our tech stack (Three.js, TypeScript, Vite, Capacitor, Dexie.js), the resources below are directly applicable to accelerating 3D_rawform development.

Our approach:
1. **AGENTS.md** — Create a root-level agent instruction file so every AI session inherits our architecture, coding standards, and project context.
2. **Memory Bank** — Set up a `.memory-bank/` directory to persist architectural decisions, progress, and active context across sessions.
3. **Omni Skills Forge** — Load the Three.js/WebGL skill file to improve AI accuracy when generating shaders, camera controls, and stroke rendering code.
4. **Security scanning** — Run pre-deploy checks before any public-facing build.

---

## Selected Resources

### Tier 1 — Integrate Now (Project Foundation)

| Resource | Source | Why It Matters |
|---|---|---|
| **AGENTS.md** (industry standard) | [Vibeprompt](https://github.com/unclecode/vibeprompt) / [agents.md spec](https://agents.md) | Root-level instruction file that tells AI agents our stack, conventions, and project structure. Every AI tool (Cursor, Claude Code, Copilot, Antigravity) reads this. |
| **Memory Bank System** | [Vibeprompt](https://github.com/unclecode/vibeprompt) | `.memory-bank/` directory with structured markdown files that persist project context, architecture decisions, and progress across AI sessions. Prevents agents from "forgetting" between conversations. |
| **Omni Skills Forge** (Three.js skill) | [theihtisham/omni-skills-forge](https://github.com/theihtisham/omni-skills-forge) | 50,000+ curated AI agent skills. The **Three.js/WebGL skill file** is directly relevant — it teaches agents about shaders, camera math, WebGPU/TSL, and post-processing, which are exactly our pain points. |

### Tier 2 — Use During Active Development

| Resource | Source | Why It Matters |
|---|---|---|
| **Agent Shadow Brain** | [theihtisham/agent-shadow-brain](https://github.com/theihtisham/agent-shadow-brain) | Persistent memory layer (MCP server) that stores project lessons across sessions. Uses TurboQuant vector compression for "infinite memory" within limited RAM. Compatible with Claude Code, Cursor, Cline. |
| **CodeGuide** | [codeguide.dev](https://codeguide.dev) | Generates detailed documentation for AI coding projects. Use to auto-generate our API docs and architecture maps as we build. |
| **Codex First Task Prompt Generator** | Browser-based tool | Converts vague project goals into scoped prompts with constraints and acceptance criteria. Useful for breaking down our phased deliverables into actionable agent tasks. |

### Tier 3 — Pre-Deploy & QA

| Resource | Source | Why It Matters |
|---|---|---|
| **agent-qa** | [awesome-vibe-coding-resources](https://github.com/acvnace/awesome-vibe-coding-resources) | Self-improving QA agent for web apps. Memory-retaining UI regression testing — critical for validating our touch/pen input and canvas interactions. |
| **Check My Vibe** | [checkmyvibe.io](https://checkmyvibe.io) | Free passive scan for AI-built web apps: exposed source maps, security headers, credential leaks, 36-point manual checklist. Run before any public release. |
| **Vibeproof** | [vibeproof.dev](https://vibeproof.dev) | Instant security scanner for AI-built apps. Catches common vulnerabilities from AI-generated code. |

---

## AGENTS.md Configuration

We will create an `AGENTS.md` file at the project root. This is the industry-standard instruction file that AI coding agents read automatically.

### File: `3D_rawform/AGENTS.md`

```markdown
# AGENTS.md — 3D_rawform

## Project Overview
3D_rawform is an open-source spatial sketching application built with Three.js/WebGL 2.
It targets Microsoft Surface Pro (PWA) and Android (Capacitor APK).
Users draw with a stylus on 2D canvases placed in 3D space, navigate with touch gestures,
and create flythrough animations between saved camera bookmarks.

## Tech Stack
- **Runtime:** TypeScript, Vite
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
- Never index binary data in Dexie.js.

## What NOT to Do
- Do NOT use React, Vue, or any frontend framework. This is vanilla TS + Three.js.
- Do NOT use TailwindCSS. Use vanilla CSS.
- Do NOT use Electron. This is a PWA.
- Do NOT add cloud/network dependencies. This app is 100% offline-capable.
- Do NOT use `setPointerCapture()` broadly — it blocks simultaneous inputs.
- Do NOT use `requestAnimationFrame` manually — use Three.js render loop.
- Do NOT store base64 strings in IndexedDB — use raw Float32Array/ArrayBuffer.
```

---

## Memory Bank Setup

Create a `.memory-bank/` directory at the project root with these files:

### File Structure

```
3D_rawform/.memory-bank/
├── product-context.md      # Vision, goals, target users, competitive positioning
├── system-architecture.md  # Tech stack decisions, data flow, component relationships
├── active-context.md       # Current phase, active tasks, immediate next steps
├── progress.md             # Timestamped journal of completed work
└── decisions.md            # Architecture Decision Records (ADRs)
```

### Purpose

| File | Updated When | Contains |
|---|---|---|
| `product-context.md` | Rarely (vision changes) | Why this app exists, who it's for, how it competes with Feather 3D and Mental Canvas |
| `system-architecture.md` | When architecture changes | Component diagram, data flow, key interfaces, dependency choices |
| `active-context.md` | Every session | Current phase, what's being built, blockers, immediate next steps |
| `progress.md` | After completing work | Timestamped entries: what was done, what was tested, what was learned |
| `decisions.md` | When design decisions are made | ADR format: context → decision → consequences for each significant choice |

The Memory Bank ensures that any AI agent (whether Claude, Cursor, Copilot, or Antigravity) can pick up exactly where the last session left off, even across different tools.

---

## Omni Skills Forge — Three.js Skill

The [Omni Skills Forge](https://github.com/theihtisham/omni-skills-forge) Three.js skill file is particularly valuable for our project because AI models commonly struggle with:

- **Custom shaders** (our ribbon vertex/fragment shaders)
- **Camera quaternion math** (our SLERP flythrough system)
- **BufferGeometry manipulation** (our stroke mesh generation)
- **WebGL state management** (draw call batching, resource disposal)
- **Post-processing pipelines** (our depth-fade and toon shading effects)

### Installation

```bash
# Install Omni Skills Forge CLI
npx @theihtisham/omni-skills-forge

# Load the Three.js skill
# (Follow the interactive dashboard to select and install the Three.js/WebGL skill)
```

### What it provides
- Expert-level Three.js patterns for custom shaders, lights, and materials
- WebGPU/TSL migration patterns (future-proofing for Phase 4)
- Post-processing chain setup (EffectComposer, passes)
- Performance optimization patterns specific to Three.js

---

## Tech Stack Integration Map

How each selected resource maps to our technology stack and development phases:

```
┌─────────────────────────────────────────────────────────────────┐
│                     3D_rawform Tech Stack                       │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Three.js     │  │ TypeScript   │  │ Vite + Capacitor       │ │
│  │ WebGL 2      │  │ Strict Mode  │  │ PWA + APK              │ │
│  └──────┬──────┘  └──────┬───────┘  └────────────┬───────────┘ │
│         │                │                        │             │
│         ▼                ▼                        ▼             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Vibe Coding Toolchain Layer                  │   │
│  │                                                          │   │
│  │  AGENTS.md          → Coding standards, arch rules       │   │
│  │  Memory Bank        → Session persistence, ADRs          │   │
│  │  Omni Skills (3JS)  → Shader, camera, geometry guidance  │   │
│  │  Agent Shadow Brain → Cross-session memory (MCP)         │   │
│  │  CodeGuide          → Auto-generated API docs            │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Quality & Security Layer                     │   │
│  │                                                          │   │
│  │  agent-qa           → UI regression testing              │   │
│  │  Check My Vibe      → Security scan + checklist          │   │
│  │  Vibeproof          → AI-code vulnerability scanner      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Phase Mapping

| Phase | Resources Used |
|---|---|
| **Phase 1 — Core Engine** | AGENTS.md, Memory Bank, Omni Skills (Three.js), Agent Shadow Brain |
| **Phase 2 — Storytelling** | Same as Phase 1 + CodeGuide for API documentation |
| **Phase 3 — Advanced + Android** | Same as Phase 2 + agent-qa for regression testing |
| **Pre-Release** | Check My Vibe + Vibeproof security scans |

---

## Next Steps

1. **Create `AGENTS.md`** at the project root (template above)
2. **Create `.memory-bank/`** directory with initial context files
3. **Install Omni Skills Forge** and load the Three.js skill
4. **Optionally install Agent Shadow Brain** as an MCP server for persistent cross-session memory
5. **Bookmark security tools** (Check My Vibe, Vibeproof) for pre-release scanning
