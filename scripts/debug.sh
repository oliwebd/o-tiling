#!/bin/bash
set -e

# Build the extension
echo "Building extension..."
npm run build

# Install to local extensions folder
UUID="o-tiling@oliwebd.github.com"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
echo "Installing to $EXT_DIR..."
mkdir -p "$EXT_DIR"
cp -rv dist/* "$EXT_DIR/"

# Launch nested shell with debugging
export G_MESSAGES_DEBUG=all
export SHELL_DEBUG=all

# Check GNOME version to decide flags
VERSION=$(gnome-shell --version | awk '{print int($3)}')

echo "Launching nested GNOME Shell (Version $VERSION) for debugging..."

if [ "$VERSION" -ge 49 ]; then
    dbus-run-session gnome-shell --devkit --wayland
else
    dbus-run-session gnome-shell --nested --wayland
fi
