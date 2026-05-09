UUID := cpu-util@guitar24t.dev
INSTALL_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
BUILD_DIR := build

# Auto-detect GNOME Shell major version. Falls back to "modern" if shell isn't
# present (e.g. running `make` on a build host).
SHELL_MAJOR := $(shell gnome-shell --version 2>/dev/null | awk '{print $$3}' | cut -d. -f1)
ifeq ($(SHELL_MAJOR),)
  VARIANT := modern
else ifeq ($(shell test "$(SHELL_MAJOR)" -ge 45 && echo yes),yes)
  VARIANT := modern
else
  VARIANT := legacy
endif

MODERN_SOURCES := \
	extension.js \
	prefs.js \
	metadata.json \
	stylesheet.css \
	LICENSE \
	README.md
MODERN_DIRS := lib

LEGACY_SOURCES := \
	legacy/extension.js \
	legacy/prefs.js \
	legacy/metadata.json
LEGACY_DIRS := legacy/lib

SHARED_DIRS := setup
SCHEMA_SRC := schemas/org.gnome.shell.extensions.cpu-util.gschema.xml
SCHEMA_COMPILED := schemas/gschemas.compiled

MODERN_ZIP := $(BUILD_DIR)/$(UUID).shell-extension.zip
LEGACY_ZIP := $(BUILD_DIR)/$(UUID).legacy.shell-extension.zip

.PHONY: all schemas \
	install install-modern install-legacy \
	pack pack-modern pack-legacy \
	uninstall enable disable prefs logs clean which

all: schemas

schemas: $(SCHEMA_COMPILED)

$(SCHEMA_COMPILED): $(SCHEMA_SRC)
	glib-compile-schemas schemas/

# `make install` picks the right variant for the running shell.
install:
	@echo "Detected GNOME Shell major: $(SHELL_MAJOR) -> variant: $(VARIANT)"
	@$(MAKE) install-$(VARIANT)

install-modern: schemas
	@mkdir -p $(INSTALL_DIR)
	cp -r $(MODERN_SOURCES) $(MODERN_DIRS) schemas $(SHARED_DIRS) $(INSTALL_DIR)/
	@echo "Installed (modern) to $(INSTALL_DIR)"
	@echo "Restart GNOME Shell (logout/login on Wayland; Alt+F2 r on X11), then:"
	@echo "  gnome-extensions enable $(UUID)"

install-legacy: schemas
	@mkdir -p $(INSTALL_DIR)/lib/stats
	cp legacy/extension.js legacy/prefs.js legacy/metadata.json $(INSTALL_DIR)/
	cp -r legacy/lib/. $(INSTALL_DIR)/lib/
	cp stylesheet.css LICENSE README.md $(INSTALL_DIR)/
	cp -r schemas $(SHARED_DIRS) $(INSTALL_DIR)/
	@echo "Installed (legacy / GNOME 40-44) to $(INSTALL_DIR)"
	@echo "Restart GNOME Shell, then:"
	@echo "  gnome-extensions enable $(UUID)"

pack: pack-$(VARIANT)

pack-modern: schemas
	@mkdir -p $(BUILD_DIR)
	@rm -f $(MODERN_ZIP)
	zip -r $(MODERN_ZIP) \
		$(MODERN_SOURCES) \
		$(MODERN_DIRS) \
		schemas/*.xml schemas/gschemas.compiled \
		$(SHARED_DIRS)
	@echo "Built $(MODERN_ZIP)"

pack-legacy: schemas
	@mkdir -p $(BUILD_DIR)/legacy-stage/lib
	@rm -rf $(BUILD_DIR)/legacy-stage
	@mkdir -p $(BUILD_DIR)/legacy-stage/lib
	cp legacy/extension.js legacy/prefs.js legacy/metadata.json $(BUILD_DIR)/legacy-stage/
	cp -r legacy/lib/. $(BUILD_DIR)/legacy-stage/lib/
	cp stylesheet.css LICENSE README.md $(BUILD_DIR)/legacy-stage/
	cp -r schemas $(SHARED_DIRS) $(BUILD_DIR)/legacy-stage/
	@rm -f $(LEGACY_ZIP)
	cd $(BUILD_DIR)/legacy-stage && zip -r ../$(notdir $(LEGACY_ZIP)) .
	@echo "Built $(LEGACY_ZIP)"

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

which:
	@echo "Shell major: $(SHELL_MAJOR)"
	@echo "Variant:     $(VARIANT)"

clean:
	rm -rf $(BUILD_DIR) $(SCHEMA_COMPILED)
