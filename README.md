# O-Tiling - Auto-Tiling Extension for GNOME Shell

**O-Tiling** is a free, open-source auto-tiling extension for GNOME Shell. It automatically organizes your open windows into a clean, tiled layout - no manual dragging needed. Works on Fedora, Arch, Ubuntu, and any GNOME-based Linux distro.

> **Supported GNOME versions:** 48+

[![Install on GNOME Extensions](https://img.shields.io/badge/GNOME%20Extensions-Install-4A90D9?logo=gnome&logoColor=white)](https://extensions.gnome.org/extension/9875/o-tiling/)

🔗 **[extensions.gnome.org/extension/9875/o-tiling/](https://extensions.gnome.org/extension/9875/o-tiling/)**

---

## What Is Auto-Tiling?

Auto-tiling means your windows are arranged automatically side by side when you open them. Instead of overlapping windows, each app gets its own space on screen. You can resize, move, and swap windows using only your keyboard.

O-Tiling is a heavily improved fork of [System76 Pop Shell](https://github.com/pop-os/shell), with many new features added on top.

---

## ⚡ Quick Install (One Command)

Open a terminal and run:

```bash
curl -L https://github.com/oliwebd/o-tiling/releases/download/v2.9.12/o-tiling@oliwebd.github.com-v2.9.12.zip \
  -o /tmp/o-tiling.zip \
  && gnome-extensions install --force /tmp/o-tiling.zip \
  && gnome-extensions enable o-tiling@oliwebd.github.com
```

Then **log out and log back in** to activate the extension (required on Wayland).

---

## 📦 Manual Install

1. **Download** the latest zip from the [Releases page](https://github.com/oliwebd/o-tiling/releases/tag/v2.9.12)

2. **Install** it:
   ```bash
   gnome-extensions install --force ~/Downloads/o-tiling@oliwebd.github.com-v2.9.12.zip
   ```

3. **Log out and log back in** (Wayland needs a session restart)

4. **Enable** the extension:
   ```bash
   gnome-extensions enable o-tiling@oliwebd.github.com
   ```

---

## ✨ What's New on Top of Pop Shell

These features do **not** exist in the original Pop Shell:

### 🔵 Aura Focus Border

A smooth animated border highlights your currently focused window. It picks up your GNOME system accent color automatically (Blue, Teal, Green, Red, Purple, etc.) or you can set a custom color. Features include:

- **Border width & radius** - control the thickness (1-10 px) and corner roundness (0-30 px) of the border.
- **Outer glow** - a soft glow effect around the border with adjustable opacity and custom color support.
- **Window tint overlay** - a color tint applied over tiled window backgrounds, with a dedicated master switch.
- **Opacity control** - adjust the background tint opacity smoothly via a horizontal scale slider (0-100%).
- **Custom overlay color** - easily override the tint color separately from the border color.
- **Flexible tint targets** - choose to tint only the focused window or apply it to all tiled windows on the workspace.
- **Flicker-free stability** - enhanced focus detection and guard clauses prevent visual flickering or redundant border updates during rapid window switching and mouse interactions.

### 🖼️ Workspace Switcher Styling (GNOME 48+)

Replaces the default workspace thumbnail bar in the overview with a fully customized version:

- **Auto-scaling thumbnails** - the thumbnail size is calculated automatically based on your screen width and how many workspaces you have open, so they always fit without overflowing.
- **Auto-scroll to active workspace** - the strip scrolls to keep the current workspace in view when you switch.
- **Rescales live** - when you add or remove a workspace, the thumbnails resize instantly.
- **Transparent background** - the thumbnail strip background is fully transparent so it blends with your wallpaper.
- **Accent color border** - the active workspace thumbnail gets a colored border using your GNOME accent color.
- **Rounded corners** - configurable corner radius on each workspace card.

### 🔢 Interactive Panel Workspace Switcher

An optional, highly interactive workspace switcher that replaces the default GNOME panel dots/indicators:

- **Pill-shaped number buttons** - displays a clean, dedicated numbered button for each workspace.
- **One-click navigation** - click any button to switch directly to that workspace.
- **Dynamic active styling** - the button for the active workspace uses a subtle border ring and text matching your GNOME accent color.
- **Overview toggle** - includes a pill-shaped button with a custom symbolic icon to easily toggle the Activities overview.
- **Easy customization** - enable or disable it via the **Workspace Number Indicator** setting under the "Workspace Overview" section in the preferences window.

### 🚫 Skip Overview on Startup

Go straight to your desktop after logging in. No Activities screen in the way.

### 🪟 Transparent Panel

Make the GNOME top panel transparent. Options include:

- **Opacity control** - set any level from fully transparent (0%) to fully opaque (100%)
- **Blur-style backdrop** - adds a subtle dark gradient behind the panel so text stays readable even on bright wallpapers

### 🎨 Theme Consistency

Applies uniform corner styles to GTK apps and Shell elements without needing the User Themes extension. Choose between:

- **Rounded** - consistent rounded corners everywhere
- **Sharp** - flat squared corners everywhere
- Works on GTK 3, GTK 4, and GNOME Shell components at the same time

### 🔀 Layout Presets

One click to rearrange all your windows into a preset layout. Available presets:

- **Columns** - all windows in equal vertical columns side by side
- **Stacked** - all windows stacked in horizontal rows
- **Grid** - balanced 2x2, 2x3, or 3x2 grid depending on how many windows you have (works with 2 to 6 windows)
- **Spiral** - alternating horizontal and vertical splits that spiral inward

### 📌 Lock Master Window

Pin the left (main) window so it never gets split or pushed aside when new windows open. The master window holds at least 35% of the screen width. New windows always tile into the right side.

### 🗂️ Per-Workspace Tiling Toggle

Turn tiling on or off for just the current workspace without affecting other workspaces. Useful when you want one workspace free for floating windows.

### 🪄 Soft Enable / Disable

Turn the entire extension on or off from the panel icon without losing any of your settings. When re-enabled, everything restores exactly as you left it.

### 🪟 Window Button Control

Show or hide the minimize, maximize, and close buttons on title bars independently. The original button layout is restored automatically when the extension is disabled.

---

## ⚙️ Core Tiling Features

Everything below is inherited from Pop Shell and improved:

- **Auto-tiling engine** - Windows are arranged in a binary tree layout, per monitor and per workspace. The layout recalculates every time a window opens, closes, or moves.
- **Stacking / Tabbed mode** - Stack multiple windows into one tile slot, with a tab bar to switch between them.
- **Smart gaps** - Outer gaps disappear automatically when only one window is open (fully functional even when the active hint Aura border is enabled).
- **Multi-monitor support** - Fully supports multiple displays, hot-plugging, and workspaces-only-on-primary mode.
- **Keyboard-first** - Move, resize, swap, and rotate tiles without touching your mouse.

---

## ⌨️ Default Keyboard Shortcuts

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

All shortcuts can be changed in the **Shortcuts** tab inside the extension preferences.

---

## 🖼️ Panel Menu

Click the O-Tiling icon in the top panel to access quick settings:

- **Tile This Workspace** - Enable or disable tiling for just the current workspace
- **Lock Master Window** - Pin the left (main) window so it never gets split
- **Layout Presets** - Instantly switch between Columns, Stacked, Grid, or Spiral layouts
- **Active Hint (Aura)** - Toggle the focus border on or off
- **Gaps** - Adjust the space between windows
- **Border Radius / Width** - Customize the focus border appearance
- **Floating Window Exceptions** - Choose which apps should always float
- **Settings** - Open the full preferences window
- **Enable O-Tiling Extension** - Master on/off switch without losing settings

---

## ⚠️ Known Issues

### Some Windows Are Too Big for the Tile Grid

Some apps (like GNOME System Monitor, Steam, and some games) have a built-in minimum window size. If O-Tiling tries to put them in a space smaller than their minimum, they will **overlap** other windows instead of shrinking.

**How to fix it:**

- **Add to Floating Exceptions** - Open the panel menu -> Floating Window Exceptions -> add the app name (e.g. `gnome-system-monitor`). The tiling engine will leave it alone.
- **Use Adjustment Mode** - Press `Super + Enter` and manually drag the window borders to give the app more room.

> O-Tiling does not force windows to shrink below their minimum size. Doing so causes crashes and infinite resize loops with GNOME's window manager (Mutter). This is a known design boundary shared with the original Pop Shell.

---

## 🔧 Build from Source

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

## 🚀 Creating a Release

Releases are automatically built and published via GitHub Actions when a version tag is pushed.

### Branch Rules
- **Production Releases:** Must be tagged from the `main` or `master` branch.
- **Pre-releases (RC / Beta):** Must be tagged from the `rc` branch.

### How to Release
1. Ensure the version in `package.json` and `metadata.json` matches and is updated.
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

## 🔗 Credits

- **Forked from:** [System76 Pop Shell](https://github.com/pop-os/shell)
- **Inspired by:** [Forge](https://github.com/forge-ext/forge) and [Just Perfection](https://gitlab.gnome.org/jesserivera/just-perfection)
- **License:** GPLv3

---

## 🐛 Bug Reports & Contributions

Found a bug or have an idea? Open an issue or pull request on [GitHub](https://github.com/oliwebd/o-tiling). Feedback is always welcome.

---

*Happy tiling! 🙏*
