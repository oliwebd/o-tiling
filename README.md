# O-tiling: Auto-tiling engine for GNOME Shell

A lightweight, keyboard-driven auto-tiling extension for GNOME Shell. It started as a fork of **System76's pop-shell** but has been heavily refactored so it runs lightly on Fedora, Arch, Ubuntu, or any GNOME distro. On top of the original pop-shell core, a bunch of new features have been added that aren't in upstream.

> **Compatibility:** GNOME Shell **48, 49, and 50** (Fedora 42 / 43 / 44). Earlier versions are not supported.

---

## ⚡ One-liner Install

```bash
curl -L https://github.com/oliwebd/o-tiling/releases/download/v2.8.3/o-tiling@oliwebd.github.com.zip -o /tmp/o-tiling.zip && gnome-extensions install --force /tmp/o-tiling.zip && gnome-extensions enable o-tiling@oliwebd.github.com
```

Then **log out and back in** (Wayland requires a session restart to activate).

---

## 🔧 Manual Installation

1. **Download** `o-tiling@oliwebd.github.com.zip` from the [GitHub Releases page](https://github.com/oliwebd/o-tiling/releases/tag/v2.8.3).

2. **Install** via terminal:
   ```bash
   gnome-extensions install --force ~/Downloads/o-tiling@oliwebd.github.com-v2.8.3.zip
   ```

3. **Restart GNOME Shell** — Log out and log back in (Wayland).

4. **Enable** the extension:
   ```bash
   gnome-extensions enable o-tiling@oliwebd.github.com
   ```

---

## ✨ What's new on top of pop-shell

These features don't exist in the original pop-shell:

- **Aura focus border** — A smooth animated border that follows your focused window and automatically picks up your GNOME system accent color (Blue, Teal, Green, etc.).
- **Skip Overview on startup** — Go straight to the desktop after login, no Activities screen in the way.
- **Transparent panel** — Optional panel transparency with configurable opacity (0–100%) and a subtle blur-style backdrop mode for readability.
- **Theme Consistency** — Applies uniform rounded or sharp corner styles to GTK apps and Shell elements without needing the User Themes extension.
- **Workspace Switcher Styling (GNOME 48+)** — Customizable thumbnail scale, corner radii, and transparent background in the overview.
- **Soft enable/disable from the panel** — Toggle the entire extension on/off from the panel indicator without losing your settings.

---

## ⚙️ Core features (inherited and improved from pop-shell)

- **Auto-tiling engine** — Binary tree layout per monitor per workspace, fully recalculated on every window event.
- **Stacking / tabbed mode** — Stack multiple windows into one tile slot with a tab bar.
- **Smart gaps** — Outer gaps collapse to zero when only one window is tiled.
- **Multi-monitor support** — Full hotplug support, workspaces-only-on-primary, dynamic workspaces.
- **Keyboard-first** — Move, resize, swap, and reorient tiles with `Super+h/j/k/l` or arrow keys.

---

## ⌨️ Default Keybindings

| Action | Shortcut |
|---|---|
| Focus left/right/up/down | `Super+Alt+Arrows` or `Super+h/j/k/l` |
| Toggle auto-tiling | `Super+t` |
| Toggle floating | `Super+f` |
| Enter management mode | `Super+Return` |
| Toggle stacking | `Super+s` |
| Move to upper/lower workspace | `Super+Shift+Up/Down` |
| Move to left/right monitor | `Super+Shift+Ctrl+Left/Right` |

All keybindings are editable in the **Shortcuts** tab of the preferences window.

---

## 🔗 Credits & Links

- **Forked from:** [System76 pop-shell](https://github.com/pop-os/shell).
- **Special Thanks:** This project incorporates code and ideas from the following extensions:
  - [Forge](https://github.com/forge-ext/forge)
  - [Just Perfection](https://gitlab.gnome.org/jesserivera/just-perfection)
- **License:** GPLv3 — Extended with Aura border, skip overview, panel transparency, theme consistency, and more.

---

Happy tiling! Feedback, bug reports, and PRs are welcome on GitHub. 🙏