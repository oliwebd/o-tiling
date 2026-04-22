# O-tiling

**O-tiling** is a standalone, performance-optimized, and GNOME-native auto-tiling engine for GNOME Shell (46+). 

Forked from the original System76 `pop-shell`, O-tiling has been completely re-engineered to be **distro-agnostic** and fully compliant with the [extensions.gnome.org (EGO)](https://extensions.gnome.org/) review guidelines. It provides a premium, keyboard-driven window management experience without any external dependencies or proprietary binaries.

![O-tiling Preview](./screenshot.webp)

## Key Enhancements (The "O" in O-tiling)

-   **De-Popified**: Removed all hard dependencies on `pop-launcher`, `pop-desktop`, and System76-specific D-Bus services. It runs natively on Fedora, Arch, Debian, and any other GNOME-based distribution.
-   **Pure TypeScript**: The entire project is written in TypeScript using `@girs` for type safety, and now features a type-safe `build.ts` orchestration script.
-   **GNOME 45+ Compliant**: Fully ESM-based. Strictly follows GJS/GNOME review guidelines (safe initialization, proper cleanup, and Gdk-free shell process).
-   **Aura Focus**: A refined "Active Window" indicator with a 2px blue glow (fully customizable thickness and color) and 12px rounded corners that matches the modern GNOME aesthetic.
-   **Modern Build System**: Powered by `esbuild` and `tsx`. No legacy Makefiles—just clean, readable, and reviewable JavaScript output.

## Features

-   **Auto-Tiling Engine**: Intelligently arranges windows as they are opened using a tree-based layout.
-   **Keyboard-First Navigation**: Move, resize, and swap windows using configurable shortcuts (defaulting to H/J/K/L).
-   **Stacking Support**: Manage windows in tabs/stacks within tiled layouts for maximum organization.
-   **Smart Gaps**: Configurable inner and outer gaps for a breathable and modern desktop layout.
-   **Native Preferences**: A modern, Libadwaita-based settings menu that integrates seamlessly with GNOME Settings.

## Installation

### Prerequisites
-   GNOME Shell 46 through 50 (recommended)
-   `node` (v20+) and `npm`

### Building and Installing
```bash
# Clone the repository
git clone https://github.com/oliwebd/o-tiling.git
cd o-tiling

# Install dependencies
npm install

# Build the extension
npm run build

# Install the extension locally
ln -s $(pwd)/dist ~/.local/share/gnome-shell/extensions/org.gnome.shell.extensions.o-tiling
```
*Note: On Wayland, you must log out and back in to enable the extension for the first time.*

## Configuration

Settings can be accessed via the **Extensions** app or by running:
```bash
gnome-extensions prefs org.gnome.shell.extensions.o-tiling
```

## Development

-   `npm run build`: Bundles the extension into `dist/` using the TypeScript build script.
-   `npm run watch`: Automatically rebuilds on file changes.
-   `npm run lint`: Type-check the codebase.
-   `npm run test`: Build and install the extension to the local GNOME extensions directory.

## License

O-tiling is licensed under the GNU General Public License v3.0 (GPLv3), continuing the legacy of the original project while providing a modernized, upstream-friendly implementation.

---
*Created with ❤️ for the GNOME community.*
