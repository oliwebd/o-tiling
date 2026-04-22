# O-tiling: Comprehensive Agent Documentation

This document provides deep technical context for AI agents working on the **O-tiling** GNOME Shell extension. It serves as a technical source of truth for the forked and modernized codebase.

## 1. Project Mission & Identity
- **Goal**: A premium, distro-agnostic auto-tiling experience for GNOME Shell.
- **Fork Heritage**: Forked from System76's `pop-shell`. 
- **De-Popification**: All binary dependencies (`pop-launcher`), System76 D-Bus services, and distro-specific shell scripts have been removed.
- **Support**: GNOME Shell 46 through 50 (ESM architecture).

## 2. Core Architecture

### 2.1 Tiling Engine (Forest & Tree)
The tiling logic is based on a tree structure managed in `src/forest.ts` and `src/tiling.ts`.
- **Nodes**: Each window is a node in a binary tree.
- **Forks**: Branches represent horizontal or vertical splits.
- **Stacks**: Specialized containers for overlapping windows in a single tiled slot.
- **Dynamic Calculation**: Tiling layouts are recalculated on every window mapped/unmapped event, move/resize operation, or workspace switch.

### 2.2 GJS & GNOME Compliance (The "Clean" Refactor)
This project underwent a massive refactor to pass [GNOME Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html).
- **Zero Gdk**: All `gi://Gdk` imports are removed. Colors are handled via `Clutter.Color` (e.g., `new Clutter.Color({ red: 53, green: 132, blue: 228, alpha: 255 })`).
- **Safe Initialization**: The `Ext` class in `src/extension.ts` has an empty constructor. All heavy initialization (GSettings, DBus, Signals) is moved to a `setup()` method called within the `enable()` phase.
- **ESM Modules**: Uses modern `import/export` syntax. No `imports.misc` or legacy global imports.
- **Resource Stubs**: Ambient types in `src/ambient.d.ts` provide stubs for internal Shell modules like `resource:///org/gnome/shell/ui/altTab.js`.

### 2.3 Global Scope Patterns
TypeScript often fails to resolve the magic `global` object in GNOME Shell correctly.
- **Usage**: Always cast to `any` when accessing properties: `(global as any).display.connect(...)`.
- **Avoid**: Direct `global.` access unless the LSP environment is perfectly configured.

## 3. Build & Development System

### 3.1 Pipeline
- **Orchestration**: `build.ts` (run via `tsx`).
- **Bundling**: `esbuild` bundles all `.ts` files into a single `extension.js` and `prefs.js`.
- **Static Assets**: CSS, icons, and metadata are copied directly to `dist/`.
- **GSchema**: Schemas in `schemas/*.xml` are compiled into `dist/schemas/gschemas.compiled`.

### 3.2 Commands
- `npm run build`: Production bundle.
- `npm run watch`: Live development mode.
- `npm run test`: Build and install to `~/.local/share/gnome-shell/extensions/o-tiling@oliwebd.github.com`.
- `npm run lint`: Strict TypeScript type-check (`tsc --noEmit`).

## 4. Branding & Visual System (Aura)

### 4.1 Aura Focus Border
The "Aura" effect is a high-performance selection border implemented in `src/window.ts`.
- **Logic**: A `Clutter.Actor` overlay that follows the focus-window's position and size.
- **Styling**: 2px default width (customizable 1px-10px), custom colors with semi-transparent "Aura" glow, and configurable `border-radius` (default 12px).
- **Theming**: Integrated with GNOME's Dark and High Contrast modes via `dark.css`, `light.css`, and `highcontrast.css`.

### 4.2 Symbolic Icons
- All icons are prefixed with `o-tiling-`.
- Located in `icons/` and bundled into `dist/icons/`.

## 5. D-Bus & Keybindings

### 5.1 D-Bus Interface
- **Namespace**: `org.gnome.shell.extensions.OTiling`
- **Purpose**: Provides programmatic control over tiling states and focus.

### 5.2 GSettings & Keybindings
- **Schema ID**: `org.gnome.shell.extensions.o-tiling`
- **Keybindings**: Managed via XML files in `keybindings/`. Custom shortcuts (H/J/K/L) are mapped to tiling operations rather than standard shell actions.

## 6. Reviewer & Contributor Notes
- **Code Clarity**: Do not minify or obfuscate output. EGO reviewers must be able to read the bundled JS.
- **Source Code**: Always include the `src/` directory in the final submission zip.
- **Logging**: Use the internal `log.ts` logger instead of `console.log` for consistent formatting.

---
*Document Version: 1.1 | Last Updated: April 22, 2026*
