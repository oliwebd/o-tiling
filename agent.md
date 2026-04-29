# O-tiling: Agent Documentation

Technical reference for AI agents and contributors working on the **O-tiling** GNOME Shell extension. This document is the authoritative source of truth for the architecture, API compatibility rules, and development conventions of the codebase.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Name | O-tiling |
| Version | 2.1 |
| UUID | `o-tiling@oliwebd.github.com` |
| GSettings Schema | `org.gnome.shell.extensions.o-tiling` |
| D-Bus Interface | `org.gnome.shell.extensions.OTiling` |
| D-Bus Path | `/org/gnome/shell/extensions/OTiling` |
| GNOME Shell Support | **48, 49, 50** (Fedora 42 / 43 / 44) |
| Fork Heritage | System76 `pop-shell` |
| License | GPLv3 |
| Repository | https://github.com/oliwebd/o-tiling |

**Mission:** A distro-agnostic, EGO-compliant auto-tiling engine for modern GNOME Shell. All System76-specific dependencies (`pop-launcher`, `pop-desktop`, system76-specific D-Bus services) have been removed. The extension runs natively on Fedora, Arch, Debian, Ubuntu, and any other GNOME-based distribution.

---

## 2. GNOME Version Compatibility

This is the most critical section. The codebase supports GNOME **48, 49, and 50** by using runtime-detection shims for every API that changed across this range. When adding new code, never call a version-specific API directly — always use the shim or add one.

### 2.1 API Change Map

| API | GNOME 48 | GNOME 49 | GNOME 50 | How the code handles it |
|---|---|---|---|---|
| `Meta.Window.get_maximized()` | ✅ present | ❌ removed | ❌ removed | `utils.is_maximized()` shim: tries `is_maximized()` first, falls back to `maximized_horizontally \|\| maximized_vertically` |
| `Meta.Window.is_maximized()` | ❌ absent | ✅ added | ✅ present | Same shim — detected via `typeof` check |
| `Meta.Window.maximize(flags)` | ✅ takes flags | ❌ flags removed | ❌ flags removed | `utils.maximize()` shim: tries `set_maximize_flags()` + `maximize()` (49+), falls back to `maximize(flags)` (48), last resort `maximize()` |
| `Meta.Window.unmaximize(flags)` | ✅ takes flags | ❌ flags removed | ❌ flags removed | `utils.unmaximize()` shim — same pattern |
| `Meta.Rectangle` | deprecated | ❌ removed | ❌ removed | Replaced entirely with `Mtk.Rectangle` (available GNOME 45+) |
| `Mtk.Rectangle` | ✅ (GNOME 45+) | ✅ | ✅ | Used directly — safe on all targets |
| `Meta.later_add()` | ✅ present | ⚠️ unreliable | ❌ removed | `utils.later_add()` shim: tries `compositor.get_laters().add()` first, then `Meta.later_add()`, then `GLib.idle_add()` as last-resort fallback |
| `backend.get_monitor_manager()` | ✅ (GNOME 40+) | ✅ | ✅ | Used directly with `?.` optional chaining throughout |
| `backend.get_current_logical_monitor()` | ❌ absent | ✅ added | ✅ | All call sites use `?.get_number() ?? 0` — falls back to monitor 0 on GNOME 48 |
| `get_logical_monitors().is_primary` | ✅ (property always existed) | ✅ | ✅ | Accessed via `(m: any).is_primary` — safe on all targets |
| `Main.modalCount` | deprecated | removed | removed | `is_modal_blocking_focus()` helper in `extension.ts` checks `modalActorFocusStack` first, then `_modalCount`, then returns false |
| `get_monitor_neighbor_index()` | ✅ | ✅ | ❌ removed | `shell.ts` wraps it with a full manual adjacency fallback for GNOME 50 |
| `Cogl.SnippetHook.FRAGMENT` | ✅ (GNOME 45+) | ✅ | ✅ | Used with `?.FRAGMENT` guard — rounded corners disabled gracefully if unavailable |
| X11 session | ✅ | disabled by default | ❌ removed | `utils.is_wayland()` gate on all X11-specific signal paths |

### 2.2 The Three Mandatory Shims

Never call the underlying APIs directly. Always use these wrappers.

**`utils.later_add(type, action)`** — deferred callback scheduling:
```typescript
// Correct
utils.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
    // safe to modify actors here
    return GLib.SOURCE_REMOVE;
});

// Wrong — crashes on GNOME 49+ or during early init
Meta.later_add(...)
(global as any).compositor.get_laters().add(...)
```

**`utils.maximize(win.meta)` / `utils.unmaximize(win.meta)`** — window maximize:
```typescript
// Correct
utils.maximize(win.meta);
utils.unmaximize(win.meta);
utils.unmaximize(win.meta, 1);   // horizontal only (Meta.MaximizeFlags.HORIZONTAL)
utils.unmaximize(win.meta, 2);   // vertical only   (Meta.MaximizeFlags.VERTICAL)

// Wrong — crashes GNOME 49+ or misbehaves on GNOME 48
win.meta.maximize(Meta.MaximizeFlags.BOTH);
```

**`utils.is_maximized(win.meta)` / `win.is_maximized()`** — maximize state check:
```typescript
// Correct
win.is_maximized()           // ShellWindow method wrapping utils.is_maximized()
utils.is_maximized(meta)     // direct Meta.Window variant

// Wrong — removed in GNOME 49
meta.get_maximized()
```

### 2.3 Monitor Access Pattern

```typescript
// Standard pattern — safe on GNOME 48/49/50
const mm = (global as any).backend.get_monitor_manager();
if (!mm) return fallback;
const monitors = mm.get_logical_monitors();

// get_current_logical_monitor() is GNOME 49+ only — always use ?.
const idx = (global as any).backend.get_current_logical_monitor()?.get_number() ?? 0;

// Never use — deprecated/removed depending on version
global.display.get_monitor_manager()
(Meta.MonitorManager as any).get_monitor_manager()
```

### 2.4 Global Object Access

TypeScript cannot resolve the `global` object in GNOME Shell. Always cast:

```typescript
(global as any).display.connect(...)       // correct
(global as any).window_group.add_child(b)  // correct
global.display.connect(...)                // wrong — TypeScript error
```

---

## 3. Source Layout

```
src/
  extension.ts          — Main Ext class. enable(), disable(), resume(), suspend()
  auto_tiler.ts         — High-level auto-tiling coordinator
  forest.ts             — Tiling tree world (Forest extends Ecs.World)
  fork.ts               — Fork node: two children + orientation
  node.ts               — NodeKind enum: FORK | WINDOW | STACK
  tiling.ts             — Tiler state machine and drag/resize logic
  stack.ts              — Stack container (tabbed/overlapping windows in one slot)
  window.ts             — ShellWindow: Aura border, restack, actor bindings
  focus.ts              — FocusSelector: directional focus (up/down/left/right)
  movement.ts           — Movement enum and keyboard movement handlers
  ecs.ts                — Entity-Component-System world and storage primitives
  arena.ts              — Arena allocator for Stack objects
  executor.ts           — Event-loop queue (later_add based)
  scheduler.ts          — system76-scheduler D-Bus adapter (graceful fallback)
  settings.ts           — ExtensionSettings wrapper over GSettings
  config.ts             — Config file loader
  keybindings.ts        — Keybinding registration/deregistration
  panel_settings.ts     — Panel indicator (Indicator class)
  prefs.ts              — Libadwaita preferences window
  utils.ts              — Shared utilities: later_add, maximize, unmaximize, is_wayland
  rectangle.ts          — Rectangle class wrapping Mtk geometry
  geom.ts               — Geometric helpers
  lib.ts                — Orientation, SizeHint, cursor helpers
  grab_op.ts            — GrabOp type for drag operations
  events.ts             — ExtEvent / WindowEvent union types
  context.ts            — Context singleton
  error.ts              — Error type
  result.ts             — Result<T, E> type (Ok / Err)
  log.ts                — Internal logger (use instead of console.log)
  tags.ts               — ECS tag definitions (Floating, etc.)
  paths.ts              — get_current_path() utility
  once_cell.ts          — OnceCell lazy-init wrapper
  shell.ts              — monitor_neighbor_index() with GNOME 49/50 fallback
  xprop.ts              — X11 property helpers (Wayland-guarded)
  dbus_service.ts       — D-Bus service export
  shortcut_overlay.ts   — Shortcut overlay widget
  dialog_add_exception.ts — Floating exceptions dialog
  rounded_corners_effect.ts — Shell.GLSLEffect for rounded corners
  rounded_corners.frag  — GLSL fragment shader
  ambient.d.ts          — Ambient type stubs for Shell resource imports
  stubs.d.ts            — Additional GJS stubs
  floating_exceptions/  — Floating exception list UI
  color_dialog/         — Color picker dialog
```

---

## 4. Core Architecture

### 4.1 Entity-Component-System (ECS)

All windows, forks, and stacks are **entities** — plain integer IDs. Data lives in typed **storages** (`Ecs.Storage<T>`). Systems query storages to act on entities. This avoids class inheritance chains and makes state easy to inspect or reset.

- `Ecs.World` — base class for `Forest`. Manages storages and entity lifecycle.
- `Ecs.System<E>` — base class for `Ext`. Manages signal connections and event dispatch.
- `Entity = number` — all entity references are plain integers.

### 4.2 Tiling Engine (Forest → Fork → Node)

The tiling layout is a **binary tree** per display per workspace.

```
Forest (world)
  └─ toplevel: Map<"monitor:workspace", [Entity, [monitor, workspace]]>
       └─ Fork (entity)
            ├─ left:  NodeFork | NodeWindow | NodeStack
            └─ right: NodeFork | NodeWindow | NodeStack
```

- **Fork** (`src/fork.ts`): A branch node with two children and an orientation (horizontal or vertical). Stores the split ratio between children.
- **Node** (`src/node.ts`): Tagged union. `NodeKind.FORK` → child fork entity. `NodeKind.WINDOW` → a window entity. `NodeKind.STACK` → a stack container.
- **Stack** (`src/stack.ts`): Multiple windows sharing one tiled slot, displayed as tabs.
- **Forest** (`src/forest.ts`): The `Ecs.World` that owns all fork entities. Provides attach, detach, and reflow operations.
- **AutoTiler** (`src/auto_tiler.ts`): Coordinates Forest with live window events — decides where new windows attach and handles retiling on unmaximize.

Layouts are **recalculated in full** on every window map, unmap, move, resize, or workspace switch. There is no incremental diffing.

### 4.3 Main Extension Class (Ext)

`Ext` in `src/extension.ts` extends `Ecs.System<ExtEvent>` and is the central coordinator.

**Lifecycle:**
```
enable()
  └─ new Ext()          — empty constructor, no GNOME API calls
  └─ ext.setup()        — GSettings, DBus, signal init (GNOME APIs safe here)
  └─ ext.signals_attach()
  └─ layoutManager.addChrome(overlay)
  └─ panel.addToStatusArea(indicator)

disable()
  └─ layoutManager.removeChrome(overlay)
  └─ ext.destroy()      — disconnects signals, removes borders, clears state
  └─ indicator.destroy()
  └─ scheduler.destroy()
  └─ Window.cleanup_main_loop_sources()
```

**Suspend / Resume (screen lock):**
- `suspend()` cancels all pending timeouts, sets `this.suspended = true`, disables keybindings.
- `resume()` schedules a **600ms deferred** `signals_attach()` to let GNOME Shell settle after unlock. Guards against double execution with `_resume_timeout` and `_resuming` flags.
- `signals_attach()` must be protected with a `_signals_attached: boolean` guard — duplicate calls leak all signal connections and cause double window movement on every keypress.

### 4.4 Event Flow

```
GNOME Shell signal
  └─ Ext.connect(source, signal, handler)
       └─ handler calls this.register(event)
            └─ Executor queue (later_add BEFORE_REDRAW)
                 └─ Ext processes event → updates Forest → repositions windows
```

All window position changes are **deferred** via `utils.later_add()` to avoid modifying actor state during an active render cycle, which crashes Mutter on GNOME 49+.

---

## 5. Key Subsystems

### 5.1 Aura Focus Border (`src/window.ts`)

The Aura effect is an `St.Bin` actor added to `global.window_group` that tracks the focused window's frame rect.

- **Default style:** 2px border, blue glow, 12px border-radius. All customizable.
- **Theming:** CSS loaded from `light.css`, `dark.css`, `highcontrast.css`.
- **Restack:** Each `ShellWindow` owns its own `_restack_id`. Restacking is deferred via `utils.later_add(BEFORE_REDRAW)` and cancelled/re-scheduled on rapid calls. This replaced the old module-level `SCHEDULED_RESTACK` singleton which corrupted stacking order for all but the last focused window per frame.
- **Cleanup:** `Window.cleanup_main_loop_sources()` must be called from `disable()` to cancel any in-flight `ACTIVE_HINT_SHOW_ID` GLib source.

### 5.2 system76-scheduler Adapter (`src/scheduler.ts`)

Attempts to notify `com.system76.Scheduler` of the foreground PID for process scheduling priority. Designed to fail silently and permanently on non-System76 systems.

Three state flags (all reset in `destroy()`):
- `_failed` — service confirmed absent or a call failed. Stop retrying.
- `_checked` — `NameHasOwner` check has been dispatched.
- `_pending` — `NameHasOwner` async call is in-flight. Do not attempt `SetForegroundProcess` yet.

### 5.3 Executor Queue (`src/executor.ts`)

A FIFO queue for window movement operations. Drains one entry per `BEFORE_REDRAW` frame via `utils.later_add()`. Ensures movements are applied in order and only during safe rendering windows.

### 5.4 Floating Exceptions

Windows excluded from auto-tiling by WM class. The `dialog_add_exception.ts` module provides a click-to-select UI. Stored in GSettings and matched on window map.

### 5.5 D-Bus Service (`src/dbus_service.ts`)

Exports `org.gnome.shell.extensions.OTiling` at `/org/gnome/shell/extensions/OTiling`. Provides programmatic control over tiling state and window focus for external tools.

---

## 6. Build System

**Package manager:** `pnpm` (use `pnpm`, not `npm`, for all dependency operations)  
**Bundler:** `esbuild` orchestrated by `build.ts` via `tsx`  
**Type checker:** `tsc --noEmit` (strict mode, `ESNext` target)

### Commands

| Command | Effect |
|---|---|
| `pnpm run build` | Compile TypeScript → `dist/` via `tsc` |
| `pnpm run watch` | Watch mode — rebuild on file change |
| `pnpm run lint` | Run ESLint check |
| `pnpm run deploy` | Run lint + build |
| `pnpm run debug` | Run `scripts/debug.sh` |

### Build Pipeline

1. `build.ts` (run via `tsx`) drives the full pipeline.
2. `esbuild` bundles all `.ts` source into `dist/extension.js` and `dist/prefs.js`.
3. Static assets (`*.css`, `icons/`, `metadata.json`, `schemas/`) are copied to `dist/`.
4. GSchema XML in `schemas/` is compiled to `dist/schemas/gschemas.compiled` via `glib-compile-schemas`.

Install path: `~/.local/share/gnome-shell/extensions/o-tiling@oliwebd.github.com/`

The bundled JS must remain human-readable — no minification. EGO reviewers read the output.

---

## 7. GJS & GObject Rules

| Rule | Correct | Wrong |
|---|---|---|
| GObject instantiation | `new St.BoxLayout({...})` | `St.BoxLayout({...})` |
| Widget children | `box.add_child(label)` | `box.add(label)` |
| Property names | `style_class:` | `styleClass:` |
| Class pattern | `GObject.registerClass` + `constructor()` | legacy `_init()` |
| St orientation | `orientation: Clutter.Orientation.VERTICAL` | `vertical: true` (deprecated GNOME 48, removed GNOME 50) |
| Color validation | `utils.isValidColor(rgba)` | `new Clutter.Color()` or any `gi://Gdk` import |
| Logging | `log.info(...)` from `src/log.ts` | `console.log(...)` or `global.log(...)` |

---

## 8. EGO Reviewer Requirements

- **No minification.** EGO reviewers must read the bundled JS.
- **Include `src/`.** The submission zip must contain TypeScript source.
- **No external binaries.** No shell scripts executed at runtime, no compiled native code.
- **No `gi://Gdk`.** Removed entirely — use `utils.isValidColor()` for color handling.
- **Signal hygiene.** Every `connect()` must have a corresponding `disconnect()` on disable.
- **GSettings schema** path must match `settings-schema` in `metadata.json`.

---

## 9. Common Pitfalls

**Never call `signals_attach()` more than once.** The guard flag `_signals_attached` must be checked at the top. Duplicate calls double every signal handler, causing double window movement, double gap application, and cascading layout bugs.

**Never import `gi://Gdk`.** Unavailable in the extension process — crashes GNOME Shell at load time on all versions.

**Never call `Meta.later_add()` directly.** Use `utils.later_add()` which includes the three-level version fallback.

**Never call `global.display.get_monitor_manager()`.** Use `(global as any).backend.get_monitor_manager()`.

**Never access `ext` after `disable()`.** The module-level `ext` variable is set to `null` in `disable()`. The `resume()` 600ms timeout must guard this window with `if (this.suspended) return GLib.SOURCE_REMOVE`.

**Never add GNOME 49+ APIs without a shim.** If you introduce an API available only on GNOME 49 or 50, detect it with `typeof` or `?.` and provide a GNOME 48 fallback. Add it to the API Change Map in Section 2.1.

---

## 10. Known Issues & Historical Fixes

This section documents critical lifecycle bugs and their fixes to ensure regressions do not occur in future development.

### Bug A — `signals_attach()` and `auto_tile_on()` Leaking AutoTiler
- **Symptom:** Memory leak and conflicting tiling operations.
- **Cause:** Calling `auto_tile_on(false)` from `resume()` would create a new `AutoTiler` instance and overwrite `this.auto_tiler` without destroying the old one or unregistering its storage. This orphaned the previous `AutoTiler` in memory.
- **Fix:** Ensure `this.unregister_storage(this.auto_tiler.attached)` is called in `auto_tile_on()` before `this.auto_tiler.destroy(this)` when replacing an existing tiler. Ensure `signals_attach()` does not duplicate `AutoTiler` creation.

### Bug B — `resume()` Double Execution on GNOME 49+
- **Symptom:** Every window event fires twice, causing double tiling operations that cancel each other out or collide, and indicator toggling issues.
- **Cause:** On GNOME 49, `sessionMode.updated` fires multiple times during unlock. This can cause `resume()` to be invoked again after its 600ms timer completes, leading to `signals_attach()` being called twice.
- **Fix:** The `Ext` class must maintain a `private _signals_attached: boolean = false;` guard. The `signals_attach()` method must immediately return if this is true, and `signals_remove()` must reset it to false. This guarantees that display, workspace, and window signal handlers are never registered twice.

### Bug C — Active Hint Border Ghosting on Suspend/Resume
- **Symptom:** An active hint border from another workspace appears on an empty workspace after system suspend and resume.
- **Cause:** `hide_all_borders()` (called on suspend and workspace switch) failed to clear the global `ACTIVE_HINT_SHOW_ID` timeout. This allowed a delayed `border.show()` to execute *after* the workspace switch. Furthermore, `show_border()` lacked a check to verify if the underlying window actor was actually mapped by Mutter before rendering its border.
- **Fix:** Ensure `Window.cleanup_main_loop_sources()` is explicitly invoked in `hide_all_borders()` (in `src/extension.ts`) to cancel pending render loops. Additionally, the `permitted()` check inside `show_border()` (in `src/window.ts`) must verify that `actor.mapped` is true to prevent drawing borders for unmapped windows on hidden workspaces.

---

*Document Version: 2.1 | Updated: April 2026*
