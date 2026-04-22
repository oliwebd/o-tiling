# O-tiling: Agent Documentation

This file provides context for AI agents working on the **O-tiling** GNOME Shell extension. It summarizes the project's architecture, compliance work, and build system.

## 1. Project Context
- **Origin**: Forked from System76's `pop-shell`.
- **Identity**: Standalone, distro-agnostic tiling engine for GNOME 46+.
- **Language**: 100% TypeScript.

## 2. Architecture & Compliance

### 2.1 ESM & GJS Guidelines
- **Lifecycle**: The extension uses the GNOME 45+ `Extension` class structure. Initialization logic is in `setup()` called from `enable()`. The constructor (`init`) is empty.
- **Process Segregation**: `gi://Gdk` is strictly forbidden in the shell process. Use `Clutter` or `Meta` equivalents.
- **Type Safety**: Uses `@girs` declarations. Ambient types for internal shell resources are defined in `src/ambient.d.ts`.

### 2.2 Global Scope Handling
Due to TypeScript's strictness with the magic `global` object in GNOME Shell, always cast `global` to `any` when accessing properties (e.g., `(global as any).display`). This avoids index signature errors in the LSP.

## 3. Build System
The project has moved away from the legacy `Makefile` system.
- **Orchestrator**: `build.ts`
- **Runner**: `tsx` (via `npm run build`)
- **Bundler**: `esbuild`
- **Output**: Single, un-minified `extension.js` and `prefs.js` in the `dist/` directory.

### Commands:
- `npm install`: Install dev dependencies.
- `npm run build`: Perform a full production-ready build.
- `npm run watch`: Live rebuild on file changes.
- `npm run lint`: Type-check the codebase.

## 4. Branding & Visuals (Aura)
- **CSS**: Namespaced under `.o-tiling`.
- **Aura**: A 1px focus border managed via `src/window.ts`. The actor overlay supports dynamic color interpolation and 12px rounded corners.

## 5. Submission Checklist (EGO)
When submitting to [extensions.gnome.org](https://extensions.gnome.org/):
1. Run `npm run build`.
2. Zip the **contents** of the `dist/` directory.
3. Include the source code (the `src/` folder) in the zip file for manual verification.

---
*Last Updated: April 22, 2026*
