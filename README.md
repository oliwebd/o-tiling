# O-tiling

**O-tiling** is a window auto-tiling engine for GNOME Shell 49 and 50, featuring the **Aura** active-window focus indicator same like Cosmic DESKTOP.

Forked from System76's `pop-shell` and completely re-engineered: all hard dependencies on `pop-launcher`, `pop-desktop`, and System76-specific D-Bus services have been removed. O-tiling runs natively on Fedora, Arch, Debian, Ubuntu, and any other GNOME-based distribution without any proprietary binaries or external runtime dependencies.

![O-tiling Preview](./screenshot.webp)

---

## Features

**Auto-tiling engine** — Windows are arranged automatically as they open using a binary tree layout. Every monitor and workspace has its own independent tree. Layouts recalculate fully on every window event.

**Aura focus border** — A refined active-window indicator rendered as an `St.Bin` actor. Color, border width, border radius, overlay opacity, and glow intensity are all configurable live from the panel menu or the preferences window.

**Force rounded corners** — An optional GLSL shader (`Shell.GLSLEffect`) clips every window to rounded corners, including CSD and XWayland windows. Concentric border curves are maintained by computing CSD shadow padding at runtime.

**Keyboard-first navigation** — Move focus and windows with `Super+h/j/k/l` or arrow keys. Swap, resize, and reorient tiles without touching the mouse.

**Stacking / tabbed mode** — Multiple windows can share one tile slot displayed as a tab bar. Tabs inherit the Aura color, respect the active border radius, and stack order is maintained correctly across workspace switches.

**Smart gaps** — When only one window is tiled, outer gaps collapse to zero. Configurable inner and outer gap sizes.

**Floating exceptions** — A click-to-select dialog lets you exclude specific apps or windows from tiling. Rules are stored in `~/.config/o-tiling/config.json` and reloaded live.

**D-Bus service** — Exports `org.gnome.shell.extensions.OTiling` at `/org/gnome/shell/extensions/OTiling` for programmatic focus control and window listing from external tools.

**Libadwaita preferences** — A full preferences window (two pages: General and Shortcuts) that integrates with GNOME Settings. All keybindings are editable in-app.

**Panel indicator** — A status-area button with a live panel menu: toggle tiling, adjust gaps and border settings, pick the Aura color, restart the extension, and more — all without opening the preferences window.

**system76-scheduler adapter** — Notifies `com.system76.Scheduler` of the foreground PID for process priority boosts on System76 hardware. Fails silently and permanently on all other systems.

**Multi-monitor & dynamic workspaces** — Full support for hotplug monitor changes, workspaces-only-on-primary, and GNOME's dynamic workspace model.

**Wayland-first, X11-guarded** — All X11-specific code paths (xprop, decoration hints) are guarded by runtime Wayland detection.

---

## GNOME Shell compatibility

| GNOME Shell | Fedora | Status |
|---|---|---|
| 49 | 43 | ✅ Fully supported |
| 50 | 44 | ✅ Fully supported |

Runtime-detection shims handle every API that changed across this range (`Meta.Window.is_maximized`, `Meta.later_add`, `Mtk.Rectangle`, `get_monitor_neighbor_index`, and more). See `agent.md` for the full API change map.

---

## Installation

### Easy install (one command)

Pick your GNOME Shell version and paste the matching command into a terminal:

**GNOME Shell 50** (Fedora 44)
```bash
curl -L -o /tmp/o-tiling.zip \
  "https://github.com/oliwebd/o-tiling/releases/download/v2.10.0/o-tiling@oliwebd.github.com-gnome50.zip" \
  && gnome-extensions install --force /tmp/o-tiling.zip \
  && rm /tmp/o-tiling.zip
```

**GNOME Shell 49** (Fedora 43)
```bash
curl -L -o /tmp/o-tiling.zip \
  "https://github.com/oliwebd/o-tiling/releases/download/v2.10.0/o-tiling@oliwebd.github.com-gnome49.zip" \
  && gnome-extensions install --force /tmp/o-tiling.zip \
  && rm /tmp/o-tiling.zip
```

Not sure which version you have? Run `gnome-shell --version`.

After installation, **enable** the extension:

```bash
gnome-extensions enable o-tiling@oliwebd.github.com
```

> **Wayland users:** Log out and back in after installing for the first time — `gnome-extensions install` cannot hot-reload a newly installed extension on Wayland.

### Manual install from the Releases page

Download the zip for your GNOME version from the [Releases](../../releases) page, then:

```bash
gnome-extensions install --force o-tiling@oliwebd.github.com-gnome50.zip
gnome-extensions enable o-tiling@oliwebd.github.com
```

### From source

**Prerequisites:** Node.js 20+, `pnpm`, `glib-compile-schemas` (from `glib2-devel` / `libglib2.0-dev`)

```bash
git clone https://github.com/oliwebd/o-tiling.git
cd o-tiling

# Install Node dependencies
pnpm install

# Build and install to ~/.local/share/gnome-shell/extensions/
make install
```

> **Note:** `make install` compiles TypeScript, bundles with esbuild, compiles GSchemas, and copies the result to the local extensions directory in one step.

To uninstall:

```bash
make uninstall
```

To package a zip for [extensions.gnome.org](https://extensions.gnome.org) submission:

```bash
make zip
# → o-tiling@oliwebd.github.com.zip
```

---

## Default keybindings

### Focus

| Action | Default |
|---|---|
| Focus left | `Super+Alt+Left` / `Super+h` |
| Focus right | `Super+Alt+Right` / `Super+l` |
| Focus up | `Super+Alt+Up` / `Super+k` |
| Focus down | `Super+Alt+Down` / `Super+j` |

### Window management

| Action | Default |
|---|---|
| Toggle auto-tiling | `Super+t` |
| Toggle floating | `Super+f` |
| Toggle stacking (global) | `Super+s` |
| Enter management mode | `Super+Return` |
| Toggle tile orientation | `Super+Shift+o` |
| Move to upper workspace | `Super+Shift+Up` / `Super+Shift+k` |
| Move to lower workspace | `Super+Shift+Down` / `Super+Shift+j` |
| Move to left monitor | `Super+Shift+Ctrl+Left` |
| Move to right monitor | `Super+Shift+Ctrl+Right` |

### Inside management mode

| Action | Default |
|---|---|
| Move window | `h` / `j` / `k` / `l` or arrow keys |
| Resize window | `Shift+h/j/k/l` or `Shift+arrows` |
| Swap window | `Ctrl+Super+arrows` |
| Change orientation | `o` |
| Toggle stacking | `s` |
| Accept | `Return` |
| Cancel | `Escape` |

All keybindings are editable in the **Shortcuts** tab of the preferences window (`gnome-extensions prefs o-tiling@oliwebd.github.com`).

---

## Configuration

Open the preferences window:

```bash
gnome-extensions prefs o-tiling@oliwebd.github.com
```

Or click the panel indicator → **Settings**.

Settings are stored in GSettings under `org.gnome.shell.extensions.o-tiling`. The floating exceptions list is stored separately at `~/.config/o-tiling/config.json` and supports per-app and per-window-title rules.

---

## Development

### Build commands

| Command | Effect |
|---|---|
| `pnpm install` | Install Node dependencies (run once) |
| `pnpm run build` | Bundle `src/` → `dist/` via esbuild |
| `pnpm run watch` | Watch mode — rebuild on file change |
| `pnpm run lint` | Type-check only (`tsc --noEmit`) |
| `pnpm run test` | Lint + build + install to local extensions dir |
| `pnpm run debug` | Build, install, then launch a nested GNOME Shell |

### Launch a nested shell for debugging

```bash
pnpm run debug
# Internally runs:
# dbus-run-session gnome-shell --devkit --wayland
```

Logs are printed to the nested shell's journal. Use `journalctl -f` or look in the debug terminal output.

### Architecture overview

The tiling engine is an **Entity-Component-System** (ECS). All windows, forks, and stacks are plain integer entity IDs. Data lives in typed `Ecs.Storage<T>` instances. The layout is a per-display per-workspace binary tree:

```
Forest (ECS world)
  └─ toplevel: Map<"monitor:workspace", [ForkEntity, [monitor, workspace]]>
       └─ Fork — orientation + split ratio
            ├─ left:  Window | Fork | Stack
            └─ right: Window | Fork | Stack
```

Key source files:

| File | Role |
|---|---|
| `src/extension.ts` | Main `Ext` class — lifecycle, signals, event dispatch |
| `src/auto_tiler.ts` | High-level tiling coordinator |
| `src/forest.ts` | Tiling tree world (`Forest extends Ecs.World`) |
| `src/fork.ts` | Fork node — two children + orientation + split ratio |
| `src/window.ts` | `ShellWindow` — Aura border, restack, actor bindings |
| `src/stack.ts` | Stack container — tabbed windows in one tile slot |
| `src/utils.ts` | GNOME version shims (`later_add`, `maximize`, `is_maximized`) |
| `src/shell.ts` | `monitor_neighbor_index` with GNOME 50 fallback |

See `agent.md` for the full technical reference including the API change map, mandatory shims, EGO reviewer requirements, and historical bug fixes.

### notes

- Output JS is **not minified** — easy to read the bundle.
- TypeScript source is included in the submission zip.
- No external binaries or shell scripts are executed at runtime.
- `gi://Gdk` is never imported in the extension process.
- Every `connect()` has a corresponding `disconnect()` on disable.

---

## CI / Releases

GitHub Actions builds and tests the extension against GNOME 49 and 50 on every push. Tagged releases (`v*.*.*`) automatically publish zips for both GNOME versions to the GitHub Releases page.

To cut a release:

```bash
git tag v2.2.0
git push origin v2.2.0
```

---

## License

O-tiling is licensed under the **GNU General Public License v3.0** (GPLv3), continuing the license of the original System76 `pop-shell` project.

---

*Created with ❤️ for the GNOME community.*
