**O-tiling** is a lightweight, keyboard-driven auto-tiling engine for GNOME Shell 48, 49, and 50. It brings an auto-tiling experience to any modern GNOME shell without proprietary dependencies.

![O-tiling Preview](./preview.png)

---

## Features

**Auto-tiling engine** — Windows are arranged automatically as they open using a binary tree layout. Every monitor and workspace has its own independent tree. Layouts recalculate fully on every window event.

**Aura focus border** — A premium active-window indicator with smooth animations. It automatically integrates with your **GNOME System Accent Color**, respecting your desktop theme (Blue, Teal, Green, etc.) out of the box. Features configurable border width, radius, and glow intensity for a high-end feel.

**Theme Consistency** — Programmatically applies uniform corner styles to GTK apps and GNOME Shell elements (panel, session menus, popovers). Choose between **Rounded** (modern aesthetic) or **Sharp GTK** (classic/tiling look for applications while keeping Shell rounded). This creates a cohesive desktop aesthetic that feels native and polished.

**Workspace Switcher Styling (GNOME 50+)** — Advanced customization for the workspace overview. Adjust thumbnail scale (percentage-based), corner radii, and workspace background corner size. Includes a specialized fix for "auto" accent colors and hex values to ensure perfect visual consistency.

**Keyboard-first navigation** — Move focus and windows with `Super+h/j/k/l` or arrow keys. Swap, resize, and reorient tiles without touching the mouse.

**Stacking / tabbed mode** — Multiple windows can share one tile slot displayed as a tab bar. Tabs inherit the Aura color, respect the active border radius, and stack order is maintained correctly across workspace switches.

**Smart gaps** — When only one window is tiled, outer gaps collapse to zero. Configurable inner and outer gap sizes.

**Multi-monitor & dynamic workspaces** — Full support for hotplug monitor changes, workspaces-only-on-primary, and GNOME's dynamic workspace model.

**Wayland-first, X11-guarded** — All X11-specific code paths (xprop, decoration hints) are guarded by runtime Wayland detection.

---

## GNOME Shell compatibility

| GNOME Shell | Fedora | Status |
|---|---|---|
| 48 | 42 | ✅ Fully supported |
| 49 | 43 | ✅ Fully supported |
| 50 | 44 | ✅ Fully supported |

Runtime-detection shims handle every API that changed across this range (`Meta.Window.is_maximized`, `Meta.later_add`, `Mtk.Rectangle`, `get_monitor_neighbor_index`, and more). See `agent.md` for the full API change map.

---

## Installation

The extension UUID is `o-tiling@oliwebd.github.com`.

### 1. Install from GitHub Releases (Recommended)

Download the latest version for your GNOME Shell version from the [**Releases**](../../releases) page.

1.  **Download** the `.zip` file (e.g., `o-tiling@oliwebd.github.com-gnome50.zip`).
2.  **Install** using the terminal:
    ```bash
    gnome-extensions install --force o-tiling@oliwebd.github.com-gnome50.zip
    ```
3.  **Restart GNOME Shell**:
    -   **Wayland**: Log out and log back in.
    -   **X11**: Press `Alt+F2`, type `r`, and hit `Enter`.
4.  **Enable** the extension:
    ```bash
    gnome-extensions enable o-tiling@oliwebd.github.com
    ```

### 2. Quick Install (One-Liner)

Paste the command matching your GNOME version into your terminal:

**GNOME Shell 48/49/50**
```bash
curl -L -o o-tiling.zip $(curl -s https://api.github.com/repos/oliwebd/o-tiling/releases/latest | grep "browser_download_url" | head -n 1 | cut -d '"' -f 4) && gnome-extensions install --force o-tiling.zip && rm o-tiling.zip
```


### 3. Build from Source

**Prerequisites:** Node.js 20+, `pnpm`, and `glib-compile-schemas`.

```bash
git clone https://github.com/oliwebd/o-tiling.git
cd o-tiling
pnpm install
make install
```
*The `make install` command builds the TypeScript source and installs it to your local extension directory.*


To uninstall:

```bash
make uninstall
```

To package a zip for [extensions.gnome.org](https://extensions.gnome.org) submission:

```bash
make pack
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
| `pnpm run build` | Compile TypeScript → `dist/` via `tsc` |
| `pnpm run watch` | Watch mode — rebuild on file change |
| `pnpm run lint` | Run ESLint check |
| `pnpm run type-check` | Run TypeScript type-check only (`tsc --noEmit`) |
| `pnpm run deploy` | Run lint + type-check + build |
| `pnpm run debug` | Build, install, then launch a nested GNOME Shell |
| `pnpm run shexli` | Hot-reload the extension via shexli (creates venv and installs shexli) |

### Launch a nested shell for debugging

```bash
pnpm run debug
# Internally runs:
# dbus-run-session gnome-shell --devkit --wayland
```

Logs are printed to the nested shell's journal. Use `journalctl -f` or look in the debug terminal output.

### Architecture overview

The tiling engine is an **Entity-Component-System** (ECS). All windows, forks, and stacks are plain integer entity IDs. Data lives in typed `Ecs.Storage<T>` instances. The layout is a per-display per-workspace binary tree managed by the `Forest` world.

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
| `src/extension.ts` | Main entry point — extension lifecycle, signal management, and event dispatch |
| `src/engine/auto_tiler.ts` | High-level tiling coordinator — bridges Shell events to Forest operations |
| `src/engine/forest.ts` | Tiling tree world — manages the binary tree of entities |
| `src/engine/fork.ts` | Fork node logic — manages orientation and split ratios |
| `src/window/window.ts` | `ShellWindow` — Aura border rendering, actor bindings, and restacking logic |
| `src/system/window_buttons.ts` | WindowButtonsManager — dynamic control of minimize, maximize, and close buttons |
| `src/system/settings.ts` | ExtensionSettings — unified GSettings wrapper for all extension preferences |
| `src/ui/workspace_switcher_style.ts` | GNOME 50+ workspace overview styling and advanced thumbnail scaling |
| `src/ui/theme_consistency/` | Session-level CSS injection for Rounded/Sharp desktop consistency |
| `src/utils/utils.ts` | GNOME version shims (`later_add`, `maximize`, `is_maximized`, `is_wayland`) |

See `agent.md` for the full technical reference including the API change map, mandatory shims, EGO reviewer requirements, and historical bug fixes.

### notes

- Output JS is **not minified** — easy to read the bundle.
- TypeScript source is included in the submission zip.
- No external binaries or shell scripts are executed at runtime.
- `gi://Gdk` is never imported in the extension process.
- Every `connect()` has a corresponding `disconnect()` on disable.

---

## CI / Releases

GitHub Actions builds the extension and verifies version consistency for GNOME 48, 49, and 50 on every push. Tagged releases (`v*.*.*`) automatically publish zips to the GitHub Releases page.

To cut a release:

```bash
git tag v2.4.8
git push origin v2.4.8
```

---

## Credits

**O-tiling** was originally forked from the [**System76 pop-shell**](https://github.com/pop-os/shell) project. It has been extensively refactored to remove all System76-specific dependencies, providing a seamless auto-tiling experience for all modern GNOME environments, regardless of the distribution.

---

## License

O-tiling is licensed under the **GNU General Public License v3.0** (GPLv3), continuing the license of the original `pop-shell` project.

---

*Created with ❤️ for the GNOME community.*
