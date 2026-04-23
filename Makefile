UUID    = o-tiling@oliwebd.github.com
INSTALL = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all build install uninstall clean zip setup

# Default target: build the extension
all: build

# Install Node dependencies (run once before building)
setup:
	pnpm install

# Compile TypeScript → JavaScript via esbuild (tsx build.ts)
build:
	pnpm run build

# Type-check only, no output
lint:
	pnpm run lint

# Install built files into GNOME Shell extensions directory
install: build
	mkdir -p $(INSTALL)
	cp -rv dist/* $(INSTALL)

# Remove the extension from GNOME Shell extensions directory
uninstall:
	rm -rf $(INSTALL)

# Remove build artifacts
clean:
	rm -rf dist/

# Package the extension into a zip for extensions.gnome.org submission
zip: build
	cd dist && zip -r ../$(UUID).zip .
	@echo "Created $(UUID).zip"
