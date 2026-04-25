#!/bin/bash
set -e

# Build the extension
echo "Building extension..."
pnpm run build

# Install to local extensions folder
UUID="o-tiling@oliwebd.github.com"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
echo "Installing to $EXT_DIR..."
mkdir -p "$EXT_DIR"
cp -rv dist/* "$EXT_DIR/"

# Launch nested shell with debugging (--devkit is standard for 49+)
export G_MESSAGES_DEBUG=all
export SHELL_DEBUG=all

VERSION=$(gnome-shell --version | awk '{print int($3)}')
echo "Launching nested GNOME Shell (Version $VERSION) for debugging..."

dbus-run-session gnome-shell --devkit --wayland
