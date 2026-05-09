# CLAUDE.md — handoff notes for the next Claude instance

## What this project is

A GNOME Shell extension that adds a top-bar CPU monitor with Intel-specific telemetry. See `README.md` for the user-facing description and `/Users/roberthilton/.claude/plans/develop-a-gnome-menu-generic-frost.md` (or wherever the plan was synced) for the original design doc — though if there's drift between the plan and the code, **the code is authoritative**.

**Two trees, same UUID.** The repo ships two builds of the same extension:

- **Modern** (root: `extension.js`, `prefs.js`, `lib/`) targets GNOME Shell 45+. ESM imports (`import X from 'gi://X'`), `Extension` class, `ExtensionPreferences` class, libadwaita prefs.
- **Legacy** (`legacy/extension.js`, `legacy/prefs.js`, `legacy/lib/`) targets GNOME Shell 40–44. Legacy imports (`const X = imports.gi.X`), exported `init`/`enable`/`disable` functions, `buildPrefsWidget()` returning a GTK 3 widget tree (`imports.gi.versions.Gtk = '3.0'`).

Both builds share `schemas/`, `stylesheet.css`, and `setup/`. `make install` auto-detects `gnome-shell --version` and installs the right one to `~/.local/share/gnome-shell/extensions/cpu-util@robhilton.dev/`. `make which` shows what would be picked.

**When you change the modern code, the legacy tree does NOT update automatically.** Port the change by hand. The behavior is deliberately identical between the two; the only differences are the import system, the prefs UI toolkit, and the entry-point shape.

## Status when handed off

- **All v1 source files written and syntax-checked.** ~1,200 lines across 18 files.
- **Never executed against a real GNOME Shell.** The previous session was on macOS; only static checks (`node --check`, `glib-compile-schemas --dry-run`) ran. **First runtime test is on this Linux box.** Expect 1–2 fixups.
- **Tasks (TaskList) are all completed.** A fresh task list for the bring-up phase will help.

## First thing to do on this box

Verify it loads at all before touching anything else:

```sh
make install
# Wayland: log out and back in. X11: Alt+F2, type 'r', Enter.
gnome-extensions enable cpu-util@robhilton.dev
# In another terminal:
make logs   # tails journalctl for gnome-shell
```

Then click the panel indicator. Expected: a label like `12%  54°C  2.31GHz` and a popup with usage / temperature / frequency / governor rows, plus an "Intel" section if on Intel hardware.

If the indicator never appears or the shell logs throw, common culprits below.

## Architecture pointers

| File | Role |
|------|------|
| `extension.js` | enable/disable; trivial. |
| `lib/indicator.js` | `PanelMenu.Button` subclass; owns `Poller` + `CpuUtilMenu`. |
| `lib/poller.js` | One `GLib.timeout_add_seconds`; calls every sampler each tick. |
| `lib/intel.js` | Capability detection + shared `readText` / `listDir` / `pathExists`. Runs once at enable. |
| `lib/menu.js` | All popup rows + per-core sparkline (`CoreBars` is a `St.BoxLayout`). |
| `lib/stats/usage.js` | `/proc/stat` delta. Holds previous snapshot. |
| `lib/stats/freq.js` | `scaling_cur_freq` per core + `scaling_governor`. |
| `lib/stats/temp.js` | hwmon walk targeting `coretemp`; caches discovered `temp*_input` paths. |
| `lib/stats/rapl.js` | `/sys/class/powercap/intel-rapl:*/energy_uj` → watts via Δenergy/Δt with wraparound. |
| `lib/stats/pstate.js` | `intel_pstate` driver: turbo, status, min/max %. |
| `lib/stats/hybrid.js` | `classifyCore(cpu, caps)` → `'P' | 'E' | null`. |
| `lib/stats/throttle.js` | `core_throttle_count` deltas. |
| `prefs.js` | `Adw.PreferencesWindow`; bound to GSettings. |
| `schemas/org.gnome.shell.extensions.cpu-util.gschema.xml` | All settings keys. |

The data flow is: `Poller._tick()` builds one `sample` object → `Indicator._onSample(sample)` → updates panel label and calls `CpuUtilMenu.update(sample)`.

## Porting changes between modern and legacy

When you edit a file under the project root, find the parallel file under `legacy/` and apply the equivalent change. The mapping:

| Modern (`./`) | Legacy (`./legacy/`) | What's different |
|---------------|----------------------|------------------|
| `extension.js` | `legacy/extension.js` | Modern: `default class extends Extension`. Legacy: exported `init/enable/disable` functions, `Me = ExtensionUtils.getCurrentExtension()`. |
| `prefs.js` | `legacy/prefs.js` | Modern: `Adw.PreferencesWindow` with `Adw.SwitchRow`/`Adw.SpinRow`/`Adw.ComboRow`. Legacy: GTK 3 (`Gtk.Frame` + `Gtk.Grid` + `Gtk.Switch`/`Gtk.SpinButton`/`Gtk.ComboBoxText`/`Gtk.CheckButton`), exported `buildPrefsWidget()`. |
| `lib/intel.js` | `legacy/lib/intel.js` | Modern: `import { GLib, Gio } from 'gi://...'`. Legacy: `const { GLib, Gio } = imports.gi`. Both expose `readText/pathExists/listDir/detectCapabilities` as functions. |
| `lib/poller.js`, `lib/menu.js`, `lib/indicator.js` | Same names under `legacy/lib/` | Imports differ (Modern uses `gi://` and `resource:///org/gnome/shell/...`; Legacy uses `imports.gi.X`, `imports.ui.popupMenu`, `imports.ui.panelMenu`). Class export differs: modern uses `export class X = GObject.registerClass(...)`, legacy assigns to top-level `var X` so `Me.imports.lib.X.X` is reachable. |
| `lib/stats/*.js` | `legacy/lib/stats/*.js` | Same — import syntax differs, behavior identical. |

Things that are NOT different: the GSettings schema, `stylesheet.css`, the `setup/` scripts, and the data flow (`Poller._tick` → `Indicator._onSample` → `CpuUtilMenu.update`).

If you find yourself diverging the two builds in semantics, push back — that's likely a bug, not a feature. The split exists only because the load-time module system is different.

## Gotchas already encountered (don't re-litigate)

1. **GJS doesn't expose `GLib.Dir.open` reliably.** Directory enumeration uses `Gio.File.enumerate_children` in `lib/intel.js#listDir`. Don't switch back.
2. **GNOME 45+ uses ESM imports only** — `imports.gi.X` is dead. All `gi://X` and `resource:///…` imports go at the top of the file.
3. **`scaling_cur_freq` under `intel_pstate active` is the requested freq, not measured.** Accurate measurement needs APERF/MPERF MSRs which need root. Documented in README — don't add fake "precision".
4. **RAPL is root-only by default.** The user must run `sudo setup/install-rapl-access.sh` once and log out/in. Until then, `lib/stats/rapl.js` returns `null` and the menu shows `"N/A — run setup/install-rapl-access.sh"`. Do not try to `pkexec` from inside the extension.
5. **Libsensors was decided against.** GJS has no native bindings; subprocess-per-tick is unacceptable. We walk hwmon directly the same way libsensors does. `lm-sensors` is a *user-side prerequisite* so the `coretemp` driver gets loaded.

## Likely first fixups (educated guesses)

I haven't run this on Linux, so things to check first if there are issues:

- `PopupMenu.PopupBaseMenuItem` constructor signature: `lib/menu.js` calls `super({ reactive: false, can_focus: false })`. Should be correct on 45+ but if it complains, try positional args.
- `Adw.SwitchRow` and `Adw.SpinRow` are GNOME 44+ widgets — fine on 45+, but on 45.0 specifically there were some property quirks. If `prefs.js` errors out, fall back to `Adw.ActionRow` + a `Gtk.Switch`.
- Popup menu item visibility should be set directly on the item with `.visible`. On some Shell versions, `PopupMenuItem` doesn't expose `.actor` because it is the actor.
- `metadata.json` has `"shell-version": ["45","46","47","48"]`. If the user is on 49+ this'll need bumping.

## Verification (full)

The plan's verification section is reproduced in `README.md` Architecture section conceptually, but the full checklist is:

1. `make install` → restart shell → `gnome-extensions enable cpu-util@robhilton.dev`. Indicator visible.
2. Open menu — usage, temp, freq, governor rows render with non-zero values.
3. `stress-ng --cpu $(nproc) --timeout 30s` — usage climbs to ~100%, temp rises, per-core bars fill. Cross-check % against `htop`.
4. `sudo cpupower frequency-set -g powersave` then `-g performance` — governor row updates within one tick.
5. `echo 1 | sudo tee /sys/devices/system/cpu/intel_pstate/no_turbo` — Turbo row shows "off", max freq drops. Reset with `echo 0`.
6. RAPL: on a fresh machine, confirm "N/A" message; run setup script; log out/in; confirm package wattage populates.
7. Hybrid CPU (Alder Lake+): per-core bars should color P-cores blue, E-cores green (see `stylesheet.css`).
8. Non-Intel: Intel section is hidden; usage/temp/freq still work.
9. `make logs` should be silent during normal operation.
10. `make prefs` opens preferences; toggle each setting and confirm the panel updates without restart.

## How to make changes

- Edit source. Run `make install` (this overwrites the installed copy). Restart GNOME Shell.
- For schema changes: `make schemas` first, then re-install.
- For pref-only changes (no GSettings schema bumps): `make install` is enough; preferences window picks up changes on next open.

## What's intentionally not built

- Per-process CPU breakdown (would need `/proc/[pid]/stat` walking).
- GPU / iGPU metrics (Intel `i915` hwmon — v2).
- AMD-specific extras beyond temperature.
- Translations beyond English scaffolding (`po/` exists but is empty).
- Publishing to extensions.gnome.org (do this after real-hardware testing).

## Project conventions

- Two-space indent in JS, four-space in shell scripts (matches existing files).
- No comments unless the *why* is non-obvious. Don't comment what well-named identifiers already say.
- Each `lib/stats/*.js` module is a pure data source: it can be `import`ed and its `sample()` (or class) called without any Shell context. This is intentional — keeps the modules unit-testable later.
- Settings keys are kebab-case in the schema, matching GNOME convention.

## Useful commands

```sh
make install     # build + install to ~/.local/share/gnome-shell/extensions/
make uninstall   # remove
make pack        # build a .shell-extension.zip for distribution
make schemas     # compile GSettings schema only
make enable      # gnome-extensions enable
make disable
make prefs       # open the preferences window
make logs        # journalctl -f for gnome-shell
make clean
```
