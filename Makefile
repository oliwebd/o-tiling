UUID    := o-tiling@oliwebd.github.com
INSTALL := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
DIST    := dist

.PHONY: all setup build lint install uninstall clean zip help

# Default target
all: build

## setup   : Install Node dependencies (run once)
setup:
	pnpm install

## build   : Compile TypeScript → JavaScript via esbuild
build:
	pnpm run build

## lint    : Type-check only, no output
lint:
	pnpm run lint

## install : Install built extension into GNOME Shell extensions directory
install: build
	@test -d $(DIST) || { echo "ERROR: dist/ not found — build may have failed"; exit 1; }
	mkdir -p $(INSTALL)
	cp -rv $(DIST)/* $(INSTALL)

## uninstall : Remove the extension from GNOME Shell extensions directory
uninstall:
	rm -rf "$(INSTALL)"

## clean   : Remove build artifacts
clean:
	rm -rf $(DIST)/

## zip     : Package extension into a zip for extensions.gnome.org submission
zip: build
	@test -d $(DIST) || { echo "ERROR: dist/ not found — build may have failed"; exit 1; }
	zip -r "$(UUID).zip" -j $(DIST)
	@echo "Created '$(UUID).zip'"

## help    : Show this help message
help:
	@grep -E '^##' Makefile | sed 's/^## //'
