# O-Tiling - Auto-Tiling Extension for GNOME Shell

<p align="left">
  <a href="https://github.com/oliwebd/o-tiling/releases/latest"><img alt="Latest Release" src="https://img.shields.io/github/v/release/oliwebd/o-tiling?style=flat-square&color=4A90D9&label=release&logo=github&logoColor=white"></a>
  <a href="https://github.com/oliwebd/o-tiling/actions/workflows/release.yml"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/oliwebd/o-tiling/release.yml?style=flat-square&label=build&logo=githubactions&logoColor=white"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white"></a>
  <a href="https://extensions.gnome.org/extension/9875/o-tiling/"><img alt="GNOME Extensions" src="https://img.shields.io/badge/EGO-%239875-4A90D9?style=flat-square&logo=gnome&logoColor=white"></a>
  <a href="https://extensions.gnome.org/extension/9875/o-tiling/"><img alt="GNOME Shell" src="https://img.shields.io/badge/GNOME%20Shell-48%20%7C%2049%20%7C%2050-4A90D9?style=flat-square&logo=gnome&logoColor=white"></a>
  <a href="LICENSE"><img alt="License: GPLv3" src="https://img.shields.io/badge/license-GPLv3-blue?style=flat-square&logo=gnu&logoColor=white"></a>
</p>

Automatically organizes your open windows into a clean, tiled layout. No manual dragging needed. Works on Fedora, Arch, Ubuntu, and any GNOME-based Linux distro.

> Supported GNOME versions: 48+

[![Install on GNOME Extensions](https://img.shields.io/badge/GNOME%20Extensions-Install-4A90D9?logo=gnome&logoColor=white)](https://extensions.gnome.org/extension/9875/o-tiling/)

**[extensions.gnome.org/extension/9875/o-tiling/](https://extensions.gnome.org/extension/9875/o-tiling/)**

---

## What Is Auto-Tiling?

Auto-tiling means your windows are arranged automatically side by side when you open them. Instead of overlapping windows, each app gets its own space on screen. You can resize, move, and swap windows using only your keyboard.

O-Tiling is a fork of [System76 Pop Shell](https://github.com/pop-os/shell), with many new features added on top.

---

## Quick Install (One Command)

Open a terminal and run:

```bash
curl -L https://github.com/oliwebd/o-tiling/releases/download/v2.10.10/o-tiling@oliwebd.github.com-v2.10.10.zip \
  -o /tmp/o-tiling.zip \
  && gnome-extensions install --force /tmp/o-tiling.zip \
  && gnome-extensions enable o-tiling@oliwebd.github.com
```

Then log out and log back in to activate the extension (required on Wayland).

---

## Manual Install

1. Download the latest zip from the [Releases page](https://github.com/oliwebd/o-tiling/releases/latest)

2. Install it:
   ```bash
   gnome-extensions install --force ~/Downloads/o-tiling@oliwebd.github.com-v2.9.20.zip
   ```

3. Log out and log back in (Wayland needs a session restart)

4. Enable the extension:
   ```bash
   gnome-extensions enable o-tiling@oliwebd.github.com
   ```

---

## What's New on Top of Pop Shell

These features don't exist in the original Pop Shell.

### Aura Focus Border

A smooth animated border highlights your currently focused window. It picks up your GNOME system accent color automatically (Blue, Teal, Green, Red, Purple, etc.), or you can set a custom color. Features include:

- Border width and radius: control the thickness (1-10px) and corner roundness (0-30px) of the border.
- Outer glow: a soft glow effect around the border with adjustable opacity and custom color support.
- Window tint overlay: a color tint applied over tiled window backgrounds, with its own enable switch.
- Opacity control: adjust the background tint opacity smoothly with a horizontal scale slider (0-100%).
- Custom overlay color: override the tint color separately from the border color.
- Flexible tint targets: tint only the focused window, or apply it to all tiled windows on the workspace.
- Flicker-free stability: enhanced focus detection and guard clauses prevent visual flickering or redundant border updates during rapid window switching and mouse interactions.

### Workspace Switcher Styling (GNOME 48+)

Replaces the default workspace thumbnail bar in the overview with a fully customized version:

- Auto-scaling thumbnails: the thumbnail size is calculated automatically based on your screen width and how many workspaces you have open, so they always fit without overflowing.
- Auto-scroll to active workspace: the strip scrolls to keep the current workspace in view when you switch.
- Rescales live: when you add or remove a workspace, the thumbnails resize instantly.
- Transparent background: the thumbnail strip background is fully transparent so it blends with your wallpaper.
- Accent color border: the active workspace thumbnail gets a colored border using your GNOME accent color.
- Rounded corners: configurable corner radius on each workspace card.

### Interactive Panel Workspace Switcher

An optional, highly interactive workspace switcher that replaces the default GNOME panel dots and indicators:

- Pill-shaped number buttons: a clean, dedicated numbered button for each workspace.
- One-click navigation: click any button to switch directly to that workspace.
- Dynamic active styling: the button for the active workspace uses a subtle border ring and text matching your GNOME accent color.
- Overview toggle: a pill-shaped button with a custom symbolic icon to easily toggle the Activities overview.
- Easy customization: enable or disable it via the Workspace Number Indicator setting under the "Workspace Overview" section in the preferences window.

### Skip Overview on Startup

Go straight to your desktop after logging in. No Activities screen in the way.

### Transparent Panel

Make the GNOME top panel transparent. Options include:

- Opacity control, from fully transparent (0%) to fully opaque (100%)
- A blur-style backdrop that adds a subtle dark gradient behind the panel so text stays readable even on bright wallpapers

### Theme Consistency

Applies uniform corner styles to GTK apps and Shell elements without needing the User Themes extension. Choose between:

- Rounded, for consistent rounded corners everywhere
- Sharp, for flat squared corners everywhere
- Works on GTK 3, GTK 4, and GNOME Shell components at the same time

### Layout Presets

One click to rearrange all your windows into a preset layout. Available presets:

- Columns: all windows in equal vertical columns side by side
- Stacked: all windows stacked in horizontal rows
- Grid: a balanced 2x2, 2x3, or 3x2 grid depending on how many windows you have (works with 2 to 6 windows)
- Spiral: alternating horizontal and vertical splits that spiral inward

### Per-Workspace Tiling Toggle

Turn tiling on or off for just the current workspace without affecting any other workspace. Useful when you want one workspace free for floating windows (a design or video canvas, say) while the rest stay auto-tiled.

- Toggle from the panel menu: click Tile This Workspace to flip tiling for whichever workspace you're currently on.
- Instant effect: turning it off immediately detaches every currently tiled window on that workspace back to floating; turning it back on re-tiles every tilable window on it right away.
- Persists across restarts: which workspaces are disabled is saved to `disabled-workspaces` in gsettings, so the state survives extension disable/enable, screen lock, and shell restarts.
- Survives workspace reshuffling: if you insert, remove, or reorder workspaces, O-Tiling remaps the disabled set so the toggle stays attached to the correct workspace's content rather than a stale index. Removing a workspace entirely clears its toggle state.
- Reflected in the panel: the panel menu indicator updates live to always show the correct on/off state for the workspace you're viewing.

### Soft Enable / Disable

Turn the entire extension on or off from the panel icon without losing any of your settings. When re-enabled, everything restores exactly as you left it.

### Custom Keybinding Support

Every shortcut, navigation, tiling, window movement, and workspace/monitor moves, is fully rebindable from the Shortcuts tab. No `gsettings` editing required:

- Free-text accelerator entry: type any GNOME-style accelerator directly (for example `<Super>Left`) into the shortcut's field.
- Multiple accelerators per action: assign more than one key combo to the same action by separating them with commas (for example `<Super>h, <Super>Left`). Either one will trigger it.
- Live two-way sync: edits apply immediately to the setting, and the field updates itself if the setting changes elsewhere, such as via `gsettings` or the Reset All Settings button.
- Conflict-safe: rebinding onto a key GNOME already uses is handled by the automatic override and restore system described below, so you're never blocked by a collision.

### Window Button Control

Show or hide the minimize, maximize, and close buttons on title bars independently. The original button layout is restored automatically when the extension is disabled.

### Window and Workspace Animations

Configurable in the Appearance tab of preferences:

- Window animations: choose how windows open, close, move, and resize. Default is native GNOME, Hyprland-style adds a bouncy overshoot like Hyprland/niri, and Glide gives a smooth slide in/out.
- Workspace switch animation: choose how switching workspaces looks. None is default GNOME, Slide moves windows while the wallpaper stays fixed, and Swing adds a Hyprland-style elastic overshoot.

### New Window Placement

Choose where a new window attaches in the tiling tree: next to the Active Window (default) or next to the Largest Window currently on screen.

### Snap to Grid (Floating Mode)

Floating (untiled) windows snap to an invisible grid while you drag or resize them, so manual layouts still line up cleanly.

### Mouse-Driven Options

- Mouse cursor follows active window: automatically warps the pointer to whichever window just gained focus.
- Stack with mouse: drag one window on top of another to create a window stack without touching the keyboard.

### Panel Presence Options

- Hide panel icon: remove the O-Tiling icon and menu from the top panel entirely.
- Show in Quick Settings: once the panel icon is hidden, add an O-Tiling toggle to the GNOME Quick Settings menu instead.

### Show Window Titles

Independently show or hide title bars on tiled windows, separate from the minimize/maximize/close button toggles.

### Top Smart Gap

When the panel is set to fully transparent (0% opacity), an extra configurable gap appears between the panel and the topmost window edge, replacing the normal top outer gap in that state.

### Debug Mode

A one-click switch under Behavior > Miscellaneous Behavior that raises the extension's log level for verbose troubleshooting output. No manual `gsettings` editing needed before checking `journalctl`.

### Reset All Settings

A Danger Zone section at the bottom of the Behavior page restores every O-Tiling setting to its default value in a single click.

---

## Core Tiling Features

Everything below is inherited from Pop Shell and improved:

- Auto-tiling engine: windows are arranged in a binary tree layout, per monitor and per workspace. The layout recalculates every time a window opens, closes, or moves.
- Stacking / tabbed mode: stack multiple windows into one tile slot, with a tab bar to switch between them.
- Smart gaps: outer gaps disappear automatically when only one window is open (fully functional even when the active hint Aura border is enabled).
- Multi-monitor support: fully supports multiple displays, hot-plugging, and workspaces-only-on-primary mode.
- Keyboard-first: move, resize, swap, and rotate tiles without touching your mouse.

---

## Default Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Focus window left / right / up / down | `Super + Alt + Arrows` or `Super + H / J / K / L` |
| Toggle auto-tiling on or off | `Super + T` |
| Toggle floating (free) window | `Super + F` |
| Enter adjustment mode | `Super + Enter` |
| Toggle stacking mode | `Super + S` |
| Move window to upper workspace | `Super + Shift + Up` |
| Move window to lower workspace | `Super + Shift + Down` |
| Move window to left monitor | `Super + Shift + Ctrl + Left` |
| Move window to right monitor | `Super + Shift + Ctrl + Right` |

All shortcuts can be changed in the Shortcuts tab inside the extension preferences.

---

## Keybinding Conflicts: Override and Restore on Disable

Some of O-Tiling's shortcuts (`Super + Up`, `Super + Down`, `Super + Left/Right`, and others) overlap with default GNOME shortcuts. Instead of silently failing to bind, or leaving you with a shortcut that fires two actions at once, O-Tiling temporarily takes over the conflicting accelerator and gives it back automatically.

On enable, before registering one of its own shortcuts, O-Tiling scans every relevant system schema (`org.gnome.desktop.wm.keybindings`, `org.gnome.shell.keybindings`, `org.gnome.mutter.keybindings`, `org.gnome.mutter.wayland.keybindings`) for the same key combination. If it finds a match, it removes that accelerator from the system binding just long enough to register its own, and remembers exactly what it took: schema, key, and accelerator.

On disable, every accelerator O-Tiling borrowed is written straight back to its original system binding. Nothing is merged, guessed, or approximated. It's restored to the exact value it had before.

It's also crash- and logout-safe. The list of currently borrowed accelerators is persisted to the `cleared-system-bindings` setting as it changes, not just on a clean shutdown. If GNOME Shell crashes or the session ends uncleanly before `disable()` runs, O-Tiling detects the leftover entries the next time it starts and restores them right away, so a system shortcut can never end up permanently missing.

Because this runs on every `enable()`/`disable()` cycle, and O-Tiling has no `session-modes` (see below), this same safety net also fires on every screen lock and unlock. Your system shortcuts are never left in a borrowed state while the screen is locked.

> You never need to manually re-assign a GNOME shortcut that O-Tiling temporarily overrides. It's always handed back automatically.

---

## Panel Menu

Click the O-Tiling icon in the top panel to access quick settings:

- Tile This Workspace: enable or disable tiling for just the current workspace
- Layout Presets: instantly switch between Columns, Stacked, Grid, or Spiral layouts
- Active Hint (Aura): toggle the focus border on or off
- Gaps: adjust the space between windows
- Border Radius / Width: customize the focus border appearance
- Floating Window Exceptions: choose which apps should always float
- Settings: open the full preferences window
- Enable O-Tiling Extension: main on/off switch without losing settings

---

## Known Issues

### Some Windows Are Too Big for the Tile Grid

Some apps (GNOME System Monitor, Steam, and some games, for example) have a built-in minimum window size. If O-Tiling tries to put them in a space smaller than their minimum, they will overlap other windows instead of shrinking.

How to fix it:

- Add to Floating Exceptions: open the panel menu, go to Floating Window Exceptions, and add the app name (e.g. `gnome-system-monitor`). The tiling engine will leave it alone.
- Use Adjustment Mode: press `Super + Enter` and manually drag the window borders to give the app more room.

> O-Tiling does not force windows to shrink below their minimum size. Doing so causes crashes and infinite resize loops with GNOME's window manager (Mutter). This is a known design boundary shared with the original Pop Shell.

## Session Mode / Lock-Screen Lifecycle

O-Tiling has no `session-modes` in `metadata.json`, so it uses GNOME's default `"user"` mode. This means GNOME fully disables and re-enables the extension on every lock/unlock (and on suspend, since suspend locks the screen).

- `disable()`: disconnects all signals, destroys the `Ext` instance, removes the indicator/overlay.
- `enable()`: rebuilds everything. A new `Ext` instance, signals reattached, tiling tree reconstructed.

This is the standard, EGO-compliant approach (no special lock-screen permission needed), unlike Pop Shell or Forge, which skip or bypass this teardown to preserve window layout across a lock. The trade-off is that O-Tiling's full rebuild runs on every lock, not just occasional suspends, so debug suspend/focus issues with:

```
journalctl --user -f -o cat | grep -i o-tiling
```

---

## Build from Source

Requirements: Node.js 24, pnpm, `glib-compile-schemas`, `gettext`

```bash
# Install dependencies
pnpm install

# Build
make build

# Package as zip
make pack

# Install locally
make install
```

---

## Creating a Release

Releases are automatically built and published via GitHub Actions when a version tag is pushed.

### Branch Rules
- Production releases must be tagged from the `main` or `master` branch.
- Pre-releases (RC / Beta) must be tagged from the `rc` branch.

### How to Release
1. Make sure the version in `package.json` and `metadata.json` matches and is updated.
2. Commit and push your changes to the appropriate branch (`main`/`master` for production, `rc` for RC/Beta).
3. Create and push a version tag:
   ```bash
   # For a production release (e.g., v2.9.0)
   git tag v2.9.0
   git push origin v2.9.0

   # For a pre-release (e.g., v2.9.0-rc1 or v2.9.0-beta1)
   git tag v2.9.0-beta1
   git push origin v2.9.0-beta1
   ```

---

## Credits

- Forked from: [System76 Pop Shell](https://github.com/pop-os/shell)
- Inspired by: [Forge](https://github.com/forge-ext/forge) and [Just Perfection](https://gitlab.gnome.org/jesserivera/just-perfection)
- License: GPLv3

---

## Bug Reports & Contributions

Found a bug or have an idea? Open an issue or pull request on [GitHub](https://github.com/oliwebd/o-tiling). Feedback is always welcome.

---

Happy tiling.
