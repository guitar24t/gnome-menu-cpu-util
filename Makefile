UUID := cpu-util@robhilton.dev
INSTALL_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
BUILD_DIR := build
ZIP := $(BUILD_DIR)/$(UUID).shell-extension.zip

SOURCES := \
	extension.js \
	prefs.js \
	metadata.json \
	stylesheet.css \
	LICENSE \
	README.md

LIB_FILES := $(shell find lib -type f -name '*.js' 2>/dev/null)
SCHEMA_SRC := schemas/org.gnome.shell.extensions.cpu-util.gschema.xml
SCHEMA_COMPILED := schemas/gschemas.compiled

.PHONY: all schemas pack install uninstall clean enable disable prefs logs

all: schemas

schemas: $(SCHEMA_COMPILED)

$(SCHEMA_COMPILED): $(SCHEMA_SRC)
	glib-compile-schemas schemas/

pack: schemas
	@mkdir -p $(BUILD_DIR)
	@rm -f $(ZIP)
	zip -r $(ZIP) \
		$(SOURCES) \
		lib \
		schemas/*.xml schemas/gschemas.compiled \
		setup
	@echo "Built $(ZIP)"

install: schemas
	@mkdir -p $(INSTALL_DIR)
	cp -r $(SOURCES) lib schemas setup $(INSTALL_DIR)/
	@echo "Installed to $(INSTALL_DIR)"
	@echo "Restart GNOME Shell (logout/login on Wayland; Alt+F2 r on X11), then:"
	@echo "  gnome-extensions enable $(UUID)"

uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "Removed $(INSTALL_DIR)"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

prefs:
	gnome-extensions prefs $(UUID)

logs:
	journalctl -f -o cat /usr/bin/gnome-shell

clean:
	rm -rf $(BUILD_DIR) $(SCHEMA_COMPILED)
