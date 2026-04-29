UUID    := o-tiling@oliwebd.github.com
NAME    := o-tiling
INSTALL := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
DIST    := dist

.PHONY: all setup build lint install uninstall clean zip help pack

# Default target
all: $(DIST)/extension.js

node_modules/.pnpm-lock.yaml: package.json
	pnpm install

$(DIST)/extension.js $(DIST)/prefs.js: node_modules/.pnpm-lock.yaml src/*.ts
	pnpm run build

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

$(UUID).zip: $(DIST)/extension.js $(DIST)/prefs.js schemas/gschemas.compiled
	@cp -r schemas $(DIST)/
	@cp metadata.json $(DIST)/
	@cp *.css $(DIST)/ 2>/dev/null || true
	@cp -r icons $(DIST)/ 2>/dev/null || true
	@cp -r keybindings $(DIST)/ 2>/dev/null || true
	@(cd $(DIST) && zip ../$(UUID).zip -9r .)
	@echo "Created '$(UUID).zip'"

## pack    : Create a zip package for distribution
pack: $(UUID).zip

## build   : Compile TypeScript → JavaScript
build:
	pnpm run build

## lint    : Run ESLint
lint:
	pnpm run lint

## install : Install the extension locally
install: $(UUID).zip
	gnome-extensions install --force $(UUID).zip

## uninstall : Remove the extension
uninstall:
	rm -rf "$(INSTALL)"

## clean   : Remove build artifacts
clean:
	rm -rf $(DIST)/ $(UUID).zip schemas/gschemas.compiled

## help    : Show this help message
help:
	@grep -E '^##' Makefile | sed 's/^## //'
