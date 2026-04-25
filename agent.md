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
- **Zero Gdk**: All `gi://Gdk` imports are removed.
- **Color Validation**: Uses a custom `isValidColor(rgba: string)` utility in `src/utils.ts` for regex-based validation of hex/RGBA strings, ensuring compatibility without relying on `Clutter.Color` or `Gdk` during settings loading.
- **Safe Initialization**: The `Ext` class in `src/extension.ts` has an empty constructor. All heavy initialization (GSettings, DBus, Signals) is moved to a `setup()` method called within the `enable()` phase.
- **ESM Modules**: Uses modern `import/export` syntax. No `imports.misc` or legacy global imports.
- **Resource Stubs**: Ambient types in `src/ambient.d.ts` provide stubs for internal Shell modules like `resource:///org/gnome/shell/ui/altTab.js`.

### 2.3 Global Scope Patterns
TypeScript often fails to resolve the magic `global` object in GNOME Shell correctly.
- **Usage**: Always cast to `any` when accessing properties: `(global as any).display.connect(...)`.
- **Avoid**: Direct `global.` access unless the LSP environment is perfectly configured.

### 2.4 GNOME 46-50 Compatibility 
The codebase includes specific abstractions and patterns to support the 46-50 version range, where many legacy APIs were removed or modified:
- **Geometry**: The codebase distinguishes between `Rectangular` (a plain interface `{x, y, width, height}`) and the `Rectangle` class. We use `Rectangle.from_meta()` to wrap native geometry objects, providing a unified API across `Meta` and `Mtk` (GNOME 49+).
- **Color Handling**: `Clutter.Color` usage is strictly avoided in settings modules to prevent runtime environment crashes. Utility functions like `set_alpha` and `isValidColor` handle CSS-style string manipulation.
- **Widget Instantiation**: GNOME 46+ requires the `new` keyword for all GObject-derived classes (e.g., `new St.BoxLayout()`). Using them as functions (e.g., `St.BoxLayout()`) will fail.
- **UI Best Practices**: All `St` widgets use `add_child()` instead of the deprecated `add()`. Properties must use snake_case (e.g., `style_class` instead of `styleClass`) to comply with modern GJS standards.
- **Class Patterns**: Components follow the modern GObject-GJS pattern: `GObject.registerClass` with a `constructor()` instead of the legacy `_init()` method.
- **X11 Removal**: The extension detects Wayland via `utils.is_wayland()` and avoids non-functioning X11-specific signals in GNOME 50+ environments.

### 2.5 Window Management & Rendering Stability (GNOME 49+)
Recent stability improvements addressed deep integration issues with modern GNOME window management:
- **Deferred Rendering**: Modifying window effects or actor state directly during a GNOME Shell render cycle triggers critical crashes in Mutter/GNOME 49+. The extension uses deferred updates (`GLib.idle_add` or similar mechanisms) to decouple tiling state calculations from the immediate render pipeline.
- **Stacking Assertion Prevention**: Direct manipulation of stacking can trigger `meta_window_set_stack_position_no_sync` assertions. Restacking and ordering for active windows and their borders are tightly synchronized with Shell life-cycle events to ensure a valid window hierarchy.
- **Sub-window Integration**: Sub-windows (transient dialogs within tiled stacks) correctly inherit the stack order and border states. They are managed explicitly to avoid breaking the expected visual stacking logic.
- **Fast Class Support**: GJS-based class registrations are optimized to leverage GNOME's fast class queries, improving extension startup time and runtime performance.
- **API Migrations**: Removed legacy patterns like `Main.modalCount` in favor of updated GNOME API equivalents to remain compliant and warning-free.

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
*Document Version: 1.2 | Last Updated: April 22, 2026*
